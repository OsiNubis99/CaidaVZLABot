const User = require("./User");
const Card = require("./Card");
const Sings = require("./Sings");
const resp = require("../lang/es");
const Config = require("./Config");
const UserDatabase = require("../database/user");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");

class Game {
  config = Config.prototype;
  deck = Array(Number.prototype);
  deck = Array(Number.prototype);
  decks = Number.prototype;
  last_card_played = Card.prototype;
  last_hand = Boolean.prototype;
  last_player_on_take = Number.prototype;
  name = String.prototype;
  users = Array(User.prototype);
  player = Number.prototype;
  points = Array(Number.prototype);
  table = Array(Card.prototype);
  table_order = String.prototype;
  took = Array(Number.prototype);

  /**
   * Create a Game Object
   * @param {String} name - Group Name where the game is running.
   * @param {Config} config - Configs of the group.
   */
  constructor(name, config) {
    this.config = config;
    this.name = name;
    this.deck = new Array();
    this.decks = 0;
    this.last_card_played = null;
    this.last_hand = false;
    this.last_player_on_take = 0;
    this.users = new Array();
    this.player = 0;
    this.points = new Array();
    this.table = new Array(10);
    this.table_order = "";
    this.took = [0, 0, 0, 0];
  }

  /**
   * @returns The number of the last player on play.
   */
  last_player() {
    let last = this.player - 1;
    return last < 0 ? this.users.length - 1 : last;
  }

  /**
   * @returns {String} the current player name.
   */
  playerName() {
    if (this.users[this.player] && this.users[this.player].first_name)
      return this.users[this.player].first_name;
    return null
  }

  /**
   * Add a new user and return the status of the game.
   * @param {User} user - User to be Added
   * @returns
   */
  join(user) {
    this.users.push(user);
    return this.print(false);
  }

  /**
   * @param {String} id_user
   * @returns {Array<Card|Sings>}
   */
  get_player_cards(id_user) {
    for (let i in this.users) {
      if (this.users[i].id_user == id_user) {
        if (this.users[i].cards.length == 3 && !this.users[i].sing.active && this.users[i].sing.value > 0)
          return this.users[i].cards.concat(this.users[i].sing);
        return this.users[i].cards;
      }
    };
    return [];
  }

  /**
   * @param {String} id_user - the id of the request player
   * @returns {Number} - User index
   */
  get_user_index(id_user, index = 0) {
    if (this.users.length > index) {
      if (this.users[index].id_user == id_user) return index;
      return this.get_user_index(id_user, index + 1);
    }
    return -1;
  }

  /**
   * @param {String} id_user - the id of the player that is sing
   * @returns
   */
  sing(id_user) {
    var user_index = this.get_user_index(id_user);
    if (user_index >= 0) {
      return this.users[user_index].set_sing();
    }
    return resp.no_game_description;
  }

  /**
   * Extract the first card to the game deck
   * and validate if it's already on the table and if it's sync to the user prediction.
   * @param {Number} next_card - User prediction next card value.
   * @returns {Number} - The value of next_card if is sync with the card extracted
   */
  push_cards(next_card, save = false) {
    let card = new Card(this.deck.shift());
    if (this.table[card.position] != null) {
      this.deck.push(card.number);
      return this.push_cards(next_card, save);
    } else {
      this.table[card.position] = card;
      this.table_order += card.value + (save ? "\n" : " -> ");
      if (save) this.last_card_played = card; // TODO disable if config caida_en_mesa is down
      if (card.value == next_card) return next_card;
      return 0;
    }
  }

  /**
   * TODO Pretty comment
   * @param {Number} number - Number of cards to be added.
   * @param {Number} next_card - Number of the next card in the table
   * @param {Boolean} desc - true : 4 to 1, false 1 to 4
   */
  new_cards(number, next_card, desc) {
    if (number > 0) {
      let points = next_card != 0 ? this.push_cards(next_card) : 0;
      this.users.forEach(user => user.add_card(new Card(this.deck.shift()), this.config));
      if (next_card != 0) next_card = desc ? next_card - 1 : next_card + 1;
      return points + this.new_cards(number - 1, next_card, desc);
    } else {
      return next_card != 0 ? this.push_cards(next_card, true) : 0;
    }
  }

