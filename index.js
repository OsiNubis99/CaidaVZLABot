const { getLang } = require("./lang");
const bot = require("./config/server");
const game = require("./services/game");
const admin = require("./services/admin");
const adminUI = require("./services/adminUI");
const cards = require("./services/cards");
const emojis = require("./services/emojis");
const audio = require("./services/audio");
const leaderboard = require("./services/leaderboard");
const rateLimit = require("./services/rateLimit");
const events = require("./services/events");
const configUI = require("./services/configUI");
const logger = require("./config/logger");
const keyboard = require("./templates/keyboard");
const RequestDTO = require("./class/RequestDTO");
const UserDTO = require("./class/UserDTO");
const { UserController, GroupController } = require("./database");

// Localised strings for raw Telegram-message handlers. Falls back to es
// when the chat has no in-memory game yet.
function langForMsg(msg) {
  if (!msg || !msg.chat) return getLang(null);
  const g = game.peek(String(msg.chat.id));
  return getLang(g && g.config && g.config.locale);
}

// TURBO mode: per-chat timer that auto-plays the current player's
// first card if they don't move within `turn_timeout_seconds`. The
// timer is cleared and re-armed after every successful move.
const skipTimers = new Map();

function clearSkipTimer(chatId) {
  const h = skipTimers.get(chatId);
  if (h) {
    clearTimeout(h);
    skipTimers.delete(chatId);
  }
}

function scheduleSkip(response) {
  if (!response || !response.chat_id) return;
  const chatId = response.chat_id;
  clearSkipTimer(chatId);
  const seconds = response.turnTimeoutSeconds;
  if (!seconds || seconds <= 0) return;
  if (!response.nextUserId) return;
  const expectedUserId = response.nextUserId;
  const handle = setTimeout(async () => {
    skipTimers.delete(chatId);
    try {
      const result = await game.autoSkipTurn(chatId, expectedUserId);
      if (!result) return;
      await bot.sendMessage(chatId, "⏰ Tiempo agotado — turno saltado.");
      if (result.photo) {
        await bot.sendPhoto(chatId, result.photo, {
          caption: (result.message || "").slice(0, 1024),
          reply_markup: result.options && result.options.reply_markup,
        });
      } else {
        await bot.sendMessage(chatId, result.message, result.options);
      }
      await maybeDmNextTurn(result);
      scheduleSkip(result);
    } catch (err) {
      logger.warn({ err: err.message, chatId }, "auto-skip failed");
    }
  }, seconds * 1000);
  skipTimers.set(chatId, handle);
}

async function maybeDmNextTurn(response) {
  if (!response || !response.nextUserId) return;
  try {
    const enabled = await UserController.getNotifyOnTurn(response.nextUserId);
    if (!enabled) return;
    await bot.sendMessage(
      response.nextUserId,
      `Es tu turno en *${response.groupName || "la partida"}*. ` +
        `Abre @CaidaVZLABot en el grupo para escoger una carta.\n\n` +
        `(Para silenciar estas notificaciones envía /notify off.)`,
      { parse_mode: "Markdown" },
    );
  } catch (err) {
    // 403 = user has not started bot in DM. Auto-mute to stop trying.
    if (String(err.message).includes("blocked") || String(err.message).includes("403")) {
      try {
        await UserController.setNotifyOnTurn(response.nextUserId, false);
      } catch (_) {}
    } else {
      logger.warn({ err: err.message, user_id: response.nextUserId }, "dm turn notify failed");
    }
  }
}

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
});

