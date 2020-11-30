const resp = require("./lang/es");
const bot = require("./config/server");
const game = require("./middleware/game");
const admin = require("./middleware/admin");

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

bot.on("callback_query", (query) => {
  switch (query.data) {
    case "config":
      bot.editMessageText(resp.how_config, {
        reply_markup: null,
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      });
      break;

    default:
      bot.deleteMessage(query.message.chat.id, query.message.message_id);
      break;
  }
  bot.answerCallbackQuery(query.id);
});

//**                   Admins Commands                   */

bot.onText(/\/addGroup(.*)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.add_group(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/bloquear(.*)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.ban_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/desbloquear(.*)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.unban_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/listGroups(.*)/, async (msg, match) => {
  bot.sendMessage(msg.chat.id, await admin.list_group(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/listPlayers(.*)/, async (msg, match) => {
  bot.sendMessage(msg.chat.id, await admin.list_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/removeGroup(.*)/, (msg, match) => {
  bot.sendMessage(msg.chat.id, admin.remove_group(msg, match), {
    reply_to_message_id: msg.message_id,
  });
});

//**                    Game Commands                    */

bot.onText(/\/crear(.*)/, async (msg, match) => {
  let response = await game.create(msg, false);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/unirse(.*)/, async (msg, match) => {
  bot.sendMessage(msg.chat.id, await game.join(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/set_(.*) (.*)/, async (msg, match) => {
  let response = await game.set_settings(msg, match[1], match[2]);
  bot.sendMessage(msg.chat.id, response.message, response.options);
});

//**                     Set Commands                    */

bot.setMyCommands([
  {
    command: "crear",
    description: "Crea una nueva partida",
  },
  {
    command: "unirse",
    description: "Te agrega a la partida",
  },
]);
