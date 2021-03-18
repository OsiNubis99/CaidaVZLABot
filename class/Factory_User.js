const TelegramBot = require("node-telegram-bot-api");

class Factory_User {
  id_user = String.prototype;
  first_name = String.prototype;
  last_name = String.prototype;
  username = String.prototype;
  finished = Number.prototype;
  win = Number.prototype;
  sings = Number.prototype;
  caida = Number.prototype;
  caido = Number.prototype;
  is_banned = Boolean.prototype;

  /**
   * @param {TelegramBot.User} telegramUser
   * @returns A User element
   */
  static fromTelegram(telegramUser) {
    return {
      id_user: telegramUser.id.toString(),
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      username: telegramUser.username,
    };
  }
}
module.exports = Factory_User;
