const resp = require("./lang/es");
const bot = require("./config/server");
const game = require("./middleware/game");
const admin = require("./middleware/admin");
const keyboard = require("./templates/keyboard");
const user = require("./controller/user");

//**                    InLine Querys                    */

let inline_commands = ["points", "mode", "caida", "ronda", "cantos"];

bot.on("inline_query", async (query) => {
  bot.answerInlineQuery(query.id, await game.get_user_cards(query.from, query));
});

bot.on("chosen_inline_result", (query) => {
  if (query.result_id > 4) {
    cantar(
      {
        from: {
          id: query.from.id,
        },
      },
      [0, query.result_id]
    );
  }
  if (query.result_id < 3) {
    jugarCarta(
      {
        from: {
          id: query.from.id,
        },
      },
      [0, query.result_id]
    );
  }
});

//**                      CallBacks                      */

bot.on("callback_query", async (query) => {
  let response = "";
  bot.answerCallbackQuery(query.id);
  switch (query.data) {
    case "how_config":
      bot.editMessageText(resp.how_config, {
        reply_markup: keyboard.back,
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      });
      break;
    case "back":
      response = await game.config(query.message, true);
      bot.editMessageText(response.message, response.options);
      break;
    case "type":
      response = await game.set_inline_type(query.message);
      if (response) bot.editMessageText(response.message, response.options);
      break;
    default:
      bot.deleteMessage(query.message.chat.id, query.message.message_id);
      break;
  }
});

//**                   Admins Commands                   */

bot.onText(/\/addGroup/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.add_group(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/bloquear/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.ban_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/desbloquear/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.unban_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/listGroups/, async (msg, match) => {
  bot.sendMessage(msg.chat.id, await admin.list_group(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/listUsers/, async (msg, match) => {
  bot.sendMessage(msg.chat.id, await admin.list_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/removeGroup/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.remove_group(msg, match), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/admin/, async (msg) => {
  // await user.add(msg.from);
  // await user.set_statics(msg.from.id, 1, 3, 5, 0);
  // console.log( JSON.stringify(await user.statics(msg.from.id)));
  bot.sendMessage(
    msg.chat.id,
    "/addGroup\n/removeGroup\n/bloquear\n/desbloquear\n/listGroups\n/listUsers"
  );
});

//**                    Game Commands                    */

bot.onText(/\/crear/, async (msg) => {
  let response = await game.create(msg, false);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/limpiar/, async (msg) => {
  let response = await game.create(msg, true);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/unirse/, async (msg) => {
  let response = await game.join(msg);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/iniciar/, async (msg) => {
  let response = await game.join(msg);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/estado/, async (msg) => {
  let response = await game.status(msg);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/configurar/, async (msg) => {
  let response = await game.config(msg);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/set_(.*) (.*)/, async (msg, match) => {
  let response = await game.set_settings(msg, match[1], match[2]);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/set_(.*)/, async (msg, match) => {
  bot.sendMessage(msg.chat.id, resp.set_invalid, response.options);
});

//**                     Set Commands                    */

bot.setMyCommands([
  {
    command: "crear",
    description: "Crea una nueva partida.",
  },
  {
    command: "unirse",
    description: "Te agrega a la partida.",
  },
  {
    command: "iniciar",
    description: "Inicia la partida.",
  },
  {
    command: "estado",
    description: "Muestra información sobre la partida.",
  },
  {
    command: "configurar",
    description: "Muestra el pane de configuración.",
  },
  {
    command: "limpiar",
    description: "Elimina la partida actual y crea una nueva.",
  },
]);
