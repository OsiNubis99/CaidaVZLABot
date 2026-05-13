const resp = require("./lang/es");
const bot = require("./config/server");
const game = require("./services/game");
const admin = require("./services/admin");
const adminUI = require("./services/adminUI");
const cards = require("./services/cards");
const logger = require("./config/logger");
const keyboard = require("./templates/keyboard");
const Factory_Request = require("./class/Factory_Request");
const Factory_User = require("./class/Factory_User");

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandledRejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "uncaughtException");
});

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
    const results = await game.get_user_cards(Factory_User.fromTelegram(query.from));
    await bot.answerInlineQuery(query.id, results, { is_personal: true, cache_time: 1 });
  }),
);

bot.on(
  "chosen_inline_result",
  safe("chosen_inline_result", async (result) => {
    let response = false;
    const user = Factory_User.fromTelegram(result.from);
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
      const caption =
        response.message && response.message.length > 1024
          ? response.message.slice(0, 1021) + "..."
          : response.message || "";
      await bot.sendPhoto(response.chat_id, response.photo, {
        caption,
        reply_markup: response.options && response.options.reply_markup,
      });
    } else {
      await bot.sendMessage(response.chat_id, response.message, response.options);
    }
  }),
);

//**                      CallBacks                      */

bot.on(
  "callback_query",
  safe("callback_query", async (query) => {
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
        Factory_Request.fromTelegram(query.message),
        game_mode,
      );
      if (response) await bot.editMessageText(response.message, response.options);
      return;
    }
    switch (query.data) {
      case "how_config":
        await bot.editMessageText(resp.how_config, {
          reply_markup: keyboard.back,
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
        });
        break;
      case "back": {
        const response = await game.config(Factory_Request.fromTelegram(query.message), true);
        await bot.editMessageText(response.message, response.options);
        break;
      }
      case "type": {
        const response = await game.set_inline_type(Factory_Request.fromTelegram(query.message));
        await bot.editMessageText(response.message, response.options);
        break;
      }
      case "start": {
        const response = await game.shuffle(Factory_Request.fromTelegram(query.message));
        if (response) {
          await bot.sendMessage(query.message.chat.id, response.message, response.options);
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
      await bot.sendMessage(msg.chat.id, resp.no_admin_person, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const groups = await admin.all_groups(Factory_Request.fromTelegram(msg));
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
      await admin.ban_unban_user(Factory_Request.fromTelegram(msg), true),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/unlock/,
  safe("/unlock", async (msg) => {
    await bot.sendMessage(
      msg.chat.id,
      await admin.ban_unban_user(Factory_Request.fromTelegram(msg), false),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/addg-(.*)-(.*)/,
  safe("/addg", async (msg, match) => {
    await bot.sendMessage(
      msg.chat.id,
      admin.add_group(Factory_Request.fromTelegram(msg), match[1], match[2]),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/paid-(.*)-(.*)/,
  safe("/paid", async (msg, match) => {
    await bot.sendMessage(
      msg.chat.id,
      await admin.paid(Factory_Request.fromTelegram(msg), match[1], match[2]),
      { reply_to_message_id: msg.message_id },
    );
  }),
);

bot.onText(
  /\/list_groups/,
  safe("/list_groups", async (msg) => {
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
    const response = await admin.get_user_stats(Factory_Request.fromTelegram(msg));
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/bootstrap_cards/,
  safe("/bootstrap_cards", async (msg) => {
    if (!admin.is_admin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, resp.no_admin_person);
      return;
    }
    await bot.sendMessage(
      msg.chat.id,
      "Subiendo 40 cartas a este chat para cachear los file_ids. Esto toma ~1 minuto.",
    );
    const result = await cards.bootstrap(bot, msg.chat.id);
    await bot.sendMessage(
      msg.chat.id,
      `Bootstrap completo. Subidas: ${result.uploaded}, ya cacheadas: ${result.skipped}, fallidas: ${result.failed}.`,
    );
  }),
);

bot.onText(
  /\/admin/,
  safe("/admin", async (msg) => {
    if (!admin.is_admin(msg.from.id)) {
      await bot.sendMessage(msg.chat.id, resp.no_admin_person);
      return;
    }
    const view = await adminUI.listView();
    await bot.sendMessage(msg.chat.id, view.message, view.options);
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
    const admins = await bot.getChatAdministrators(msg.chat.id);
    const isChatAdmin = admins && admins.some((a) => a.user.id == msg.from.id);
    if (!isChatAdmin) {
      await bot.sendMessage(msg.chat.id, resp.user_is_not_admin, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    const response = await game.create(Factory_Request.fromTelegram(msg), true);
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/unirse/,
  safe("/unirse", async (msg) => {
    const response = await game.join(Factory_Request.fromTelegram(msg));
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/iniciar/,
  safe("/iniciar", async (msg) => {
    const response = game.start(Factory_Request.fromTelegram(msg));
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
    const response = await game.shuffle(Factory_Request.fromTelegram(msg), false);
    if (response) {
      await bot.sendMessage(msg.chat.id, response.message, response.options);
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
    const response = await game.status(Factory_Request.fromTelegram(msg));
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/configurar/,
  safe("/configurar", async (msg) => {
    const response = await game.config(Factory_Request.fromTelegram(msg));
    await bot.sendMessage(msg.chat.id, response.message, response.options);
  }),
);

bot.onText(
  /\/configura(.*) (.*) (.*)/,
  safe("/configura", async (msg, match) => {
    const response = await game.set_settings(Factory_Request.fromTelegram(msg), match[2], match[3]);
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
]);

