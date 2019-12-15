const TelegramBot = require('node-telegram-bot-api');
// replace the value below with the Telegram token you receive from @BotFather
const token = '842531207:AAGKi7lY-aEygZ-ScVdQSRehkteiz6rB0uA';

let bot = new TelegramBot(token, {polling: true});

module.exports = bot;