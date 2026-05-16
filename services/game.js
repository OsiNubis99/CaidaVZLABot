const { getLang } = require("../lang");
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const CpuPlayer = require("../class/CpuPlayer");
const cardsService = require("./cards");
const emojisService = require("./emojis"); // dormant — custom emoji set still exists for possible future use
const cantos = require("./cantos");
const mesa = require("./mesa");
const persistence = require("./persistence");
const events = require("./events");
const db = require("../config/db");
const env = require("../config/env");
const logger = require("../config/logger");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");
const TelegramBot = require("node-telegram-bot-api");
const UserDTO = require("../class/UserDTO");
const RequestDTO = require("../class/RequestDTO");
const { GroupController, UserController } = require("../database");

/**
 * Resolve the user-facing language table for the given request or user.
 * Walks back to the in-memory Game to read its locale; falls back to
 * the default (es) when no group context is available — e.g. when a
 * group is not yet registered.
 *
 * @param {RequestDTO|UserDTO|Object} ctx - object with `group.id_group`
 *   or `id_user`.
 */
function langOf(ctx) {
  let chatId;
  if (ctx && ctx.group && ctx.group.id_group) chatId = ctx.group.id_group;
  else if (ctx && ctx.id_user) chatId = users[ctx.id_user];
  const g = chatId ? games[chatId] : null;
  return getLang(g && g.config && g.config.locale);
}

// Attach next-turn metadata so the index handler can fire an opt-in DM
// to the upcoming player and arm the TURBO auto-skip timer.
function attachNextTurn(group, finished, response, chatIdHint) {
  if (!group || finished) return response;
  if (group.decks === 0) return response;
  // Pre-deck guess state: the "next" actor is the player holding the
  // "Start_By" sentinel (the guesser), not group.users[group.player].
  const lastUser = group.users && group.users[group.users.length - 1];
  const isStartByState =
    lastUser && Array.isArray(lastUser.cards) && lastUser.cards[0] === "Start_By";
  const next = isStartByState ? lastUser : group.users && group.users[group.player];
  if (!next || !next.id_user) return response;
  const timeout = (group.config && group.config.turn_timeout_seconds) || 0;
  const out = {
    ...response,
    nextUserId: next.id_user,
    groupName: group.name,
    turnTimeoutSeconds: timeout,
  };
  if (chatIdHint && !out.chat_id) out.chat_id = chatIdHint;
  return out;
}

/**
 * Build the "Pulsa para escoger X" inline button for whoever is up
 * next. Returns undefined when the next actor is a CPU — the bot's
 * scheduler will autoplay so a human-facing "click here" button is
 * noise.
 *
 * Handles the Start_By state: when the dealer holds the Start_By
 * sentinel, THEY are the next actor (choosing 1/4), not group.player.
 */
function keyboardForActor(group) {
  if (!group) return undefined;
  const lastUser = group.users && group.users[group.users.length - 1];
  const isStartBy =
    lastUser && Array.isArray(lastUser.cards) && lastUser.cards[0] === "Start_By";
  const next = isStartBy ? lastUser : group.users && group.users[group.player];
  if (!next || !next.first_name) return undefined;
  if (next.cpu_difficulty) return undefined;
  return keyboard.make_a_choice(next.first_name);
}

// Per-chat debounce handles for in-flight saves. A rapid burst of moves
// (CPU autoplay, picker spam, multi-step canto-then-play) used to trigger
// a separate UPSERT of the whole game state per Telegram event. We coalesce
// them through a short debounce so only the latest state hits Postgres.
// `finished` and explicit flushes still go through synchronously — that
// path also runs `persistence.remove`, which we never want to coalesce.
const PERSIST_DEBOUNCE_MS = 250;
const persistTimers = new Map(); // chatId -> setTimeout handle

function flushPersist(chatId) {
  const handle = persistTimers.get(chatId);
  if (handle) {
    clearTimeout(handle);
    persistTimers.delete(chatId);
  }
  if (!games[chatId]) return Promise.resolve();
  return persistence
    .save(chatId, games[chatId])
    .catch((err) =>
      logger.error({ err: err.message, chat_id: chatId }, "persistence save failed"),
    );
}

// Persist (or drop) the in-memory game for a given chat after a mutation.
async function persistOrRemove(chatId, finished) {
  if (finished) {
    // Cancel any pending debounced save — the row is going away.
    const handle = persistTimers.get(chatId);
    if (handle) {
      clearTimeout(handle);
      persistTimers.delete(chatId);
    }
    try {
      await persistence.remove(chatId);
    } catch (err) {
      logger.error({ err: err.message, chat_id: chatId }, "persistence remove failed");
    }
    return;
  }
  if (!games[chatId]) return;
  // Coalesce: if a debounce is already scheduled we let it stand (it
  // will pick up the latest games[chatId] state when it fires). Otherwise
  // schedule one.
  if (persistTimers.has(chatId)) return;
  const handle = setTimeout(() => flushPersist(chatId), PERSIST_DEBOUNCE_MS);
  persistTimers.set(chatId, handle);
}

