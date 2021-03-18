const Card = require("./Card");
const Config = require("./Config");
const Factory_User = require("./Factory_User");
const Sings = require("./Sings");

class User {
  /**
   * Create a User Object
   * @param {Factory_User} factory_user - User to be created
   */
  constructor(factory_user) {
    this.id_user = factory_user.id_user;
    this.first_name = factory_user.first_name;
    this.last_name = factory_user.last_name;
    this.username = factory_user.username;
    this.is_banned = factory_user.is_banned;
    this.cards = [];
    this.caida = 0;
    this.caido = 0;
    this.sings = 0;
    this.sing = new Sings([]);
  }

  /**
   * @param {Boolean} started - Set true if the game is already started.
   * @returns Printable User Information
   */
  print(started) {
    return (
      "@" +
      this.username +
      (started
        ? " Cantó: " +
          this.sing.name +
          (this.sing.value == 0 && this.sing.name != "No cantó" ? "😵" : " ") +
          " Cartas: " +
          this.cards.length
        : "")
    );
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
      if (this.sing.value != 0) this.sings++;
    }
  }
}
module.exports = User;
