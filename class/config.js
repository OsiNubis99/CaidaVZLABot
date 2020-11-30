class Config {
  constructor(chat) {
    this.points = chat.points;
    this.mode = chat.mode;
    this.caida = chat.caida;
    this.ronda = chat.ronda;
    this.chiguire = chat.chiguire;
    this.patrulla = chat.patrulla;
    this.vigia = chat.vigia;
    this.registro = chat.registro;
    this.maguaro = chat.maguaro;
    this.registrico = chat.registrico;
    this.casa_chica = chat.casa_chica;
    this.casa_grande = chat.casa_grande;
    this.trivilin = chat.trivilin;
  }
  get_points() {
    return "\n\t\t\tHasta " + this.points + " puntos";
  }
  get_mode() {
    return "\n\t\t\tTipo de partida(4): " + this.mode;
  }
  get_caida() {
    return "\n\t\t\tCaida: X" + this.caida;
  }
  get_ronda() {
    return "\n\t\t\tRonda: X" + this.ronda;
  }
  get_chiguire() {
    return "\n\t\t\tChiguire: " + this.chiguire;
  }
  get_patrulla() {
    return "\n\t\t\tPatrulla: " + this.patrulla;
  }
  get_vigia() {
    return "\n\t\t\tVigia: " + this.vigia;
  }
  get_registro() {
    return "\n\t\t\tRegistro: " + this.registro;
  }
  get_maguaro() {
    return "\n\t\t\tMaguaro: " + this.maguaro;
  }
  get_registrico() {
    return "\n\t\t\tRegistrico: " + this.registrico;
  }
  get_casa_chica() {
    return "\n\t\t\tCasa Chica: " + this.casa_chica;
  }
  get_casa_grande() {
    return "\n\t\t\tCasa Grande: " + this.casa_grande;
  }
  get_trivilin() {
    return "\n\t\t\tTrivilin: " + this.trivilin;
  }
  print() {
    return (
      "Configuracion actual del Chat" +
      this.get_points() +
      this.get_mode() +
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
  is_ok(config, value) {
    if (config == "mode") {
      if (value == "parejas" || value == "individual") {
        return true;
      }
      return false;
    }
    if (typeof this[config] === "number") {
      let min = 0;
      let max = 100;
      if (config == "points") min = 1;
      return value <= max && value >= min;
    }
    return false;
  }
}
module.exports = Config;
