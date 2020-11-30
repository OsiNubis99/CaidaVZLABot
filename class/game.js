const Config = require("./config");
const User = require("./user");

class Game {
  config = Config.prototype;
  player = User.prototype;
  constructor(config) {
    this.config = config;
    this.players = [];
  }
}

module.exports = Game;