// Per-command rate limits. The defaults are intentionally loose so a
// normal player never hits them; the goal is just to stop pathological
// flooders. Game-flow commands have tighter windows than admin ones.
const COMMAND_LIMITS = {
  "/unirse": { windowMs: 5_000, max: 3 },
  "/iniciar": { windowMs: 5_000, max: 3 },
  "/inicia_ya": { windowMs: 5_000, max: 3 },
  "/reiniciar": { windowMs: 10_000, max: 3 },
  "/estado": { windowMs: 5_000, max: 5 },
  "/configurar": { windowMs: 5_000, max: 5 },
  "/configura": { windowMs: 5_000, max: 5 },
  "/top": { windowMs: 10_000, max: 3 },
  "/stats": { windowMs: 5_000, max: 5 },
  "/list_groups": { windowMs: 10_000, max: 3 },
  "/admin": { windowMs: 5_000, max: 10 },
  "/notify": { windowMs: 5_000, max: 5 },
  "/historial": { windowMs: 30_000, max: 3 },
  "/addgroup": { windowMs: 10_000, max: 3 },
};

async function rateLimited(msg, command) {
  const limits = COMMAND_LIMITS[command];
  if (!limits) return false;
  const r = rateLimit.check(msg.from.id, command, limits);
  if (r.allowed) return false;
  try {
    await bot.sendMessage(
      msg.chat.id,
      `Demasiados comandos. Probá de nuevo en ${r.retryInSec}s.`,
      { reply_to_message_id: msg.message_id },
    );
  } catch (_) {}
  return true;
}

// helper: wrap async handlers so any throw is logged, not lost
function safe(name, fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      logger.error({ err, handler: name }, "handler error");
    }
  };
}

//**                    InLine Query                    */

bot.on(
  "inline_query",
  safe("inline_query", async (query) => {
    const results = await game.get_user_cards(UserDTO.fromTelegram(query.from));
    await bot.answerInlineQuery(query.id, results, { is_personal: true, cache_time: 1 });
  }),
);

bot.on(
  "chosen_inline_result",
  safe("chosen_inline_result", async (result) => {
    let response = false;
    const user = UserDTO.fromTelegram(result.from);
    const rid = Number(result.result_id);
    if (rid >= 0 && rid < 3) {
      response = await game.play_card(user, rid);
    } else if (rid === 4) {
      response = await game.sing(user);
    } else if (rid === 8) {
      response = await game.handing_out_cards(user, 1);
    } else if (rid === 9) {
      response = await game.handing_out_cards(user, 4);
    }
    if (!response) return;
    if (response.photo) {
      const opts = {
        reply_markup: response.options && response.options.reply_markup,
      };
      if (response.message && response.message.trim()) {
        opts.caption =
          response.message.length > 1024
            ? response.message.slice(0, 1021) + "..."
            : response.message;
      }
      await bot.sendPhoto(response.chat_id, response.photo, opts);
    } else {
      await bot.sendMessage(response.chat_id, response.message, response.options);
    }
    if (response.audio) {
      // Fire-and-forget — audio is best-effort, errors are logged inside.
      audio.play(bot, response.chat_id, response.audio).catch(() => {});
    }
    await maybeDmNextTurn(response);
    scheduleSkip(response);
  }),
);

//**                      CallBacks                      */

