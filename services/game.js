const { getLang } = require("../lang");
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const emojisService = require("./emojis");
const cantos = require("./cantos");
const mesa = require("./mesa");
const persistence = require("./persistence");
const events = require("./events");
const db = require("../config/db");
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

// Persist (or drop) the in-memory game for a given chat after a mutation.
async function persistOrRemove(chatId, finished) {
  try {
    if (finished) {
      await persistence.remove(chatId);
    } else if (games[chatId]) {
      await persistence.save(chatId, games[chatId]);
    }
  } catch (err) {
    logger.error({ err: err.message, chat_id: chatId }, "persistence failed");
  }
}

// Render the current table as a PNG and attach it as `photo` to the
// response, when visual_table is enabled and the game is mid-deck.
//
// Only the single line `Mesa: <slot contents>` is stripped from the
// caption — everything else (Ultimas!, Ultima carta, Siguiente, Caidó,
// Mesa Limpia, Barajando, team listing) stays as caption so action and
// status notifications still reach the user.
// Errors are swallowed and the response falls back to the text-only mesa.
async function attachMesaPhoto(group, finished, response) {
  if (!group || !group.config || !group.config.visual_table) return response;
  if (finished) return response;
  if (!group.table || group.decks === 0) return response;
  try {
    const photo = await mesa.render(group.table);
    const L = group._lang ? group._lang() : require("../lang/es");
    const mesaLabel = (L.ig_mesa_label || "Mesa:").trim();
    const raw = String(response.message || "");
    const caption = raw
      .split("\n")
      .filter((line) => !line.startsWith(mesaLabel))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return { ...response, photo, message: caption };
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
        if (!configs)
          return message.reply(L.group_invalid, req.message_id);
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
          let response = group.shuffle();
          await persistOrRemove(req.group.id_group, false);
          events.record(req.group.id_group, events.EVENT_TYPES.DECK_SHUFFLED, {
            decks: group.decks,
            player_count: group.users.length,
          });
          const baseMsg = message.keyboard(
            response,
            keyboard.make_a_choice(
              group.users[group.users.length - 1].first_name
            )
          );
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
        games[chatId] = new Game(group.name, new Config(group.config));
        cleanUsers(group.users, chatId);
        response = response.response
      }
      const msg = message.inLine_keyboard(
        chatId,
        response,
        finished ? undefined : keyboard.make_a_choice(group.playerName())
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
        keyboard.make_a_choice(group.playerName()),
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
          finished ? undefined : keyboard.make_a_choice(group.playerName()),
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
          // Build inline-article results for each playable card + the
          // optional canto. Each article carries an input_message_content
          // whose `entities` array points to our custom emoji cache; if
          // the cache doesn't have the id for that card, we fall through
          // to plain text ("4 de Oro") — no generic emoji prefix.
          //
          // visual_cards toggles message shape:
          //   on  → "🃏" (placeholder replaced by custom emoji, renders jumbo)
          //   off → "🃏 4 de Oro" (custom emoji inline + text)
          // Both share the same picker article preview so the player
          // sees a readable list of cards by name in the search dropdown.
          const visual = group.config.visual_cards !== false;
          const names = [];
          for (let i = 0; i < cardsHand.length; i++) {
            const el = cardsHand[i];
            if (i == 3) names.push(emojisService.cantoName(el.name));
            else if (el && el.value && el.type) names.push(emojisService.cardName(el.value, el.type));
          }
          const emojiIds = await emojisService.lookupMany(names);

          const cardResults = [];
          let cantoResult = null;
          for (let index = 0; index < cardsHand.length; index++) {
            const element = cardsHand[index];
            if (index == 3) {
              const emojiId = emojiIds.get(emojisService.cantoName(element.name));
              const placeholder = "🃏"; // 2 utf-16 code units; gets replaced by the custom emoji
              const labelText = `${placeholder} ${element.name}`;
              if (emojiId) {
                cantoResult = {
                  id: "4",
                  type: "article",
                  title: element.name,
                  description: "Valor: " + element.value,
                  input_message_content: {
                    message_text: visual ? placeholder : labelText,
                    entities: [
                      { type: "custom_emoji", offset: 0, length: 2, custom_emoji_id: emojiId },
                    ],
                  },
                };
              } else {
                // No emoji cached → plain text fallback (text mode).
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
              const emojiId =
                element && element.value && element.type
                  ? emojiIds.get(emojisService.cardName(element.value, element.type))
                  : null;
              const placeholder = "🃏";
              if (emojiId) {
                cardResults.push({
                  id: String(index),
                  type: "article",
                  title: cardLabel,
                  description: "De " + element.type,
                  input_message_content: {
                    message_text: visual ? placeholder : `${placeholder} ${cardLabel}`,
                    entities: [
                      { type: "custom_emoji", offset: 0, length: 2, custom_emoji_id: emojiId },
                    ],
                  },
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
