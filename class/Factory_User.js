const TelegramBot = require("node-telegram-bot-api");

/**
 * DTO wrapping the subset of Telegram user data we care about for a
 * Caída player. Game stats (finished, win, sings, caida...) are loaded
 * separately by UserController.
 */
class Factory_User {
  constructor(id_user, first_name, last_name, username) {
    this.id_user = id_user;
    this.first_name = first_name;
    this.last_name = last_name;
    this.username = username;
  }

  /**
   * @param {TelegramBot.User} telegramUser
   * @returns {Factory_User|false} A User element, false when input is missing.
   */
  static fromTelegram(telegramUser) {
    if (telegramUser) {
      const id_user = telegramUser.id.toString();
      const first_name = telegramUser.first_name;
      const last_name = telegramUser.last_name || "";
      const username = telegramUser.username || null;
      return new Factory_User(id_user, first_name, last_name, username);
    }
    return false;
  }
}
module.exports = Factory_User;
