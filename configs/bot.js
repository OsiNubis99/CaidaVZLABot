const TelegramBot = require("node-telegram-bot-api");
const env = require("./env");

let options = {};
if (env.NODE_ENV == "develop") {
  options = {
    polling: true,
  };
}

const bot = new TelegramBot(env.TOKEN, options);

if (env.NODE_ENV == "production") bot.setWebHook(`${env.url}/bot${env.TOKEN}`);

bot.onText(/\/version/, (msg) => {
  bot.sendMessage(msg.chat.id, version);
});

bot.onText(/\/saluda (.+)/, (msg, match) => {
  let chatId = msg.chat.id;
  let resp = "Hola @" + msg.from.username + "\nTu mensaje fue: " + match[1];
  bot.sendMessage(chatId, resp);
});

bot.on("error", (error) => {
  console.error(error + "\n Error");
});

bot.on("polling_error", (error) => {
  console.error(error + "\n Polling Error");
});

module.exports = { env, bot };
