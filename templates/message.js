module.exports = {
  /**
   * Model a Telegram message and message options.
   * @param {*} message - The text to be send.
   * @param {*} message_id - The id of a message to reply.
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
   * @param {*} message - The text to be send.
   * @param {*} message_id - The id of a message to be edited.
   * @param {*} chat_id - The id of a chat of the message.
   * @param {*} reply_keyboard - The InlineKeyboard to be added.
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
   * @param {*} message - The text to be send.
   * @param {*} reply_keyboard - The InlineKeyboard to be added.
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
