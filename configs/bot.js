const TelegramBot = require('node-telegram-bot-api');
// replace the value below with the Telegram token you receive from @BotFather
const token = '842531207:AAHhw5MRPefOGu165F_pgJhKNYTUeajoW7A';

let bot = new TelegramBot(token, {
	polling: true
});

module.exports = bot;