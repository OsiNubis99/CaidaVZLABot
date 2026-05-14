const TelegramBot = require("node-telegram-bot-api");
const GroupDTO = require("./GroupDTO");
const UserDTO = require("./UserDTO");

/**
 * DTO bundling the Telegram message metadata used across handlers:
 * the message_id, the sender (UserDTO), the chat (GroupDTO) and, if
 * applicable, the message being replied to (recursive RequestDTO).
 */
class RequestDTO {
  constructor(message_id, user, reply_to, group) {
    this.message_id = message_id || false;
    this.user = user;
    this.reply_to = reply_to;
    this.group = group;
  }

  /**
   * @param {TelegramBot.Message} message
   * @returns {RequestDTO}
   */
  static fromTelegram(message) {
    let reply_to = undefined;
    if (message.reply_to_message) {
      reply_to = this.fromTelegram(message.reply_to_message);
    }
    const user = UserDTO.fromTelegram(message.from);
    const group = GroupDTO.fromTelegram(message.chat);
    return new RequestDTO(message.message_id, user, reply_to, group);
  }
}

module.exports = RequestDTO;
