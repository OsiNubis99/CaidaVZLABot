const TelegramBot = require("node-telegram-bot-api");
const resp = require("../lang/es");

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

  constructor(id_user, first_name, last_name, username) {
    this.id_user = id_user;
    this.first_name = first_name;
    this.last_name = last_name;
    this.username = username;
  }

  /**
   * @param {TelegramBot.User} telegramUser
   * @returns {Factory_User|false} A User element
   */
  static fromTelegram(telegramUser) {
    if (telegramUser) {
      let id_user = telegramUser.id.toString();
      let first_name = telegramUser.first_name;
      let last_name = telegramUser.last_name || "";
      let username = telegramUser.username || null;
      return new Factory_User(id_user, first_name, last_name, username);
    }
    return false;
  }
}
module.exports = Factory_User;