// On process shutdown we want all pending saves flushed so a deploy
// during active play doesn't lose the latest move. Best-effort.
async function flushAllPersistTimers() {
  const ids = [...persistTimers.keys()];
  await Promise.all(ids.map(flushPersist));
}

// Render the current table as a PNG and attach it as `photo` to the
// response, when visual_table is enabled. Strips the literal "Mesa: ..."
// line from the caption either way — when there are cards we replace
// it with the photo, when the mesa is empty (e.g. just-cleaned or post-
// kill) we silently drop the empty-slot line so the message stays clean.
//
// The "finished" flag is no longer a hard bail — the victory message
// also honors visual_table, so a win-via-took on a populated mesa
// renders with a photo too. Errors fall back to text.
async function attachMesaPhoto(group, finished, response) {
  if (!group || !group.config || !group.config.visual_table) return response;
  if (!group.table) return response;
  const tableHasCards = group.table.some((c) => c != null);
  const L = group._lang ? group._lang() : require("../lang/es");
  const mesaLabel = (L.ig_mesa_label || "Mesa:").trim();
  const stripMesaLine = (raw) =>
    String(raw || "")
      .split("\n")
      .filter((line) => !line.startsWith(mesaLabel))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  // Pre-game (no game started): nothing to render.
  if (group.decks === 0 && !group.started_at && !finished) {
    return response;
  }

  if (!tableHasCards) {
    // Empty mesa — no point showing "Mesa: [] [] ..." or rendering a
    // blank green photo. Just strip the line.
    return { ...response, message: stripMesaLine(response.message) };
  }
  try {
    const photo = await mesa.render(group.table);
    return { ...response, photo, message: stripMesaLine(response.message) };
  } catch (err) {
    logger.warn({ err: err.message }, "mesa render failed; falling back to text");
    return response;
  }
}

/**
 * @type {Array<Game>}
 */
var games = [];
/**
 * @type {Array<String>}
 */
var users = [];

/**
 * Search all users on the game and delete their object.
 * @param {String} chatId - Id that will be cleaned.
 * @param {Array<UserDTO>} listUsers - Id that will be cleaned.
 */
function cleanUsers(listUsers, chatId) {
  listUsers.forEach((element) => {
    if (users[element.id_user] == chatId) {
      users[element.id_user] = undefined
    }
  });
}

// On startup, re-hydrate any games that were in flight when the bot
// shut down so players don't lose their seat after a deploy. The
// resulting promise is exported (module.exports.loadedPromise) so
// callers like index.js can wait on it before re-arming TURBO timers.
const loadedPromise = db.ready
  .then(() => persistence.loadAll())
  .then(({ games: g, users: u }) => {
    Object.assign(games, g);
    Object.assign(users, u);
  })
  .catch((err) => {
    logger.error({ err: err.message }, "failed to load persisted games");
  });

