const resp = require("../lang/es");
const game_modes = require("../lang/game_modes_es");
const GroupDTO = require("./GroupDTO");

// Stored fields (set in constructor via set_game_mode + the visual/turbo
// extras below): game_mode, points, type, caida_continua, mata_canto,
// mata_mesa, mesa, caida, ronda, chiguire, patrulla, vigia, registro,
// maguaro, registrico, casa_chica, casa_grande, trivilin, visual_cards,
// visual_table, turn_timeout_seconds, locale.
class Config {
  /**
   * Create a Config Object
   * @param {GroupDTO} new_config - Object with all configs.
   */
  constructor(new_config) {
    this.set_game_mode(new_config);
    // Render flags live on the group row (not on game_mode presets) so
    // changing the mode does not toggle visuals off.
    this.visual_cards = new_config.visual_cards !== false;
    this.visual_table = new_config.visual_table !== false;
    this.audio_effects = new_config.audio_effects !== false;
    this.turn_timeout_seconds = Number(new_config.turn_timeout_seconds) || 0;
    this.locale = new_config.locale || "es";
  }
  get_game_mode() {
    return (
      "Modo de Juego: " +
      game_modes[this.game_mode].name +
      "\n  " +
      game_modes[this.game_mode].description
    );
  }
  get_points() {
    return "\n\t\tHasta " + this.points + " puntos";
  }
  get_mesa() {
    return "\n\t\tMesa: Valor " + this.mesa + " puntos";
  }
  get_type() {
    return "\n\t\tTipo de partida: " + this.type;
  }
  get_caida_continua() {
    return "\n\t\tCaida continua: " + this.caida_continua;
  }
  get_mata_canto() {
    return "\n\t\tCaida mata canto: " + this.mata_canto;
  }
  get_mata_mesa() {
    return "\n\t\tCaida mata mesa: " + this.mata_mesa;
  }
  get_caida() {
    return "\n\t\tCaida: Valor x" + this.caida;
  }
  get_ronda() {
    return "\n\t\tRonda: Valor x" + this.ronda;
  }
  get_chiguire() {
    return "\n\t\tChiguire: " + this.chiguire;
  }
  get_patrulla() {
    return "\n\t\tPatrulla: " + this.patrulla;
  }
  get_vigia() {
    return "\n\t\tVigia: " + this.vigia;
  }
  get_registro() {
    return "\n\t\tRegistro: " + this.registro;
  }
  get_maguaro() {
    return "\n\t\tMaguaro: " + this.maguaro;
  }
  get_registrico() {
    return "\n\t\tRegistrico: " + this.registrico;
  }
  get_casa_chica() {
    return "\n\t\tCasa Chica: " + this.casa_chica;
  }
  get_casa_grande() {
    return "\n\t\tCasa Grande: " + this.casa_grande;
  }
  get_trivilin() {
    return "\n\t\tTrivilin: " + this.trivilin;
  }

  /**
   * @returns Full info about the Game configs
   */
  print() {
    // caida_continua: implemented in Game.handing_out_cards.
    // mata_mesa: still a no-op; shown for completeness, will work once
    // wired through Game.play_card.
    return (
      "Configuración actual del Chat" +
      this.get_points() +
      this.get_mesa() +
      this.get_type() +
      this.get_caida_continua() +
      this.get_mata_canto() +
      this.get_mata_mesa() +
      "\nMultiplicadores" +
      this.get_caida() +
      this.get_ronda() +
      "\nCantos" +
      this.get_chiguire() +
      this.get_patrulla() +
      this.get_vigia() +
      this.get_registro() +
      this.get_maguaro() +
      this.get_registrico() +
      this.get_casa_chica() +
      this.get_casa_grande() +
      this.get_trivilin() +
      "\nVisuales" +
      "\n\t\tCartas con imagen: " + (this.visual_cards ? "on" : "off") +
      "\n\t\tMesa con imagen: " + (this.visual_table ? "on" : "off") +
      "\nTurno" +
      "\n\t\tTimeout por turno: " + (this.turn_timeout_seconds > 0 ? this.turn_timeout_seconds + "s" : "off") +
      "\n\t\tIdioma: " + this.locale
    );
  }

