const TelegramBot = require("node-telegram-bot-api");
const Factory_Group = require("./Factory_Group");
const Factory_User = require("./Factory_User");

class Factory_Response {
  user = Factory_User.prototype;
  message_id = Number.prototype;
  group = Factory_Group.prototype;

  constructor(user, message_id, group) {
    this.user = user;
    this.message_id = message_id || false;
    this.group = group;
  }

  /**
   * Get a Telegram Message and return a full Factory_Response.
   * @param {TelegramBot.Message} msg - Telegram Message to be converted.
   * @returns {Factory_Response} Standard Response.
   */
  static fromTelegram(msg) {
    let user = Factory_User.fromTelegram(msg.from);
    let group = Factory_Group.fromTelegram(msg.chat);
    return new Factory_Response(user, msg.message_id, group);
  }
}
module.exports = Factory_Response;
