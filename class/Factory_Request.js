const TelegramBot = require("node-telegram-bot-api");
const Factory_Group = require("./Factory_Group");
const Factory_User = require("./Factory_User");

class Factory_Request {
  message_id = Number.prototype;
  user = Factory_User.prototype;
  reply_to = Factory_Request.prototype;
  group = Factory_Group.prototype;

  constructor(message_id, user, reply_to, group) {
    this.message_id = message_id || false;
    this.user = user;
    this.reply_to = reply_to
    this.group = group;
  }

  /**
   * Get a Telegram Message and return a full Factory_Request.
   * @param {TelegramBot.Message} message - Telegram Message to be converted.
   * @returns {Factory_Request} Standard Response.
   */
  static fromTelegram(message) {
    let reply_to = undefined
    if (message.reply_to_message)
      reply_to = this.fromTelegram(message.reply_to_message)
    let user = Factory_User.fromTelegram(message.from);
    let group = Factory_Group.fromTelegram(message.chat);
    return new Factory_Request(message.message_id, user, reply_to, group);
  }
}
module.exports = Factory_Request;
