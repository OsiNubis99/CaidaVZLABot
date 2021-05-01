const User = require("./User");
const Card = require("./Card");
const resp = require("../lang/es");
const Config = require("./Config");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");
const Sings = require("./Sings");

class Game {
  config = Config.prototype;
  deck = Array(Number.prototype);
  deck = Array(Number.prototype);
  decks = Number.prototype;
  last_card_played = Card.prototype;
  last_hand = Boolean.prototype;
  last_player_on_take = Boolean.prototype;
  name = String.prototype;
  users = Array(User.prototype);
  player = Number.prototype;
  points = Array(Number.prototype);
  table = Array(Card.prototype);
  took = Array(Number.prototype);

  /**
   * Create a Game Object
   * @param {String} name - Group Name where the game is running.
   * @param {Config} config - Configs of the group.
   */
  constructor(name, config) {
    this.config = config;
    this.deck = new Array();
    this.decks = 0;
    this.last_card_played = null;
    this.last_hand = false;
    this.last_player_on_take = null;
    this.name = name;
    this.users = new Array();
    this.player = 0;
    this.points = new Array(4);
    this.table = new Array(10);
    this.took = new Array(4);
  }

  /**
   * @returns The number of the last player on play.
   */
  last_player() {
    let last = this.player - 1;
    return last < 0 ? this.users.length - 1 : last;
  }

  /**
   * @returns the current player game.
   */
  playerName() {
    return this.users[this.player].first_name;
  }

  /**
   * Add a new user and return the status of the game.
   * @param {User} user - User to be Added
   * @returns GamePrototype.Print(false)
   */
  join(user) {
    this.users.push(user);
    return this.print(false);
  }

  /**
   * Shuffle and save all cards generators on the Deck and increment decks played.
   */
  shuffle() {
    this.decks++;
    this.deck = [
      11,
      10,
      38,
      19,
      25,
      18,
      14,
      2,
      5,
      39,
      8,
      15,
      29,
      24,
      30,
      1,
      12,
      16,
      9,
      35,
      22,
      32,
      6,
      4,
      0,
      27,
      37,
      17,
      28,
      33,
      21,
      3,
      23,
      34,
      20,
      7,
      31,
      36,
      26,
      13,
    ];
    var currentIndex = this.deck.length,
      temporaryValue,
      randomIndex;
    while (0 !== currentIndex) {
      currentIndex -= 1;
      randomIndex = Math.floor(Math.random() * currentIndex);
      temporaryValue = this.deck[currentIndex];
      this.deck[currentIndex] = this.deck[randomIndex];
      this.deck[randomIndex] = temporaryValue;
    }
    this.users[this.player].cards = [1, 4];
  }

  /**
   * @param {Number} number - Number of cards to be added.
   */
  get_cards(number = 3) {
    if (number > 0) {
      this.users.forEach((user) => {
        user.add_card(this.deck.shift(), this.config);
      });
      this.get_cards(number - 1);
    }
  }

  /**
   * @param {String} id_user
   * @returns {Array<Card|Sings>}
   */
  get_player_cards(id_user) {
    let cards = [];
    this.users.forEach((user) => {
      if (user.id_user == id_user) cards = user.cards;
      if (user.cards.length == 3 && !user.sing.active && user.sing.value > 0)
        cards.push(user.sing);
    });
    return cards;
  }

  /**
   * @param {Boolean} short_status - Only send the game status without teams information
   * @returns Printable message with the game and teams information
   */
  print(short_status = true) {
    let response = "";
    let is_running = this.decks != 0;
    if (is_running) {
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
      response += "\nSiguiente: " + this.playerName();
    } else {
      response += resp.game_no_started;
    }
    if (short_status) {
      return response;
    }
    if (this.config.type == "parejas") {
      response += "\nEquipo " + (this.decks % 2 == 0 ? "Rojo" : "Azul");
      if (is_running)
        response +=
          "\n\t\tPuntos: " + this.points[0] + " Tomado: " + this.took[0];
      response += this.users[0]
        ? "\n\t" + this.users[0].print(is_running)
        : "\n\tVacío";
      response += this.users[2]
        ? "\n\t" + this.users[2].print(is_running)
        : "\n\tVacío";
      response += "\nEquipo " + (this.decks % 2 == 1 ? "Rojo" : "Azul");
      if (is_running)
        response +=
          "\n\t\tPuntos: " + this.points[1] + " Tomado: " + this.took[1];
      response += this.users[1]
        ? "\n\t" + this.users[1].print(is_running)
        : "\n\tVacío";
      response += this.users[3]
        ? "\n\t" + this.users[3].print(is_running)
        : "\n\tVacío";
    } else {
      response += this.users[0]
        ? "\nEquipo de " +
          this.users[0].print(is_running) +
          (is_running
            ? +"\n\tPuntos: " + this.points[0] + " Tomado: " + this.took[0]
            : "")
        : "";
      response += this.users[1]
        ? "\nEquipo de " +
          this.users[1].print(is_running) +
          (is_running
            ? +"\n\tPuntos: " + this.points[1] + " Tomado: " + this.took[1]
            : "")
        : "";
      response += this.users[2]
        ? "\nEquipo de " +
          this.users[2].print(is_running) +
          (is_running
            ? +"\n\tPuntos: " + this.points[2] + " Tomado: " + this.took[2]
            : "")
        : "";
      response += this.users[3]
        ? "\nEquipo de " +
          this.users[3].print(is_running) +
          (is_running
            ? +"\n\tPuntos: " + this.points[3] + " Tomado: " + this.took[3]
            : "")
        : "";
    }
    return response;
  }

  /**
   * Return the full message and options to setup and start the game.
   * @param {Number|Boolean} message_id - The id of a message to be edited.
   * @param {Number} chat_id - The id of a chat of the message.
   * @returns Telegram Message and Options
   */
  print_before_game(message_id, chat_id = null) {
    let players = this.users.length;
    let type =
      players == 4
        ? this.config.type == "parejas"
          ? "individual"
          : "en parejas"
        : false;
    let response = this.config.print_before_game(players);
    let kboard = keyboard.list_game_modes_and_run(
      type,
      this.config.get_game_modes()
    );
    return message_id
      ? message.edit_keyboard(response, message_id, chat_id, kboard)
      : message.keyboard(response, kboard);
  }
}

module.exports = Game;
