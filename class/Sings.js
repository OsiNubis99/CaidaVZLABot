const Card = require("./Card");
const Config = require("./Config");

class Sings {
  active = Boolean.prototype;
  value = Number.prototype;
  name = String.prototype;

  /**
   * Create a Sings Object
   * @param {Card[]} cards - 3 cards to be tested.
   * @param {Config} config - Configs of the group.
   */
  constructor(cards, config) {
    this.active = false;
    this.value = 0;
    this.name = "No cantó";
    if (cards.length == 3) {
      if (
        cards[0].value == cards[1].value &&
        cards[1].value == cards[2].value
      ) {
        this.value = config.trivilin;
        this.name = "Trivilin";
        this.dbName = "trivilin";
      } else if (
        cards[0].value == 12 &&
        cards[1].value == 12 &&
        cards[2].value == 1
      ) {
        this.value = config.casa_grande;
        this.name = "Casa Grande";
        this.dbName = "casa_grande";
      } else if (
        cards[0].value == 11 &&
        cards[1].value == 11 &&
        cards[2].value == 1
      ) {
        this.value = config.casa_chica;
        this.name = "Casa Chica";
        this.dbName = "casa_chica";
      } else if (
        cards[0].value == 11 &&
        cards[1].value == 10 &&
        cards[2].value == 1
      ) {
        this.value = config.registrico;
        this.name = "Registrico";
        this.dbName = "registrico";
      } else if (
        cards[0].value == 12 &&
        cards[1].value == 10 &&
        cards[2].value == 1
      ) {
        this.value = config.maguaro;
        this.name = "Maguaro";
        this.dbName = "maguaro";
      } else if (
        cards[0].value == 12 &&
        cards[1].value == 11 &&
        cards[2].value == 1
      ) {
        this.value = config.registro;
        this.name = "Registro";
        this.dbName = "registro";
      } else if (
        (cards[0].position == cards[1].position + 1 &&
          cards[1].position == cards[2].position) ||
        (cards[1].position == cards[2].position + 1 &&
          cards[1].position == cards[0].position)
      ) {
        this.value = config.vigia;
        this.name = "Vigía";
        this.dbName = "vigia";
      } else if (
        cards[0].position == cards[1].position + 1 &&
        cards[1].position == cards[2].position + 1
      ) {
        this.value = config.patrulla;
        this.name = "Patrulla";
        this.dbName = "patrulla";
      } else if (
        cards[0].position == cards[1].position + 2 &&
        cards[1].position == cards[2].position + 2
      ) {
        this.value = config.chiguire;
        this.name = "Chiguire";
        this.dbName = "chiguire";
      } else if (
        cards[0].value == cards[1].value ||
        cards[1].value == cards[2].value
      ) {
        this.value = cards[1].points * config.ronda;
        this.name = "Ronda";
        this.dbName = "ronda";
      }
    }
  }
}
module.exports = Sings;
