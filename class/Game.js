const User = require("./User");
const Card = require("./Card");
const Sings = require("./Sings");
const resp = require("../lang/es");
const { getLang } = require("../lang");
const Config = require("./Config");
const UserDatabase = require("../database/user");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");

/**
 * In-memory Game state. Persisted via services/gameSerialize.js — the
 * fields enumerated there (config, deck, decks, last_card_played,
 * last_hand, last_player_on_take, name, users, player, points, table,
 * table_order, took) are the durable shape; this constructor sets the
 * initial values.
 */
class Game {
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
    this.table = [null, null, null, null, null, null, null, null, null, null];
    this.table_order = "";
    this.took = [0, 0, 0, 0];
  }

  /**
   * Resolve the in-game language table from the group's locale. Lazy
   * so locale changes apply without rebuilding the Game.
   */
  _lang() {
    return getLang(this.config && this.config.locale);
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
      if (this.users[user_index].sing.value > 0) {
        UserDatabase.set_sing(this.users[user_index].id_user, this.users[user_index].sing.dbName).catch(() => {})
      }
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
    return this.points[position] >= this.config.points;
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
    // Fisher-Yates shuffle (unbiased)
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    this.markStartByPlayer();
    return resp.start_by;
  }

  /**
   * Tag the dealer/guesser slot with the "Start_By" sentinel so the
   * inline picker offers them the "Iniciar por 1/4" buttons.
   */
  markStartByPlayer() {
    this.users[this.users.length - 1].cards = ["Start_By"];
  }

  /**
   * Choose which {player, threshold} pairs apply for the took-bonus
   * step at the end of a deck. Iteration order is fixed so that if two
   * players cross threshold simultaneously the lower-index one wins
   * (kill short-circuits the loop).
   */
  _selectTookBonusRules() {
    if (this.users.length == 4 && this.config.type != "parejas") {
      return [
        { player: 0, threshold: 10 },
        { player: 1, threshold: 10 },
        { player: 2, threshold: 10 },
        { player: 3, threshold: 10 },
      ];
    }
    if (this.users.length == 3) {
      return [
        { player: 0, threshold: 14 },
        { player: 1, threshold: 13 },
        { player: 2, threshold: 13 },
      ];
    }
    // 2 players, or 4 players in parejas mode — only two scoring slots (0 and 1).
    return [
      { player: 0, threshold: 20 },
      { player: 1, threshold: 20 },
    ];
  }

  handing_out_cards(start_by, added = "") {
    if (this.deck.length > 0) {
      this.player = 0;
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
    // Clean las tabble
    for (let position = 0; position < this.table.length; position++) {
      if (this.table[position] != null) this.took[this.last_player_on_take]++;
      this.table[position] = null;
    }
    // Add took points. Threshold per player depends on player count and
    // game type. Note the 3-player asymmetry: player 0 gets threshold 14
    // while players 1 and 2 use 13 — preserve.
    const tookRules = this._selectTookBonusRules();
    for (const { player, threshold } of tookRules) {
      if (this.took[player] > threshold && this.increase_points(player, this.took[player] - threshold))
        return this.kill(player);
    }
    // Reset table
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
        for (let i = 0; i < this.points.length; i++) {
          if (this.points[i] >= this.config.points) return this.kill(i);
        }
        if (this.users[this.users.length - 1].cards.length > 0) {
          this.player = (this.player + 1) % this.users.length;
          return response + this.print();
        }
        let sings = [0, 0, 0, 0];
        let biggest = 0;
        this.users.forEach((user, index) => {
          if (user.sing && user.sing.active) {
            sings[index] = user.sing.value;
            if (user.sing.value > sings[biggest]) biggest = index;
          }
        });
        if (sings[biggest] > 0) {
          UserDatabase.set_sing(this.users[biggest].id_user, "alive_" + this.users[biggest].sing.dbName).catch(() => {})
          if (this.increase_points(biggest, sings[biggest])) return this.kill(biggest);
        }
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
      // Fire-and-forget: DB failures shouldn't block kill response, but
      // catch the rejection so it doesn't become an unhandledRejection.
      UserDatabase.set_stats(user.id_user, user_win, user.caida, user.caido).catch(() => {})
    }
    const L = this._lang();
    let response = L.ig_won_prefix;
    response += this.users[player].print(false, L);
    this.decks = 0;
    response += "\n" + this.print(false, false);
    return { finished: true, response };
  }

  /**
   * @param {Boolean} short_status - Only send the game status without teams information
   * @returns Printable message with the game and teams information
   */
  print(short_status = true, no_started = true) {
    const is_running = this.decks > 0;
    let response = this._renderHeader(is_running, no_started);
    if (short_status) return response;
    return (
      response +
      (this.config.type == "parejas"
        ? this._renderTeamsParejas(is_running)
        : this._renderTeamsIndividual(is_running))
    );
  }

  _renderHeader(is_running, no_started) {
    const L = this._lang();
    if (!is_running) return no_started ? L.game_no_started : "";
    let response = "";
    if (this.last_hand) response += L.ig_last_hand;
    response += L.ig_mesa_label;
    this.table.forEach((item) => {
      if (item != null) response += " " + item.value;
      else response += L.ig_empty_slot;
    });
    if (this.last_card_played) {
      response +=
        "\n" +
        L.ig_last_card_label +
        this.last_card_played.value +
        L.ig_card_of +
        this.last_card_played.type;
    }
    response += "\n" + L.ig_next_label + this.playerName();
    return response;
  }

  _renderTeamsParejas(is_running) {
    const L = this._lang();
    const out = [];
    // Each pass renders one team. The first listed team is "Rojo" when
    // decks % 2 == 0 and "Azul" otherwise, alternating each deck — same
    // rule as the legacy renderer.
    for (let team = 0; team < 2; team++) {
      const isRed = team === 0 ? this.decks % 2 === 0 : this.decks % 2 === 1;
      const emoji = isRed ? L.ig_team_red_emoji : L.ig_team_blue_emoji;
      const name = isRed ? L.ig_team_red : L.ig_team_blue;
      let header = "\n\n" + emoji + L.ig_team_label + name;
      if (is_running) {
        header +=
          L.ig_dot_sep + (this.points[team] || 0) + L.ig_pts_suffix +
          L.ig_dot_sep + this.took[team] + L.ig_took_suffix;
      }
      out.push(header);
      // Players on this team are at indices [team, team + 2] (0,2 or 1,3).
      for (const idx of [team, team + 2]) {
        const u = this.users[idx];
        if (!u) continue;
        out.push("\n" + L.ig_player_bullet + u.print(is_running, L));
      }
    }
    return out.join("");
  }

  _renderTeamsIndividual(is_running) {
    const L = this._lang();
    const lines = ["\n\n" + L.ig_players_header];
    for (let i = 0; i < this.users.length; i++) {
      const u = this.users[i];
      if (!u) continue;
      let line = "\n" + (i + 1) + ". " + u.print(is_running, L);
      if (is_running) {
        line +=
          L.ig_dot_sep + (this.points[i] || 0) + L.ig_pts_suffix +
          L.ig_dot_sep + this.took[i] + L.ig_took_suffix;
      }
      lines.push(line);
    }
    return lines.join("");
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
