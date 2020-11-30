class User {
  constructor(telegramUser) {
    this.id_user = telegramUser.id_user;
    this.first_name = telegramUser.first_name;
    this.last_name = telegramUser.last_name;
    this.username = telegramUser.username;
    this.is_banned = telegramUser.is_banned;
    this.cards = [];
  }

  play(index) {
    if (index >= this.cards.length || index < 0) return false;
    return this.cards.splice(index, 1)[0];
  }
}
module.exports = User;
