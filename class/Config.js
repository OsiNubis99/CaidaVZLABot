const resp = require("../lang/es");
const game_modes = require("../lang/game_modes_es");

class Config {
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
  get_mesa() {
    return "\n\t\tMesa: Valor x" + this.mesa;
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
  print() {
    return (
      "Configuración actual del Chat" +
      this.get_points() +
      this.get_type() +
      this.get_caida_continua() +
      this.get_mata_canto() +
      this.get_mata_mesa() +
      "\nMultiplicadores" +
      this.get_mesa() +
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
      if (config == "mesa" || config == "caida" || config == "ronda") max = 10;
      if (min <= value && value <= max) {
        this[config] = value;
        this.game_mode = 0;
        return false;
      }
      return resp.config_number_invalid;
    }
    return resp.config_undefined;
  }
  set_game_mode(new_mode) {
    if (typeof new_mode === "number") new_mode = game_modes[new_mode];
    this.game_mode = new_mode.game_mode;
    this.points = new_config.points;
    this.type = new_config.type;
    this.caida_continua = new_config.caida_continua;
    this.mata_canto = new_config.mata_canto;
    this.mata_mesa = new_config.mata_mesa;
    this.mesa = new_config.mesa;
    this.caida = new_config.caida;
    this.ronda = new_config.ronda;
    this.chiguire = new_config.chiguire;
    this.patrulla = new_config.patrulla;
    this.vigia = new_config.vigia;
    this.registro = new_config.registro;
    this.maguaro = new_config.maguaro;
    this.registrico = new_config.registrico;
    this.casa_chica = new_config.casa_chica;
    this.casa_grande = new_config.casa_grande;
    this.trivilin = new_config.trivilin;
  }
  print_before_game(players) {
    let response = "";
    if (players == 4) {
      response += this.get_type();
      response == "\n";
    }
    response += this.get_game_mode();
    return response;
  }
  get_game_modes() {
    let response = [];
    game_modes.forEach((element) => {
      if (element.game_mode != 0) {
        response.push({ name: element.name, number: element.game_mode });
      }
    });
  }
}
module.exports = Config;
