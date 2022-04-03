const resp = require("../lang/es");
const game_modes = require("../lang/game_modes_es");
const Factory_Group = require("./Factory_Group");

class Config {
  game_mode = Number.prototype;
  points = Number.prototype;
  type = String.prototype;
  caida_continua = String.prototype;
  mata_canto = String.prototype;
  mata_mesa = String.prototype; // TODO add this function and caida_en_mesa
  mesa = Number.prototype;
  caida = Number.prototype;
  ronda = Number.prototype;
  chiguire = Number.prototype;
  patrulla = Number.prototype;
  vigia = Number.prototype;
  registro = Number.prototype;
  maguaro = Number.prototype;
  registrico = Number.prototype;
  casa_chica = Number.prototype;
  casa_grande = Number.prototype;
  trivilin = Number.prototype;

  /**
   * Create a Config Object
   * @param {Factory_Group} new_config - Object with all configs.
   */
  constructor(new_config) {
    this.set_game_mode(new_config);
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
    return "\n\t\tCaida mata canto: " + this.mata_canto;
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
      this.get_trivilin()
    );
  }

  /**
   * Validate a value to a specific config and if it's OK then set up it.
   * @param {String} config - Specific config to be validated and updated.
   * @param {String|Number} value - Value to tested.
   * @returns true if the value is ok. Else return the specific error message.
   */
  is_not_ok(config, value) {
    if (config == "type") {
      if (value == "parejas" || value == "individual") {
        this[config] = value;
        this.game_mode = 0;
        return false;
      }
      return resp.config_type_invalid;
    }
    if (
      config == "caida_continua" ||
      config == "mata_canto" ||
      config == "mata_mesa"
    ) {
      if (value == "on" || value == "off") {
        this[config] = value;
        this.game_mode = 0;
        return false;
      }
      return resp.config_bool_invalid;
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
   * If new_mode is a number then take all configs from store else it's should be a Factory_Group object with all configs to be set.
   * @param {Factory_Group|Number} new_mode
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
