const TelegramBot = require("node-telegram-bot-api");
const Factory_Group = require("./Factory_Group");
const Factory_User = require("./Factory_User");

class Factory_Request {
  user = Factory_User.prototype;
  message_id = Number.prototype;
  group = Factory_Group.prototype;

  constructor(user, message_id, group) {
    this.user = user;
    this.message_id = message_id || false;
    this.group = group;
  }

  /**
   * Get a Telegram Message and return a full Factory_Request.
   * @param {TelegramBot.Message} message - Telegram Message to be converted.
   * @returns {Factory_Request} Standard Response.
   */
  static fromTelegram(message) {
    let user = Factory_User.fromTelegram(message.from);
    let group = Factory_Group.fromTelegram(message.chat);
    return new Factory_Request(user, message.message_id, group);
  }
}
module.exports = Factory_Request;