bot.on(
  "callback_query",
  safe("callback_query", async (query) => {
    // Group config UI callbacks (BotFather-style).
    if (query.data.startsWith("c:")) {
      const chatId = String(query.message.chat.id);
      const view = await configUI.dispatch(chatId, query.data);
      if (view && view.alert) {
        await bot.answerCallbackQuery(query.id, { text: view.alert, show_alert: true });
      } else {
        await bot.answerCallbackQuery(query.id);
      }
      if (view && view.close) {
        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch (_) {}
        return;
      }
      if (!view) return;
      try {
        await bot.editMessageText(view.message, {
          ...view.options,
          chat_id: chatId,
          message_id: query.message.message_id,
        });
      } catch (err) {
        if (!String(err.message).includes("message is not modified")) {
          logger.warn({ err: err.message, data: query.data }, "configUI edit failed");
        }
      }
      return;
    }

    await bot.answerCallbackQuery(query.id);

    // Admin UI callbacks: only allowed for admins.
    if (query.data.startsWith("a:")) {
      if (!admin.is_admin(query.from.id)) {
        await bot.answerCallbackQuery(query.id, {
          text: "No tienes permisos.",
          show_alert: true,
        });
        return;
      }
      const chat_id = query.message.chat.id;
      const message_id = query.message.message_id;
      const editOpts = (view) => ({ ...view.options, chat_id, message_id });

      const parts = query.data.split(":");
      const action = parts[1];
      let view;
      if (action === "l") view = await adminUI.listView();
      else if (action === "g") view = await adminUI.groupDetailView(parts[2]);
      else if (action === "tp") view = await adminUI.togglePublic(parts[2]);
      else if (action === "p") view = await adminUI.extendPayment(parts[2], parts[3]);
      else if (action === "rn") {
        adminUI.startRename(query.from.id, parts[2]);
        view = adminUI.renamePromptView(parts[2]);
      } else if (action === "dq") view = adminUI.deletePromptView(parts[2]);
      else if (action === "dc") view = await adminUI.deleteConfirm(parts[2]);
      else return;
      try {
        await bot.editMessageText(view.message, editOpts(view));
      } catch (err) {
        // editMessageText fails if content is identical; ignore that case.
        if (!String(err.message).includes("message is not modified")) {
          logger.warn({ err: err.message, action }, "admin callback edit failed");
        }
      }
      return;
    }

    if (query.data.match(/set_(.*)/)) {
      const game_mode = parseInt(query.data.match(/set_(.*)/)[1]);
      const response = await game.set_inline_game_mode(
        RequestDTO.fromTelegram(query.message),
        game_mode,
      );
      if (response) await bot.editMessageText(response.message, response.options);
      return;
    }
    switch (query.data) {
      case "how_config":
        await bot.editMessageText(langForMsg(query.message).how_config, {
          reply_markup: keyboard.back,
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        });
        break;
      case "back": {
        const response = await game.config(RequestDTO.fromTelegram(query.message), true);
        await bot.editMessageText(response.message, response.options);
        break;
      }
      case "type": {
        const response = await game.set_inline_type(RequestDTO.fromTelegram(query.message));
        await bot.editMessageText(response.message, response.options);
        break;
      }
      case "start": {
        const response = await game.shuffle(RequestDTO.fromTelegram(query.message));
        if (response) {
          await bot.sendMessage(query.message.chat.id, response.message, response.options);
          scheduleSkip(response);
        }
        await bot.deleteMessage(query.message.chat.id, query.message.message_id);
        break;
      }
      default:
        await bot.deleteMessage(query.message.chat.id, query.message.message_id);
        break;
    }
  }),
);

//**                   Admins Commands                   */

