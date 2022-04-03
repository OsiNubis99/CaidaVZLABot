const { InlineKeyboard } = require("node-telegram-keyboard-wrapper");

module.exports = {
  /**
   * Model a Telegram message and message options.
   * @param {String} message - The text to be send.
   * @param {Number} message_id - The id of a message to reply.
   * @returns Telegram Message and Options
   */
  reply(message, message_id) {
    return {
      message: message,
      options: {
        reply_to_message_id: message_id,
      },
    };
  },

  /**
   * Model a Telegram message and message options.
   * @param {Number} chat_id - The id of a chat of the message.
   * @param {String} message - The text to be send.
   * @param {InlineKeyboard} reply_keyboard - The InlineKeyboard to be added.
   * @returns Telegram Message and Options
   */
  inLine_keyboard(chat_id, message, reply_keyboard) {
    return {
      chat_id: chat_id,
      message: message,
      options: {
        reply_markup: reply_keyboard,
      },
    };
  },

  /**
   * Model a Telegram message and message options.
   * @param {String} message - The text to be send.
   * @param {Number} message_id - The id of a message to be edited.
   * @param {Number} chat_id - The id of a chat of the message.
   * @param {InlineKeyboard} reply_keyboard - The InlineKeyboard to be added.
   * @returns Telegram Message and Options
   */
  edit_keyboard(message, message_id, chat_id, reply_keyboard) {
    return {
      message: message,
      options: {
        reply_markup: reply_keyboard,
        chat_id: chat_id,
        message_id: message_id,
      },
    };
  },

  /**
   * Model a Telegram message and message options.
   * @param {String} message - The text to be send.
   * @param {InlineKeyboard} reply_keyboard - The InlineKeyboard to be added.
   * @returns Telegram Message and Options
   */
  keyboard(message, reply_keyboard) {
    return {
      message: message,
      options: {
        reply_markup: reply_keyboard,
      },
    };
  },
};
