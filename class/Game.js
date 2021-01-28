const User = require("./User");
const resp = require("../lang/es");
const Card = require("./Card");
const Config = require("./Config");
const keyboard = require("../templates/keyboard");

class Game {
  config = Config.prototype;
  deck = [0];
  users = Array(User.prototype);
  points = [0];
  table = Array(Card.prototype);
  took = [0];
  constructor(name, config) {
    this.config = config;
    this.deck = new Array();
    this.decks = 0;
    this.last_card_played = Card.prototype;
    this.last_hand = false;
    this.last_player_on_take = false;
    this.name = name;
    this.users = new Array();
    this.player = 0;
    this.points = new Array(4);
    this.table = new Array(10);
    this.took = new Array(4);
  }
  last_player() {
    let last = this.player - 1;
    return last < 0 ? this.users.length - 1 : last;
  }
  join(user) {
    if (this.users.length < 4) {
      this.users.push(user);
      return this.print(true);
    } else return resp.game_is_full;
  }
  print(silent = false) {
    let response = "";
    if (this.decks != 0) {
      response += this.last_hand ? "Ultimas!" : "";
      response += "\nMesa:";
      this.table.forEach((item) => {
        if (item != null) response += " " + item.value;
        else response += " []";
      });
      response +=
        "\nUltima carta: " +
        this.last_card_played.value +
        " de " +
        this.last_card_played.type;
      response +=
        "\nSiguiente: " +
          this.users[this.player].first_name +
          " " +
          this.users[this.player].last_name || "";
    } else if (!silent) {
      response += resp.game_no_started;
    }
    if (this.config.type == "parejas") {
      response += "\nEquipo " + (this.decks % 2 == 0 ? "Rojo" : "Azul");
      if (this.decks != 0)
        response +=
          "\n\t\tPuntos: " + this.points[0] + " Tomado: " + this.took[0];
      response += this.users[0] ? this.users[0].print() : "\n\tVacío";
      response += this.users[2] ? this.users[2].print() : "\n\tVacío";
      response += "\nEquipo " + (this.decks % 2 == 1 ? "Rojo" : "Azul");
      if (this.decks != 0)
        response +=
          "\n\t\tPuntos: " + this.points[1] + " Tomado: " + this.took[1];
      response += this.users[1] ? this.users[1].print() : "\n\tVacío";
      response += this.users[3] ? this.users[3].print() : "\n\tVacío";
    } else {
      response += this.users[0]
        ? this.users[0].print() +
          (this.decks != 0
            ? +"\n\tPuntos: " + this.points[0] + " Tomado: " + this.took[0]
            : "")
        : "";
      response += this.users[1]
        ? this.users[1].print() +
          (this.decks != 0
            ? +"\n\tPuntos: " + this.points[1] + " Tomado: " + this.took[1]
            : "")
        : "";
      response += this.users[2]
        ? this.users[2].print() +
          (this.decks != 0
            ? +"\n\tPuntos: " + this.points[2] + " Tomado: " + this.took[2]
            : "")
        : "";
      response += this.users[3]
        ? this.users[3].print() +
          (this.decks != 0
            ? +"\n\tPuntos: " + this.points[3] + " Tomado: " + this.took[3]
            : "")
        : "";
    }
    return response;
  }
  print_before_game(chat_id, message_id) {
    let players = this.users.length;
    let type =
      players == 4
        ? this.config.type == "parejas"
          ? "individual"
          : "en parejas"
        : false;
    return {
      message: this.config.print_before_game(players),
      message_id: message_id,
      chat_id: chat_id,
      reply_keyboard: keyboard.list_game_modes_and_run(
        type,
        this.config.get_game_modes()
      ),
    };
  }
}

module.exports = Game;
