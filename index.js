const bot = require("./configs/bot");
const app = require("./configs/server");
const admin = require("./middleware/admin");
const kb = require("node-telegram-keyboard-wrapper");

bot.onText(/\/banplayer/, (msg) => {
  bot.sendMessage(msg.chat.id, admin.ban_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/crear/, (msg) => {
  bot.sendMessage(msg.chat.id, admin.create(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/listplayers/, async (msg) => {
  bot.sendMessage(msg.chat.id, await admin.list_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/unirse/, (msg) => {
  bot.sendMessage(msg.chat.id, admin.join(msg), {
    reply_to_message_id: msg.message_id,
  });
});

bot.onText(/\/unbanplayer/, (msg) => {
  bot.sendMessage(msg.chat.id, admin.unban_user(msg), {
    reply_to_message_id: msg.message_id,
  });
});

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
