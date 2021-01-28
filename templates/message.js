module.exports = {
  reply(message, message_id) {
    return {
      message: message,
      options: {
        reply_to_message_id: message_id,
      },
    };
  },
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
  keyboard(message, reply_keyboard) {
    return {
      message: message,
      options: {
        reply_markup: reply_keyboard,
      },
    };
  },
};
