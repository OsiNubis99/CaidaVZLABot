const Card = require("./class/Card");
const Game = require("./class/Game");
const User = require("./class/User");
const Config = require("./class/Config");
const UD = require("./database/user");

let players = [];
const game_mode = require("./lang/game_modes_es")[2];
var game = new Game("nombre", new Config(game_mode));
players[0] = new User({ id_user: 1, first_name: "P1", username: "P1" });
players[1] = new User({ id_user: 2, first_name: "P2", username: "P2" });
players[2] = new User({ id_user: 3, first_name: "P3", username: "P3" });
players[3] = new User({ id_user: 4, first_name: "P4", username: "P4" });
players.forEach(e => {
  UD.add(e)
})
let cont = 0;
let play = 0;
while (true) {
  if (game.decks < 1) {
    play++;
    if (play > 1) break;
    players.forEach(item => game.join(item));
    console.log('\x1b[35m ' + game.shuffle() + '\x1b[0m');
    game.handing_out_cards(1);
  } else if (game.deck.length == 40) {
    game.handing_out_cards(4)
    players.push(players.shift())
  }
  for (var count = 0; count < 3; count++) {
    players.forEach(item => {
      if (count == 0 && game.decks > 0) game.sing(item.id_user);
      console.log('b', game.points, game.player)
      if (game.decks > 0) game.play_card(item.id_user, 0);
      console.log('a', game.points, game.player)
    });
  }
}
