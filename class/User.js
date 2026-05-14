const Card = require("./Card");
const Sings = require("./Sings");
const resp = require("../lang/es");
const Config = require("./Config");
const UserDTO = require("./UserDTO");

class User {
  /**
   * Create a User Object
   * @param {UserDTO} factory_user - User to be created
   */
  constructor(factory_user) {
    this.id_user = factory_user.id_user;
    this.first_name = factory_user.first_name;
    this.last_name = factory_user.last_name;
    this.username = factory_user.username;
    this.is_banned = factory_user.is_banned;
    this.cards = new Array();
    this.caida = 0;
    this.caido = 0;
    this.sing = new Sings([]);
  }

  /**
   * @param {Boolean} started - Set true if the game is already started.
   * @param {Object} [lang] - Localized strings table. Falls back to the
   *   global es table when omitted (callers from Game.js pass through
   *   the active group's lang).
   * @returns Printable User Information (one line, no newlines).
   */
  print(started, lang) {
    const L = lang || resp;
    const handle = this.username ? " (@" + this.username + ")" : "";
    let out = this.first_name + handle;
    if (!started) return out;
    const hasActiveSing =
      this.sing && this.sing.active && this.sing.name && this.sing.name !== "No cantó";
    const sang = hasActiveSing ? L.ig_sang_prefix + this.sing.name : L.ig_no_sang;
    out += L.ig_dot_sep + this.cards.length + L.ig_cards_suffix + L.ig_dot_sep + sang;
    return out;
  }

  /**
   * Activate the user sing
   * @returns - Pretty response
   */
  set_sing() {
    this.sing.active = true;
    return this.first_name + " " + resp.did_sing + " " + this.sing.name;
  }

  /**
   * @param {Number} index - Index of the card to be played.
   * @returns false if the index is bad else return the card to be played.
   */
  play(index) {
    if (index >= this.cards.length || index < 0) return false;
    return this.cards.splice(index, 1)[0];
  }

  /**
   * @param {Card} card - New Card to be Added.
   * @param {Config} configs - Group configs.
   */
  add_card(card, configs) {
    this.cards.push(card);
    if (this.cards.length == 3) {
      this.cards.sort((a, b) => {
        return a.position <= b.position ? 1 : -1;
      });
      this.sing = new Sings(this.cards, configs);
    }
  }
}
module.exports = User;
