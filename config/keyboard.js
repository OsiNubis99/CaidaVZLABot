const kb = require("node-telegram-keyboard-wrapper");

module.exports = {
  group_settings: new kb.InlineKeyboard()
    .addRow({
      text: "Como configurar",
      callback_data: "config",
    })
    .addRow({
      text: "Listo",
      callback_data: "close",
    })
    .extract(),
};
