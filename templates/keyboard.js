const kb = require("node-telegram-keyboard-wrapper");

module.exports = {
  group_settings: new kb.InlineKeyboard()
    .addRow({
      text: "Como configurar",
      callback_data: "how_config",
    })
    .addRow({
      text: "Listo",
      callback_data: "close",
    })
    .extract(),
  change_game_mode_and_back(game_mode) {
    return new kb.InlineKeyboard()
      .addRow({
        text: "Cambiar a " + game_mode.name,
        callback_data: "set_" + game_mode.number,
      })
      .addRow({
        text: "Volver",
        callback_data: "back",
      })
      .extract();
  },
  list_game_modes_and_run(type, game_modes) {
    let response = new kb.InlineKeyboard();
    if (type) {
      response.addRow({
        text: "Jugar " + type,
        callback_data: "type",
      });
    }
    game_modes.forEach((element) => {
      response.addRow({
        text: element.name,
        callback_data: "show_" + element.number,
      });
    });
    response
      .addRow({
        text: "Iniciar",
        callback_data: "run",
      })
      .extract();
    return response;
  },
};