bot.onText(
  /\/message (.*)/,
  safe("/message", async (msg, match) => {
    if (!admin.is_admin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, langForMsg(msg).no_admin_person, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const groups = await admin.all_groups(RequestDTO.fromTelegram(msg));
    for (const group of groups) {
      try {
        const sent = await bot.sendMessage(group.id_group, match[1]);
        logger.info(
          { group_id: group.id_group, group_name: group.name, text_len: sent.text.length },
          "broadcast sent",
        );
      } catch (err) {
        logger.warn(
          { err: err.message, group_id: group.id_group, group_name: group.name },
          "broadcast failed; removing group",
        );
        await admin.force_remove_group(msg.from.id, group.id_group);
      }
    }
  }),
);

bot.onText(
  /\/lock/,
  safe("/lock", async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      await admin.ban_unban_user(RequestDTO.fromTelegram(msg), true),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/unlock/,
  safe("/unlock", async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      await admin.ban_unban_user(RequestDTO.fromTelegram(msg), false),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/addg-(.*)-(.*)/,
  safe("/addg", async (msg, match) => {
    await bot.sendMessage(
      msg.chat.id,
      admin.add_group(RequestDTO.fromTelegram(msg), match[1], match[2]),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /^\/addgroup(?:@\w+)?$/,
  safe("/addgroup", async (msg) => {
    if (await rateLimited(msg, "/addgroup")) return;
    if (!admin.is_admin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, langForMsg(msg).no_admin_person, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
      await bot.sendMessage(
        msg.chat.id,
        "Este comando solo funciona dentro de un grupo. Agregame al grupo y corré /addgroup allí.",
        { reply_to_message_id: msg.message_id },
      );
      return;
    }
    const id_group = String(msg.chat.id);
    const name = msg.chat.title || "(sin nombre)";
    try {
      await GroupController.add(id_group, name);
      logger.info({ id_group, name, by: msg.from.id }, "/addgroup registered");
      await bot.sendMessage(
        msg.chat.id,
        `Grupo registrado:\n  id: ${id_group}\n  nombre: ${name}\n\nUsa /admin para hacerlo público o extender pago.`,
        { reply_to_message_id: msg.message_id },
      );
    } catch (err) {
      logger.error({ err: err.message, id_group }, "/addgroup failed");
      await bot.sendMessage(msg.chat.id, "Error al registrar el grupo.", {
        reply_to_message_id: msg.message_id,
      });
    }
  }),
);

bot.onText(
  /\/paid-(.*)-(.*)/,
  safe("/paid", async (msg, match) => {
    await bot.sendMessage(
      msg.chat.id,
      await admin.paid(RequestDTO.fromTelegram(msg), match[1], match[2]),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/list_groups/,
  safe("/list_groups", async (msg) => {
    if (await rateLimited(msg, "/list_groups")) return;
    await bot.sendMessage(msg.chat.id, await admin.list_group(msg), {
      reply_to_message_id: msg.message_id,
    });
  }),
);

bot.onText(
  /\/listUsers/,
  safe("/listUsers", async (msg) => {
    await bot.sendMessage(msg.chat.id, await admin.list_user(msg), {
      reply_to_message_id: msg.message_id,
    });
  }),
);

bot.onText(
  /\/stats/,
  safe("/stats", async (msg) => {
    if (await rateLimited(msg, "/stats")) return;
    const response = await admin.get_user_stats(RequestDTO.fromTelegram(msg));
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/top/,
  safe("/top", async (msg) => {
    if (await rateLimited(msg, "/top")) return;
    const text = await leaderboard.topMessage(10);
    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: "Markdown",
      reply_to_message_id: msg.message_id,
    });
  }),
);

bot.onText(
  /\/historial/,
  safe("/historial", async (msg) => {
    if (await rateLimited(msg, "/historial")) return;
    const rows = await events.lastGameEvents(String(msg.chat.id), 300);
    let text = events.renderTranscript(rows);
    if (text.length > 4000) text = text.slice(0, 3997) + "...";
    await bot.sendMessage(msg.chat.id, text, {
      parse_mode: "Markdown",
      reply_to_message_id: msg.message_id,
    });
  }),
);

bot.onText(
  /\/notify(?:\s+(on|off))?/,
  safe("/notify", async (msg, match) => {
    const arg = (match[1] || "").toLowerCase();
    if (!arg) {
      const current = await UserController.getNotifyOnTurn(String(msg.from.id));
      await bot.sendMessage(
        msg.chat.id,
        `Notificación DM al ser tu turno: *${current ? "on" : "off"}*.\n` +
          `Usa /notify on o /notify off para cambiarlo. ` +
          `(El bot tiene que poder escribirte por DM: escríbele /start en privado primero.)`,
        { parse_mode: "Markdown", reply_to_message_id: msg.message_id },
      );
      return;
    }
    await UserController.setNotifyOnTurn(String(msg.from.id), arg === "on");
    await bot.sendMessage(
      msg.chat.id,
      `Notificación DM por turno: ${arg === "on" ? "activada ✅" : "desactivada"}`,
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/bootstrap_cards(?:\s+(force))?/,
  safe("/bootstrap_cards", async (msg, match) => {
    if (!admin.is_admin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, langForMsg(msg).no_admin_person);
      return;
    }
    const force = !!(match && match[1]);
    await bot.sendMessage(
      msg.chat.id,
      `Subiendo 40 cartas como stickers${force ? " (force=reset cache)" : ""}. Esto toma ~1 min.`,
    );
    const result = await cards.bootstrap(bot, msg.chat.id, { force });
    await bot.sendMessage(
      msg.chat.id,
      `Bootstrap completo. Subidas: ${result.uploaded}, ya cacheadas: ${result.skipped}, fallidas: ${result.failed}.`,
    );
  }),
);

bot.onText(
  /\/bootstrap_emojis(?:\s+(force))?/,
  safe("/bootstrap_emojis", async (msg, match) => {
    if (!admin.is_admin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, langForMsg(msg).no_admin_person);
      return;
    }
    const force = !!(match && match[1]);
    await bot.sendMessage(
      msg.chat.id,
      `Creando set de custom emojis "${emojis.SET_TITLE}"${force ? " (force=reset cache)" : ""}.\nEsto toma ~1-2 min para 50 emojis.\nEl set queda asociado a tu user_id; podés removerlo desde Telegram → tu perfil → emoji packs.`,
    );
    const result = await emojis.bootstrap(bot, msg.from.id, { force });
    await bot.sendMessage(
      msg.chat.id,
      `Bootstrap completo. Subidas: ${result.uploaded}, ya cacheadas: ${result.skipped}, fallidas: ${result.failed}.`,
    );
  }),
);

bot.onText(
  /\/admin/,
  safe("/admin", async (msg) => {
    logger.info(
      { user_id: msg.from.id, chat_id: msg.chat.id, is_admin: admin.is_admin(msg.from.id) },
      "/admin invoked",
    );
    if (await rateLimited(msg, "/admin")) return;
    if (!admin.is_admin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, langForMsg(msg).no_admin_person);
      return;
    }
    const view = await adminUI.listView();
    try {
      await bot.sendMessage(msg.chat.id, view.message, view.options);
    } catch (err) {
      logger.error({ err: err.message, response: err.response && err.response.body }, "/admin sendMessage failed");
      // fall back to plain text without markdown
      await bot.sendMessage(
        msg.chat.id,
        "Lista de grupos (modo simple):\n" + view.message.replace(/[*_`]/g, ""),
      );
    }
  }),
);

bot.onText(
  /^\/cancelar/,
  safe("/cancelar", async (msg) => {
    if (adminUI.getPendingRename(msg.from.id)) {
      adminUI.cancelRename(msg.from.id);
      await bot.sendMessage(msg.chat.id, "Renombrado cancelado.", {
        reply_to_message_id: msg.message_id,
      });
    }
  }),
);

// Intercept plain-text messages from admins who are in a rename flow.
bot.on(
  "message",
  safe("rename_listener", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    if (!admin.is_admin(msg.from.id)) return;
    const pending = adminUI.getPendingRename(msg.from.id);
    if (!pending) return;
    const newName = msg.text.trim().slice(0, 100);
    if (!newName) return;
    adminUI.cancelRename(msg.from.id);
    const view = await adminUI.applyRename(pending.id_group, newName);
    await bot.sendMessage(msg.chat.id, view.message, view.options);
  }),
);

//**                    Game Commands                    */

bot.onText(
  /\/reiniciar/,
  safe("/reiniciar", async (msg) => {
    if (msg.chat.type === "private") return;
    if (await rateLimited(msg, "/reiniciar")) return;
    const admins = await bot.getChatAdministrators(msg.chat.id);
    const isChatAdmin = admins && admins.some((a) => a.user.id == msg.from.id);
    if (!isChatAdmin) {
      await bot.sendMessage(msg.chat.id, langForMsg(msg).user_is_not_admin, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const response = await game.create(RequestDTO.fromTelegram(msg), true);
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/unirse/,
  safe("/unirse", async (msg) => {
    if (await rateLimited(msg, "/unirse")) return;
    const response = await game.join(RequestDTO.fromTelegram(msg));
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/iniciar/,
  safe("/iniciar", async (msg) => {
    if (await rateLimited(msg, "/iniciar")) return;
    const response = game.start(RequestDTO.fromTelegram(msg));
    await bot.sendMessage(msg.chat.id, response.message, response.options);
    logger.info(
      { chat_id: msg.chat.id, chat_title: msg.chat.title },
      "game started (/iniciar)",
    );
  }),
);

bot.onText(
  /\/inicia_ya/,
  safe("/inicia_ya", async (msg) => {
    if (await rateLimited(msg, "/inicia_ya")) return;
    const response = await game.shuffle(RequestDTO.fromTelegram(msg), false);
    if (response) {
      await bot.sendMessage(msg.chat.id, response.message, response.options);
      scheduleSkip(response);
    }
    logger.info(
      { chat_id: msg.chat.id, chat_title: msg.chat.title },
      "game started (/inicia_ya)",
    );
  }),
);

bot.onText(
  /\/estado/,
  safe("/estado", async (msg) => {
    if (await rateLimited(msg, "/estado")) return;
    const response = await game.status(RequestDTO.fromTelegram(msg));
    if (response.photo) {
      const opts = { reply_markup: response.options && response.options.reply_markup };
      if (response.message && response.message.trim()) {
        opts.caption =
          response.message.length > 1024
            ? response.message.slice(0, 1021) + "..."
            : response.message;
      }
      await bot.sendPhoto(msg.chat.id, response.photo, opts);
    } else {
      await bot.sendMessage(msg.chat.id, response.message, response.options);
    }
  }),
);

bot.onText(
  /\/configurar/,
  safe("/configurar", async (msg) => {
    if (await rateLimited(msg, "/configurar")) return;
    const view = await configUI.mainView(String(msg.chat.id));
    await bot.sendMessage(msg.chat.id, view.message, {
      ...view.options,
      reply_to_message_id: msg.message_id,
    });
  }),
);

bot.onText(
  /\/configura(.*) (.*) (.*)/,
  safe("/configura", async (msg, match) => {
    if (await rateLimited(msg, "/configura")) return;
    const response = await game.set_settings(RequestDTO.fromTelegram(msg), match[2], match[3]);
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

//**                     Set Commands                    */

bot.setMyCommands([
  { command: "unirse", description: "Te agrega a la partida." },
  { command: "iniciar", description: "Inicia la partida." },
  { command: "inicia_ya", description: "Inicia la partida, pero se salta las configuraciones" },
  { command: "estado", description: "Muestra información sobre la partida." },
  { command: "reiniciar", description: "Elimina la partida actual y crea una nueva." },
  { command: "configurar", description: "Muestra el panel de configuración." },
  { command: "help", description: "Muestra una ayuda de como usar el bot." },
  { command: "list_groups", description: "Muestra la lista de grupos publicos en el bot" },
  { command: "stats", description: "Muestra las estadisticas del usuario" },
  { command: "top", description: "Top 10 jugadores globales" },
  { command: "notify", description: "Avisar por DM cuando sea tu turno (on/off)" },
  { command: "historial", description: "Resumen de la última partida del grupo" },
]);

// Prune the events table once a day so it doesn't grow forever.
setInterval(
  () => {
    events.pruneOlderThan(30).catch(() => {});
  },
  24 * 60 * 60 * 1000,
);

// After hydrating persisted games on startup, re-arm TURBO skip timers
// for any game that's mid-deck and has a non-zero turn_timeout. Without
// this, a deploy mid-deck would silently disable auto-skip until each
// chat's next manual move re-armed it.
game.loadedPromise
  .then(() => {
    const pending = game.pendingTimerArmList();
    for (const p of pending) {
      scheduleSkip({
        chat_id: p.chatId,
        nextUserId: p.nextUserId,
        turnTimeoutSeconds: p.turnTimeoutSeconds,
      });
    }
    if (pending.length > 0) {
      logger.info({ count: pending.length }, "re-armed TURBO timers after reload");
    }
  })
  .catch((err) => logger.warn({ err: err.message }, "TURBO timer re-arm failed"));