  increase_points(player, points) {
    var position = this.config.type == "parejas" ? player % 2 : player;
    if (!this.points[position])
      this.points[position] = points;
    else
      this.points[position] += points;
    return this.points[player] >= this.config.points;
  }

  /**
   * Shuffle and save all cards generators on the Deck and increment decks played.
   */
  shuffle() {
    this.decks++;
    this.deck = [
      11, 10, 38, 19, 25, 18, 14, 2, 5, 39, 8, 15, 29, 24, 30, 1, 12, 16, 9, 35,
      22, 32, 6, 4, 0, 27, 37, 17, 28, 33, 21, 3, 23, 34, 20, 7, 31, 36, 26, 13,
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
    this.users[this.users.length - 1].cards = ["Start_By"];
    return resp.start_by;
  }

  handing_out_cards(start_by, added = "") {
    var sings = [0, 0, 0, 0];
    var biggest = 0;
    this.users.forEach((user, index) => {
      if (user.sing && user.sing.active) {
        sings[index] = user.sing.value;
        if (user.sing.value > sings[biggest]) biggest = index;
      }
    });
    if (sings[biggest] > 0 && this.increase_points(biggest, sings[biggest]))
      return this.kill(biggest);
    if (this.points[0] >= this.config.points) return this.kill(0);
    if (this.points[1] >= this.config.points) return this.kill(1);
    if (this.points[2] >= this.config.points) return this.kill(2);
    if (this.points[3] >= this.config.points) return this.kill(3);
    if (this.deck.length > 0) {
      this.users[this.users.length - 1].cards = [];
      this.table_order = "";
      let points = this.new_cards(3, start_by, start_by > 2);
      added += this.table_order;
      if (points > 0) {
        if (this.increase_points(this.users.length - 1, points))
          return this.kill(this.users.length - 1);
        added += resp.sync_cards + points + "\n";
      } else {
        if (start_by > 0) {
          if (this.increase_points(0, 1)) return this.kill(0);
          added += resp.bad_sync_cards;
        }
      }
      if (this.deck.length == 0) {
        this.last_hand = true;
      }
      return added + this.print(false);
    }
    for (let position = 0; position < this.table.length; position++) {
      if (this.table[position] != null) this.took[this.last_player_on_take]++;
      this.table[position] = null;
    }
    if (this.users.length == 4 && this.config.type != "parejas") {
      if (this.took[0] > 10 && this.increase_points(0, this.took[0] - 10))
        return this.kill(0);
      if (this.took[1] > 10 && this.increase_points(1, this.took[1] - 10))
        return this.kill(1);
      if (this.took[2] > 10 && this.increase_points(2, this.took[2] - 10))
        return this.kill(2);
      if (this.took[3] > 10 && this.increase_points(3, this.took[3] - 10))
        return this.kill(3);
    } else if (this.users.length == 3) {
      if (this.took[0] > 14 && this.increase_points(0, this.took[0] - 14))
        return this.kill(0);
      if (this.took[1] > 13 && this.increase_points(1, this.took[1] - 13))
        return this.kill(1);
      if (this.took[2] > 13 && this.increase_points(2, this.took[2] - 13))
        return this.kill(2);
    } else {
      if (this.took[0] > 20 && this.increase_points(0, this.took[0] - 20))
        return this.kill(0);
      if (this.took[1] > 20 && this.increase_points(1, this.took[1] - 20))
        return this.kill(1);
    }
    this.last_player_on_take = 0;
    this.took = [0, 0, 0, 0];
    this.users.push(this.users.shift());
    this.points.push(this.points.shift());
    this.last_hand = false;
    this.last_card_played = null;
    return added + this.shuffle();
  }

  play_card(id_user, number) {
    /**
     * @type {User}
     */
    if (this.users[this.player].id_user == id_user) {
      let card = this.users[this.player].play(number);
      if (card) {
        var card_position = card.position;
        var took = 1;
        var response = "";
        if (this.table[card_position] != null) {
          while (this.table[card_position] != null) {
            this.table[card_position] = null;
            card_position++;
            took++;
          }
        } else {
          this.table[card_position] = card;
        }
        if (took > 1) {
          // Took something
          this.took[
            this.config.type == "parejas" ? this.player % 2 : this.player
          ] += took;
          this.last_player_on_take = this.player;
          if (
            this.last_card_played &&
            this.last_card_played.position == card.position
          ) {
            // is fall down
            if (this.config.caida > 0) {
              this.users[this.last_player()].caido += 1;
              this.users[this.player].caida += 1;
              if (this.increase_points(this.player, card.points * this.config.caida))
                return this.kill(this.player);
              response = resp.user_get_fall;
              if (this.config.mata_canto == "on") {
                if (this.users[this.last_player()].sing.active)
                  response += resp.sing_killed;
                this.users[this.last_player()].sing.active = false;
              }
            }
          }
          if (!this.last_hand) {
            var clean = true;
            this.table.forEach((card) => {
              if (card != null) clean = false;
            });
            if (clean) {
              if (this.increase_points(this.player, 1 * this.config.mesa))
                return this.kill(this.player);
              response += resp.clean_table;
            }
          }
        }
        this.last_card_played = card;
        this.player = (this.player + 1) % this.users.length;
        if (this.users[this.users.length - 1].cards.length > 0)
          return response + this.print();
        return this.handing_out_cards(0, response);
      }
      return resp.invalid_value;
    }
    return resp.bad_turn;
  }

  /**
   *
   * @returns Printable message with the game information
   */
  kill(player) {
    let win = this.config.game_mode > 0 ? 1 : 2
    for (var i = 0; i < this.users.length; ++i) {
      let user = this.users[i]
      let comparate = this.config.type == "parejas" ? i % 2 : i
      let user_win = player == comparate ? win : 0
      UserDatabase.set_stats(user.id_user, user_win, user.sings, user.caida, user.caido)
    }
    var response =
      "Gano "
    response += this.users[player].print(false)
    this.deck = new Array();
    this.decks = 0;
    response += "\n" + this.print(false, false);
    this.last_card_played = null;
    this.last_hand = false;
    this.last_player_on_take = 0;
    this.users = new Array();
    this.player = 0;
    this.points = new Array();
    this.table = new Array(10);
    this.table_order = "";
    this.took = [0, 0, 0, 0];
    return response;
  }

  /**
   * @param {Boolean} short_status - Only send the game status without teams information
   * @returns Printable message with the game and teams information
   */
  print(short_status = true, no_started = true) {
    let response = "";
    let is_running = this.decks > 0;
    if (is_running) {
      response += this.last_hand ? "Ultimas!\n" : "";
      response += "Mesa:";
      this.table.forEach((item) => {
        if (item != null) response += " " + item.value;
        else response += " []";
      });
      if (this.last_card_played) {
        response +=
          "\nUltima carta: " +
          this.last_card_played.value +
          " de " +
          this.last_card_played.type;
      }
      response += "\nSiguiente: " + this.playerName();
    } else {
      if (no_started)
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
        ? "\nJugador 1: " +
        this.users[0].print(is_running) +
        (is_running
          ? "\n\tPuntos: " + this.points[0] + " Tomado: " + this.took[0]
          : "")
        : "";
      response += this.users[1]
        ? "\nJugador 2: " +
        this.users[1].print(is_running) +
        (is_running
          ? "\n\tPuntos: " + this.points[1] + " Tomado: " + this.took[1]
          : "")
        : "";
      response += this.users[2]
        ? "\nJugador 3: " +
        this.users[2].print(is_running) +
        (is_running
          ? "\n\tPuntos: " + this.points[2] + " Tomado: " + this.took[2]
          : "")
        : "";
      response += this.users[3]
        ? "\nJugador 4: " +
        this.users[3].print(is_running) +
        (is_running
          ? "\n\tPuntos: " + this.points[3] + " Tomado: " + this.took[3]
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
