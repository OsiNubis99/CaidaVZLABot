class Card {
  constructor(number) {
    this.number = number;
    this.position = Math.floor(number / 4);
    this.value = Math.floor(number / 4) + 1;
    this.value =
      this.value == 8
        ? 10
        : this.value == 9
        ? 11
        : this.value == 10
        ? 12
        : this.value;
    this.type = number % 4;
    this.type =
      this.type == 0
        ? "Oro"
        : this.type == 1
        ? "Espada"
        : this.type == 2
        ? "Copa"
        : "Basto";
    this.picture =
      process.env.HEROKU_SERVER_URL +
      "/Cards/" +
      this.value +
      "-" +
      this.type +
      ".png";
  }

  static getType(number) {
    this.type = number % 4;
    return this.type == 0
      ? "Oro"
      : this.type == 1
      ? "Espada"
      : this.type == 2
      ? "Copa"
      : "Basto";
  }

  static getValue(number) {
    var value = Math.floor(number / 4) + 1;
    return value == 8 ? 10 : value == 9 ? 11 : value == 10 ? 12 : value;
  }
}
module.exports = Card;