module.exports = {
  loadedPromise,
  // Flush any debounced game-state saves immediately. Bound to process
  // shutdown in index.js so a deploy / SIGTERM doesn't drop the latest
  // move. Best-effort; errors logged inside.
  flushPendingSaves: flushAllPersistTimers,
  log() {
    console.log({ users })
  },

  /**
   * Read access to the in-memory game for a chat (read-only). Used by
   * configUI to inspect the live config + decide whether config changes
   * are allowed.
   */
  peek(chatId) {
    return games[chatId] || null;
  },

  /**
   * Sweep all in-flight games and cancel any that have exceeded their
   * group's max_game_duration_minutes. Returns the chat_ids that were
   * reaped so the caller (services/gameReaper.js) can post a message
   * to each one explaining what happened.
   *
   * Pre-game lobbies (decks === 0, started_at null) are NEVER reaped —
   * a lobby with people in it isn't "stuck", it's just waiting.
   *
   * @returns {Promise<Array<{chatId:string, groupName:string}>>}
   */
  async reapExpired() {
    const reaped = [];
    const now = Date.now();
    for (const chatId of Object.keys(games)) {
      const g = games[chatId];
      if (!g || !g.started_at) continue;
      const limitMin = (g.config && g.config.max_game_duration_minutes) || 120;
      const elapsedMin = (now - g.started_at) / 60000;
      if (elapsedMin < limitMin) continue;
      events.record(chatId, events.EVENT_TYPES.GAME_EXPIRED, {
        elapsed_minutes: Math.round(elapsedMin),
        limit_minutes: limitMin,
        decks: g.decks,
        players: g.users.length,
      });
      cleanUsers(g.users, chatId);
      reaped.push({ chatId, groupName: g.name });
      delete games[chatId];
      await persistOrRemove(chatId, true);
    }
    return reaped;
  },

  /**
   * Update the in-memory Game's config (after a configUI edit) so the
   * change is reflected in subsequent gameplay without waiting for a
   * restart. Idempotent; no-op if no in-memory game.
   */
  refreshConfig(chatId, fields) {
    const g = games[chatId];
    if (!g) return;
    Object.assign(g.config, fields);
  },

  /**
   * Create a new game with the request data if it isn't already there.
   * @param {RequestDTO} req - Clean request data.
   * @returns Telegram message and options.
   */
  async create(req) {
    const L = langOf(req);
    if (req.group.type == "supergroup" || req.group.type == "group") {
      let user = new User(await UserController.add(req.user));
      if (!user.is_banned) {
        /**
         * @type {Game}
         */
        var group = games[req.group.id_group];
        if (group)
          cleanUsers(group.users, req.group.id_group);
        let configs = await GroupController.getOneById(req.group.id_group);
        if (configs) {
          games[req.group.id_group] = new Game(configs.name, new Config(configs));
          await persistOrRemove(req.group.id_group, false);
          events.record(req.group.id_group, events.EVENT_TYPES.GAME_CREATED, {
            requester: req.user.id_user,
            group_name: configs.name,
          });
          return message.reply(L.game_is_restarted, req.message_id);
        }
        else
          return message.reply(L.group_invalid, req.message_id);
      }
      return message.reply(L.user_is_banned, req.message_id);
    }
    return message.reply(L.is_not_a_group, req.message_id);
  },

  /**
   * Save player data on database and try to join him to a game.
   * @param {RequestDTO} req - Clean request data.
   * @returns Telegram message and options
   */
  async join(req) {
    const L = langOf(req);
    let user = new User(await UserController.add(req.user));
    if (!user.is_banned) {
      /**
       * @type {Game}
       */
      var group = games[req.group.id_group];
      if (!group) {
        let configs = await GroupController.getOneById(req.group.id_group);
        if (!configs) {
          // Auto-register: the bot is now open to all groups. Reject
          // banned groups and refuse DMs (you can only play in a chat).
          if (req.group.type !== "group" && req.group.type !== "supergroup") {
            return message.reply(L.is_not_a_group, req.message_id);
          }
          const raw = await GroupController.getOneByIdRaw(req.group.id_group);
          if (raw && raw.is_banned) {
            return message.reply(L.group_invalid, req.message_id);
          }
          configs = await GroupController.add(
            req.group.id_group,
            req.group.name || "Grupo",
          );
          logger.info(
            { id_group: req.group.id_group, name: configs.name, by: req.user.id_user },
            "auto-registered group on first /unirse",
          );
        }
        games[req.group.id_group] = new Game(configs.name, new Config(configs));
        group = games[req.group.id_group];
      }
      if (group.decks == 0) {
        if (!users[user.id_user]) {
          if (group.users.length < 4) {
            users[user.id_user] = req.group.id_group;
            const joinResp = group.join(user);
            await persistOrRemove(req.group.id_group, false);
            events.record(req.group.id_group, events.EVENT_TYPES.PLAYER_JOINED, {
              user_id: user.id_user,
              first_name: user.first_name,
              username: user.username,
            });
            return message.reply(joinResp, req.message_id);
          }
          return message.reply(L.game_is_full, req.message_id);
        }
        if (users[user.id_user] == req.group.id_group)
          return message.reply(L.user_is_already_joined, req.message_id);
        else
          return message.reply(L.user_is_already_joined_other_group, req.message_id);
      }
      return message.reply(L.game_is_running, req.message_id);
    }
    return message.reply(L.user_is_banned, req.message_id);
  },

  /**
   * Add a CPU-controlled player to the lobby. Pre-game only and
   * capacity-checked (the 4-seat limit is hard). The CPU gets a
   * synthetic id_user (collision-proof vs Telegram's numeric ids)
   * stored in the global users[] map so the inline picker won't
   * route inline queries to it (it has no human behind it).
   *
   * @param {String} chatId  - The chat hosting the lobby.
   * @param {"easy"|"medium"|"pro"} difficulty
   * @returns {{ok:boolean, msg:string}} structured result so the
   *   callback handler can decide how to render the answer.
   */
  async joinCpu(chatId, difficulty) {
    const L = getLang((games[chatId] && games[chatId].config && games[chatId].config.locale) || "es");
    let group = games[chatId];
    if (!group) {
      // Try to bootstrap from the DB config (same path as join()).
      const configs = await GroupController.getOneById(chatId);
      if (!configs) return { ok: false, msg: L.group_invalid };
      games[chatId] = new Game(configs.name, new Config(configs));
      group = games[chatId];
    }
    if (group.decks > 0) return { ok: false, msg: L.game_is_running };
    if (group.users.length >= 4) return { ok: false, msg: L.game_is_full };
    if (!["easy", "medium", "pro"].includes(difficulty)) {
      return { ok: false, msg: "Dificultad inválida" };
    }
    // Pick a slot index unique within the chat. We can't just use
    // users.length because removeCpu shrinks the array; a 2nd CPU
    // joining after a 1st leaves would otherwise collide on the
    // synthetic id. Use a counter scanned from existing CPU ids.
    const existing = group.users
      .filter((u) => u && u.cpu_difficulty)
      .map((u) => {
        const m = /^cpu_[^_]+_(\d+)$/.exec(u.id_user || "");
        return m ? Number(m[1]) : 0;
      });
    const nextSlot = existing.length ? Math.max(...existing) + 1 : 1;
    const labels = { easy: "Fácil", medium: "Medio", pro: "Pro" };
    const cpu = new User({
      id_user: `cpu_${chatId}_${nextSlot}`,
      first_name: `🤖 ${labels[difficulty]}`,
      last_name: "",
      username: null,
      is_banned: false,
      cpu_difficulty: difficulty,
    });
    users[cpu.id_user] = chatId;
    group.join(cpu);
    await persistOrRemove(chatId, false);
    events.record(chatId, events.EVENT_TYPES.PLAYER_JOINED, {
      user_id: cpu.id_user,
      first_name: cpu.first_name,
      cpu_difficulty: difficulty,
    });
    return { ok: true, msg: `${cpu.first_name} agregado.` };
  },

  /**
   * Remove the CPU at the given seat (1-indexed among CPUs, not among
   * all players). Pre-game only — once decks > 0, per-index state
   * (cards, points, took, sing, color) makes hot-removal unsafe, just
   * like /salir for humans. Use /reiniciar (admin) or wait for the
   * reaper if the game is stuck.
   *
   * @returns {{ok:boolean, msg:string}}
   */
  async removeCpu(chatId, seat) {
    const group = games[chatId];
    if (!group) return { ok: false, msg: "No hay partida activa." };
    const cpus = group.users.filter((u) => u && u.cpu_difficulty);
    if (group.decks > 0) {
      return {
        ok: false,
        msg: "La partida ya empezó. Esperá a que termine o pedile a un admin que use /reiniciar.",
      };
    }
    const target = cpus[seat - 1];
    if (!target) return { ok: false, msg: "Ese bot no está en la partida." };
    const idx = group.users.findIndex((u) => u && u.id_user === target.id_user);
    if (idx >= 0) group.users.splice(idx, 1);
    delete users[target.id_user];
    if (group.users.length === 0) {
      delete games[chatId];
      await persistOrRemove(chatId, true);
    } else {
      await persistOrRemove(chatId, false);
    }
    return { ok: true, msg: `${target.first_name} retirado.` };
  },

  /**
   * List CPU seats currently in the lobby. The UI uses this to build
   * the /salirBot button keyboard. Returns seat-numbered tuples (1-N).
   */
  listCpus(chatId) {
    const group = games[chatId];
    if (!group) return [];
    return group.users
      .filter((u) => u && u.cpu_difficulty)
      .map((u, i) => ({
        seat: i + 1,
        first_name: u.first_name,
        difficulty: u.cpu_difficulty,
        id_user: u.id_user,
      }));
  },

  /**
   * Lobby capacity check used by the callback handler so multiple
   * humans hammering /unirBot concurrently each get a clean
   * accept-or-reject without the UI lying about whether there's room.
   * Node's single-threaded event loop guarantees atomicity between
   * this check and the subsequent joinCpu call (they run back-to-back
   * in the same callback handler).
   */
  hasCapacityForCpu(chatId) {
    const group = games[chatId];
    if (!group) return true; // a fresh game will be created
    if (group.decks > 0) return false;
    return group.users.length < 4;
  },

  /**
   * Take one auto-play step for the CPU currently up. Used by the
   * setTimeout-driven scheduler in index.js. Returns the same shape
   * as a human play (chat_id, message, options...) plus an optional
   * `again` flag that signals "this was a canto; schedule another
   * step right after to actually play a card".
   *
   * @param {String} chatId
   * @returns {Promise<Object|null>}
   */
  async cpuAutoStep(chatId) {
    const group = games[chatId];
    if (!group || group.decks === 0) return null;
    // Identify who's up. Start_By state: dealer (last user) is up;
    // otherwise it's group.player.
    const lastUser = group.users[group.users.length - 1];
    const isStartBy =
      lastUser && Array.isArray(lastUser.cards) && lastUser.cards[0] === "Start_By";
    const actorIdx = isStartBy ? group.users.length - 1 : group.player;
    const actor = group.users[actorIdx];
    if (!actor || !actor.cpu_difficulty) return null;
    const decision = CpuPlayer.decide(group, actorIdx, actor.cpu_difficulty);
    // Verbose decision trace — only emitted when DEBUG_CPU_DECISIONS=true
    // in the env. Each line is a few hundred bytes; off by default to
    // keep log volume sane in normal play.
    if (process.env.DEBUG_CPU_DECISIONS === "true" && decision._scoreBreakdown) {
      logger.info(
        {
          chatId,
          actor: actor.first_name,
          difficulty: actor.cpu_difficulty,
          last_card: group.last_card_played
            ? `${group.last_card_played.value}-${group.last_card_played.type}`
            : null,
          table: group.table.map((c) => (c ? `${c.value}-${c.type}` : null)),
          opp_hands: group.users
            .map((u, i) =>
              i === actorIdx
                ? null
                : (u.cards || [])
                    .filter((c) => c && c.value)
                    .map((c) => `${c.value}-${c.type}`),
            )
            .filter(Boolean),
          breakdown: decision._scoreBreakdown,
          chose: decision.cardIdx,
        },
        "cpu decision",
      );
    }
    if (decision.action === "start_by") {
      const resp = await module.exports.handing_out_cards(actor, decision.value);
      return resp ? { ...resp, again: false } : null;
    }
    if (decision.action === "sing") {
      const resp = await module.exports.sing(actor);
      // After cantoing the CPU still has all 3 cards — return again:true
      // so the scheduler chains another step to actually play one.
      return resp ? { ...resp, again: true } : null;
    }
    // Capture which card the CPU is about to play BEFORE play_card
    // removes it from the hand. The index.js scheduler sends this as
    // a separate message (sticker or text) so the chat can see the
    // play happening — humans see this naturally via the inline
    // picker's send, CPUs need an explicit announcement.
    const cardToPlay = actor.cards[decision.cardIdx];
    let presentation = null;
    if (cardToPlay && cardToPlay.value && cardToPlay.type) {
      const visual = group.config && group.config.visual_cards !== false;
      if (visual) {
        const fileId = await cardsService.getFileId(cardToPlay.value, cardToPlay.type);
        if (fileId) presentation = { sticker_file_id: fileId };
      }
      if (!presentation) {
        presentation = {
          message: `${actor.first_name} jugó ${cardToPlay.value} de ${cardToPlay.type}`,
        };
      }
    }
    const resp = await module.exports.play_card(actor, decision.cardIdx);
    if (!resp) return null;
    return { ...resp, presentation, again: false };
  },

  /**
   * Scanner used at startup to re-arm CPU turns after a process
   * restart. Same shape as pendingTimerArmList() but for CPUs.
   */
  pendingCpuTurnList() {
    const out = [];
    for (const chatId of Object.keys(games)) {
      const g = games[chatId];
      if (!g || g.decks === 0) continue;
      const lastUser = g.users[g.users.length - 1];
      const isStartBy =
        lastUser && Array.isArray(lastUser.cards) && lastUser.cards[0] === "Start_By";
      const actorIdx = isStartBy ? g.users.length - 1 : g.player;
      const actor = g.users[actorIdx];
      if (actor && actor.cpu_difficulty) out.push({ chatId });
    }
    return out;
  },

  /**
   * Leave the current game. Pre-game only — once decks > 0 the user
   * has to ask an admin to /reiniciar, because mid-game removal would
   * shuffle every per-index field (cards, points, took, sing). The
   * reaper cron also catches stuck games via max_game_duration_minutes.
   *
   * Frees the global users[user_id] → chat_id mapping so the user
   * can /unirse to a different group right away.
   *
   * @param {RequestDTO} req
   */
  async leave(req) {
    const L = langOf(req);
    const chatId = users[req.user.id_user];
    if (!chatId) {
      return message.reply(L.salir_not_in_game, req.message_id);
    }
    /**
     * @type {Game}
     */
    const group = games[chatId];
    if (!group) {
      // Stale mapping — clean it up so the user isn't stuck.
      delete users[req.user.id_user];
      return message.reply(L.salir_left, req.message_id);
    }
    if (group.decks > 0) {
      return message.reply(L.salir_in_progress, req.message_id);
    }
    // Pre-game: just remove from lobby.
    const idx = group.users.findIndex((u) => u && u.id_user === req.user.id_user);
    if (idx >= 0) group.users.splice(idx, 1);
    delete users[req.user.id_user];
    events.record(chatId, events.EVENT_TYPES.PLAYER_LEFT, {
      user_id: req.user.id_user,
      first_name: req.user.first_name,
      username: req.user.username,
    });
    if (group.users.length === 0) {
      // No one left in the lobby — discard the empty Game shell so a
      // future /unirse creates a fresh one from the latest config.
      delete games[chatId];
      await persistOrRemove(chatId, true);
    } else {
      await persistOrRemove(chatId, false);
    }
    return message.reply(L.salir_left, req.message_id);
  },

  /**
   * Return the full game status.
   * @param {RequestDTO} req - Clean request data.
   * @returns Telegram message and options
   */
  async status(req) {
    const L = langOf(req);
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      const msg = message.reply(group.print(false), req.message_id);
      // Same mesa-as-photo pass that play_card uses, so /estado honors
      // visual_table=on instead of always falling back to the text grid.
      return await attachMesaPhoto(group, false, msg);
    }
    return message.reply(L.no_active_game, req.message_id);
  },

  /**
   * Print all configs.
   * @param {RequestDTO} req - Clean request data.
   * @returns Telegram message and options
   */
  async config(req) {
    const L = langOf(req);
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      let response = group.config.print();
      return message.keyboard(response, keyboard.group_settings());
    }
    return message.reply(L.no_active_game, req.message_id);
  },

  /**
   * TODO Pretty comment
   * @param {RequestDTO} req - Clean request data.
   * @param {String} config - Specific config to be validated and updated.
   * @param {String|Number} value - Value to tested.
   * @returns Telegram message and options
   */
  async set_settings(req, config, value) {
    const L = langOf(req);
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      if (group.decks == 0) {
        let config_is_not_ok = group.config.is_not_ok(config, value);
        if (!config_is_not_ok) {
          await GroupController.update(req.group.id_group, group.config);
          await persistOrRemove(req.group.id_group, false);
          return message.keyboard(L.config_is_ok, keyboard.group_settings());
        }
        return message.reply(config_is_not_ok, req.message_id);
      }
      return message.reply(L.game_is_running, req.message_id);
    }
    return message.reply(L.no_active_game, req.message_id);
  },
  async set_inline_type(req) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group && group.decks == 0) {
      group.config.type =
        group.config.type == "parejas" ? "individual" : "parejas";
      await GroupController.update(req.group.id_group, group.config);
      await persistOrRemove(req.group.id_group, false);
      // print_before_game(message_id, chat_id) — arguments were swapped here.
      return group.print_before_game(req.message_id, req.group.id_group);
    }
    return false;
  },
  async set_inline_game_mode(req, game_mode) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (!group || group.decks > 0 || game_mode == group.config.game_mode) return false;
    group.config.set_game_mode(game_mode);
    await GroupController.update(req.group.id_group, group.config);
    await persistOrRemove(req.group.id_group, false);
    return group.print_before_game(req.message_id, req.group.id_group);
  },

  /**
   * TODO Pretty comment
   * @param {RequestDTO} req - Clean request data.
   * @returns Telegram message and options
   */
  start(req) {
    const L = langOf(req);
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      if (group.decks == 0) {
        if (group.users.length > 1) {
          return group.print_before_game();
        }
        return message.reply(L.game_is_empty, req.message_id);
      }
      return message.reply(L.game_is_running, req.message_id);
    }
    return message.reply(L.no_active_game, req.message_id);
  },

  /**
   * Start a new Game hand
   * @param {RequestDTO} req - Clean request data.
   * @param {Boolean} inLine
   * @returns Telegram message and options
   */
  async shuffle(req, inLine = true) {
    const L = langOf(req);
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      if (group.decks == 0) {
        if (group.users.length > 1) {
          // Block bot-only matches unless the requester is a Bot admin.
          // Keeps the leaderboard honest: humans can play vs CPUs all
          // they want, but a lobby of 3-4 CPUs only spins up if an admin
          // explicitly kicks it off (used for testing / probability work).
          const allCpu = group.users.every((u) => u && u.cpu_difficulty);
          if (allCpu && !env.admin_ids.includes(String(req.user.id_user))) {
            return inLine ? false : message.reply(L.only_admin_all_cpu, req.message_id);
          }
          let response = group.shuffle();
          await persistOrRemove(req.group.id_group, false);
          events.record(req.group.id_group, events.EVENT_TYPES.DECK_SHUFFLED, {
            decks: group.decks,
            player_count: group.users.length,
          });
          const baseMsg = message.keyboard(response, keyboardForActor(group));
          return attachNextTurn(group, false, baseMsg, req.group.id_group);
        }
        return inLine ? false : message.reply(L.game_is_empty, req.message_id);
      }
      return inLine ? false : message.reply(L.game_is_running, req.message_id);
    }
    return inLine ? false : message.reply(L.no_active_game, req.message_id);
  },

  /**
   * TODO Pretty comment
   * @param {UserDTO} user - Whoever plays the card
   * @param {Number} number - Index of the card to play
   * @returns
   */
  async play_card(user, number) {
    const L = langOf(user);
    let chatId = users[user.id_user]
    if (chatId) {
      /**
       * @type {Game}
       */
      let group = games[chatId];
      // Snapshot info needed for event emission BEFORE play mutates state.
      const cardsBefore = group.get_player_cards(user.id_user);
      const playedCard = cardsBefore && cardsBefore[number];
      let response = group.play_card(user.id_user, number);
      let finished = false;
      if (typeof response === "string" && playedCard && playedCard.value) {
        events.record(chatId, events.EVENT_TYPES.CARD_PLAYED, {
          user_id: user.id_user,
          first_name: user.first_name,
          value: playedCard.value,
          type: playedCard.type,
        });
        // Game.play_card sets _lastCaida structurally so the emit isn't
        // tied to the localised user_get_fall text.
        if (group._lastCaida) {
          events.record(chatId, events.EVENT_TYPES.CAIDA, {
            user_id: user.id_user,
            first_name: user.first_name,
            value: playedCard.value,
            type: playedCard.type,
          });
        }
      }
      if (response.finished) {
        finished = true;
        const winnerIdx = group.player; // kill sets this.player to the winner
        const winner = group.users[winnerIdx];
        events.record(chatId, events.EVENT_TYPES.GAME_FINISHED, {
          winner_user_id: winner ? winner.id_user : null,
          winner_first_name: winner ? winner.first_name : null,
          points: group.points,
          decks: group.decks,
        });
        // Bump the denormalized games_played counter on the group row
        // so the admin list can sort by "most active". Fire and forget —
        // a DB hiccup here mustn't block the finish response.
        GroupController.incrementGamesPlayed(chatId).catch((err) =>
          logger.warn({ err: err.message, chatId }, "games_played bump failed"),
        );
        games[chatId] = new Game(group.name, new Config(group.config));
        cleanUsers(group.users, chatId);
        response = response.response
      }
      const msg = message.inLine_keyboard(
        chatId,
        response,
        finished ? undefined : keyboardForActor(group),
      );
      // Audio effect on caída — only signal here; the handler in
      // index.js sends the voice clip after the text/photo message
      // so the bubble order is "play description → sound effect".
      if (group._lastCaida && group.config && group.config.audio_effects !== false) {
        msg.audio = "caida";
      }
      await persistOrRemove(chatId, finished);
      const withPhoto = await attachMesaPhoto(group, finished, msg);
      return attachNextTurn(group, finished, withPhoto);
    }
    return false;
  },

  /**
   * TODO Pretty comment
   * @param {UserDTO} user - Whoever plays the card
   * @returns
   */
  async sing(user) {
    if (users[user.id_user]) {
      /**
       * @type {Game}
       */
      var group = games[users[user.id_user]];
      const chatId = users[user.id_user];
      const userIdx = group.get_user_index(user.id_user);
      const singName =
        userIdx >= 0 && group.users[userIdx].sing ? group.users[userIdx].sing.name : null;
      const msg = message.inLine_keyboard(
        chatId,
        group.sing(user.id_user),
        keyboardForActor(group),
      );
      if (singName && singName !== "No cantó") {
        events.record(chatId, events.EVENT_TYPES.SING, {
          user_id: user.id_user,
          first_name: user.first_name,
          sing_name: singName,
        });
      }
      await persistOrRemove(chatId, false);
      return await attachMesaPhoto(group, false, msg);
    }
    return false;
  },

  async handing_out_cards(user, number) {
    let chatId = users[user.id_user]
    if (chatId) {
      /**
       * @type {Game}
       */
      var group = games[chatId];
      if (user.id_user == group.users[group.users.length - 1].id_user) {
        let response = group.handing_out_cards(number);
        let finished = false;
        events.record(chatId, events.EVENT_TYPES.HAND_DEALT, {
          start_by: number,
          decks: group.decks,
        });
        if (response.finished) {
          finished = true;
          const winnerIdx = group.player;
          const winner = group.users[winnerIdx];
          events.record(chatId, events.EVENT_TYPES.GAME_FINISHED, {
            winner_user_id: winner ? winner.id_user : null,
            winner_first_name: winner ? winner.first_name : null,
            points: group.points,
            decks: group.decks,
          });
          games[chatId] = new Game(group.name, new Config(group.config));
          cleanUsers(group.users, chatId);
          response = response.response
        }
        const msg = message.inLine_keyboard(
          chatId,
          response,
          finished ? undefined : keyboardForActor(group),
        );
        await persistOrRemove(chatId, finished);
        const withPhoto = await attachMesaPhoto(group, finished, msg);
        return attachNextTurn(group, finished, withPhoto);
      }
    }
    return false;
  },

  /**
   * Force the player whose turn is being auto-skipped to take the
   * default action. Handles three states:
   *   - Mid-deck: play their first card (`play_card`).
   *   - Start_By guess: auto-pick "Iniciar por 1" (handing_out_cards 1).
   * Returns the same response shape as the called method, or null if
   * the chat's game state has changed already.
   *
   * @param {String} chatId
   * @param {String} expectedUserId - guard so a stale timer never
   *   plays the wrong player's card.
   */
  async autoSkipTurn(chatId, expectedUserId) {
    const group = games[chatId];
    if (!group || group.decks === 0) return null;
    const last = group.users && group.users[group.users.length - 1];
    const inStartByState =
      last && Array.isArray(last.cards) && last.cards[0] === "Start_By";
    if (inStartByState) {
      if (String(last.id_user) !== String(expectedUserId)) return null;
      return module.exports.handing_out_cards(
        { id_user: last.id_user, first_name: last.first_name },
        1,
      );
    }
    const current = group.users && group.users[group.player];
    if (!current || String(current.id_user) !== String(expectedUserId)) return null;
    return module.exports.play_card(
      { id_user: current.id_user, first_name: current.first_name },
      0,
    );
  },

  /**
   * Snapshot of currently-loaded games for restart-time timer re-arming.
   * Returns an array of { chatId, nextUserId, turnTimeoutSeconds }
   * entries — one per game that has a defined next player and a
   * non-zero timeout.
   */
  pendingTimerArmList() {
    const out = [];
    for (const chatId of Object.keys(games)) {
      const g = games[chatId];
      if (!g || g.decks === 0) continue;
      const timeout = g.config && g.config.turn_timeout_seconds;
      if (!timeout || timeout <= 0) continue;
      const last = g.users && g.users[g.users.length - 1];
      const isStartByState =
        last && Array.isArray(last.cards) && last.cards[0] === "Start_By";
      const next = isStartByState ? last : g.users && g.users[g.player];
      if (!next || !next.id_user) continue;
      out.push({ chatId, nextUserId: next.id_user, turnTimeoutSeconds: timeout });
    }
    return out;
  },

  /**
   * Build the inline-query result list for the user. When the player's
   * group has visual_cards enabled and the file_id cache is populated,
   * each playable card is returned as a cached_photo so the picker
   * shows the actual card art; otherwise it falls back to text articles.
   * @param {UserDTO} user
   * @returns {Promise<Array<TelegramBot.InlineQueryResult>>}
   */
  async get_user_cards(user) {
    const L = langOf(user);
    if (users[user.id_user]) {
      /**
       * @type {Game}
       */
      var group = games[users[user.id_user]];
      if (group.decks > 0) {
        let cardsHand = group.get_player_cards(user.id_user);
        if (cardsHand.length > 0) {
          if (cardsHand[0] == "Start_By") {
            // The "Iniciar por 1 / 4" picker stays as text articles by
            // explicit user preference — card-photo variants felt off.
            return [
              {
                id: "8",
                type: "article",
                title: L.start_by_one_title,
                input_message_content: { message_text: L.start_by_one_message },
                description: L.start_by_one_description,
              },
              {
                id: "9",
                type: "article",
                title: L.start_by_four_title,
                input_message_content: { message_text: L.start_by_four_message },
                description: L.start_by_four_description,
              },
            ];
          }
          // visual_cards=on uses cached stickers (image preview in the
          // picker grid + sticker bubble in chat). off uses plain text
          // articles. The custom-emoji bootstrap stays in place but
          // dormant: it ended up being the same display size as a
          // sticker but with worse resolution (100×100 source vs
          // 512×512 sticker), so for now we stick with stickers.
          const visual = group.config.visual_cards !== false;
          const cardResults = [];
          let cantoResult = null;
          for (let index = 0; index < cardsHand.length; index++) {
            const element = cardsHand[index];
            if (index == 3) {
              const cantoFileId = visual
                ? await cardsService.getCantoFileId(element.name)
                : null;
              if (cantoFileId) {
                cantoResult = {
                  id: "4",
                  type: "sticker",
                  sticker_file_id: cantoFileId,
                };
              } else {
                cantoResult = {
                  id: "4",
                  type: "article",
                  title: element.name,
                  description: "Valor: " + element.value,
                  input_message_content: { message_text: `Tengo ${element.name}` },
                };
              }
            } else {
              const cardLabel = `${element.value} de ${element.type}`;
              const fileId =
                visual && element && element.value && element.type
                  ? await cardsService.getFileId(element.value, element.type)
                  : null;
              if (fileId) {
                cardResults.push({
                  id: String(index),
                  type: "sticker",
                  sticker_file_id: fileId,
                });
              } else {
                cardResults.push({
                  id: String(index),
                  type: "article",
                  title: cardLabel,
                  description: "De " + element.type,
                  input_message_content: { message_text: "Juego el " + cardLabel },
                });
              }
            }
          }
          // Always present the picker low→high regardless of visual
          // mode — natural ascending reading order. The internal
          // cardsHand array stays high→low (the canto detector depends
          // on that order); each result's `id` still encodes the
          // original index so play_card receives the correct card no
          // matter what slot the user tapped in the picker.
          cardResults.reverse();
          const response = [];
          response.push(...cardResults);
          if (cantoResult) response.push(cantoResult);
          return response;
        }
        return [
          {
            id: "12",
            type: "article",
            title: L.no_cards_title,
            input_message_content: { message_text: L.no_cards_message },
            description: L.no_cards_description,
          },
        ];
      }
      return [
        {
          id: "11",
          type: "article",
          title: L.game_no_started_title,
          input_message_content: { message_text: L.game_no_started_message },
          description: L.game_no_started_description,
        },
      ];
    }
    return [
      {
        id: "10",
        type: "article",
        title: L.no_game_title,
        input_message_content: { message_text: L.no_game_message },
        description: L.no_game_description,
      },
    ];
  },
};
