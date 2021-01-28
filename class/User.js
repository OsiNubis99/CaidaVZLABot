const Sings = require("./Sings");

class User {
  constructor(telegramUser) {
    this.id_user = telegramUser.id_user;
    this.first_name = telegramUser.first_name;
    this.last_name = telegramUser.last_name;
    this.username = telegramUser.username;
    this.is_banned = telegramUser.is_banned;
    this.cards = [];
    this.caida = 0;
    this.caido = 0;
    this.sings = 0;
    this.sing = new Sings();
  }

  print() {
    return (
      "\n\t@" +
      this.username +
      " Cantó: " +
      this.sing.name +
      (this.sing.value == 0 && this.sing.name != "No cantó" ? "😵" : " ") +
      " Cartas: " +
      this.cards.length
    );
  }

  play(index) {
    if (index >= this.cards.length || index < 0) return false;
    return this.cards.splice(index, 1)[0];
  }

  add_card(card, new_config) {
    this.cards.push(card);
    if (this.cards.length == 3) {
      this.cards.sort((a, b) => {
        return a.position <= b.position ? 1 : -1;
      });
      this.sing = new Sings(this.cards, new_config);
      if (this.sing.value != 0) this.sings++;
    }
  }
}
module.exports = User;
