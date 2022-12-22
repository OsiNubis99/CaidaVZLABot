const TelegramBot = require("node-telegram-bot-api");
const kb = require("node-telegram-keyboard-wrapper");
const Config = require("../class/Config");

module.exports = {
  /**
   * @returns {TelegramBot.InlineKeyboardMarkup} Keyboard with two buttons. 'How to set up' and 'Close'
   */
  group_settings() {
    return new kb.InlineKeyboard()
      .addRow({
        text: "Como configurar",
        callback_data: "how_config",
      })
      .addRow({
        text: "Listo",
        callback_data: "close",
      })
      .extract();
  },

  /**
   * @param {{name:String,number:Number}} game_mode - Game_mode element to be changed
   * @returns {TelegramBot.InlineKeyboardMarkup} Keyboard with two buttons. 'Set game_mode' and 'Back'.
   */
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

  /**
   * @param {String|Boolean} type - The printable name of a game type. 'Individual' or 'Parejas'.
   * @param {Array<Config>} game_modes - Game_mode elements to be pushed.
   * @returns {TelegramBot.InlineKeyboardMarkup} Keyboard with the element passed on type, order every element on couples from game_mode and the Start button.
   */
  list_game_modes_and_run(type, game_modes) {
    let response = new kb.InlineKeyboard();
    if (type) {
      response.addRow({
        text: "Jugar " + type,
        callback_data: "type",
      });
    }
    let temp = false;
    game_modes.forEach((element) => {
      if (temp) {
        response.addRow(temp, {
          text: element.name,
          callback_data: "set_" + element.number,
        });
        temp = false;
      } else {
        temp = {
          text: element.name,
          callback_data: "set_" + element.number,
        };
      }
    });
    if (temp) response.addRow(temp);
    response.addRow({
      text: "Iniciar",
      callback_data: "start",
    });
    return response.extract();
  },

  /**
   * @param {String} player_name - Player name
   * @returns {TelegramBot.InlineKeyboardMarkup} Keyboard with two buttons. 'Set game_mode' and 'Back'.
   */
  make_a_choice(player_name) {
    if (player_name)
      return new kb.InlineKeyboard()
        .addRow({
          text: "Pulsa para escoger " + player_name,
          switch_inline_query_current_chat: "",
        })
        .extract();
    return undefined
  },
};