  /**
   * Validate a value to a specific config and if it's OK then set up it.
   * @param {String} config - Specific config to be validated and updated.
   * @param {String|Number} value - Value to tested.
   * @returns true if the value is ok. Else return the specific error message.
   */
  is_not_ok(config, value) {
    // caida_continua is now implemented (see Game.handing_out_cards).
    // mata_mesa is still a no-op in the game logic — keeping it as a
    // settable boolean so presets can carry it for forward-compat, but
    // changing the value mid-game does nothing until somebody wires it
    // through Game.play_card. Once implemented, drop this comment.
    if (config == "caida_continua" || config == "mata_mesa") {
      if (value == "on" || value == "off") {
        this[config] = value;
        this.game_mode = 0;
        return false;
      }
      return resp.config_bool_invalid;
    }
    if (config == "type") {
      if (value == "parejas" || value == "individual") {
        this[config] = value;
        this.game_mode = 0;
        return false;
      }
      return resp.config_type_invalid;
    }
    if (config == "mata_canto") {
      if (value == "on" || value == "off") {
        this[config] = value;
        this.game_mode = 0;
        return false;
      }
      return resp.config_bool_invalid;
    }
    if (config == "visual_cards" || config == "visual_table" || config == "audio_effects") {
      if (value == "on" || value == "off") {
        this[config] = value == "on";
        return false;
      }
      return resp.config_bool_invalid;
    }
    if (config == "turn_timeout_seconds" || config == "turn_timeout") {
      const n = parseInt(value, 10);
      if (Number.isInteger(n) && n >= 0 && n <= 600) {
        this.turn_timeout_seconds = n;
        return false;
      }
      return resp.config_number_invalid;
    }
    if (config == "locale") {
      if (value === "es" || value === "en" || value === "pt") {
        this.locale = value;
        return false;
      }
      return resp.config_locale_invalid;
    }
    if (typeof this[config] === "number") {
      let min = 0;
      let max = 100;
      if (config == "points") min = 1;
      if (config == "caida" || config == "ronda") max = 10;
      if (min <= value && value <= max) {
        this[config] = value;
        this.game_mode = 0;
        return false;
      }
      return resp.config_number_invalid;
    }
    return resp.config_undefined;
  }

  /**
   * If new_mode is a number then take all configs from store else it's should be a GroupDTO object with all configs to be set.
   * @param {GroupDTO|Number} new_mode
   */
  set_game_mode(new_mode) {
    if (typeof new_mode === "number") new_mode = game_modes[new_mode];
    this.game_mode = new_mode.game_mode;
    this.points = new_mode.points;
    this.type = new_mode.type;
    this.caida_continua = new_mode.caida_continua;
    this.mata_canto = new_mode.mata_canto;
    this.mata_mesa = new_mode.mata_mesa;
    this.mesa = new_mode.mesa;
    this.caida = new_mode.caida;
    this.ronda = new_mode.ronda;
    this.chiguire = new_mode.chiguire;
    this.patrulla = new_mode.patrulla;
    this.vigia = new_mode.vigia;
    this.registro = new_mode.registro;
    this.maguaro = new_mode.maguaro;
    this.registrico = new_mode.registrico;
    this.casa_chica = new_mode.casa_chica;
    this.casa_grande = new_mode.casa_grande;
    this.trivilin = new_mode.trivilin;
  }

  /**
   * @param {Number} players - How many players is playing.
   * @returns Printable before game message.
   */
  print_before_game(players) {
    let response = "";
    if (players == 4) {
      response += this.get_type();
      response += "\n";
    }
    response += this.get_game_mode();
    return response;
  }

  /**
   * @returns an Array with name and number of all game_mode in the store.
   */
  get_game_modes() {
    let response = [];
    game_modes.forEach((element) => {
      if (element.game_mode != 0) {
        response.push({ name: element.name, number: element.game_mode });
      }
    });
    return response;
  }
}
module.exports = Config;
