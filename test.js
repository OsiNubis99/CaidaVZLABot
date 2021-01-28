const Card = require("./class/Card");
const Game = require("./class/Game");
const User = require("./class/User");

let players = [];

players["1"] = new User({ id_user: 1, first_name: "P1", username: "P1" });
players["2"] = new User({ id_user: 2, first_name: "P2", username: "P2" });
players["3"] = new User({ id_user: 3, first_name: "P3", username: "P3" });
players["4"] = new User({ id_user: 4, first_name: "P4", username: "P4" });
console.log(players["1"].print());
// player.add_card(new Card(38));
// console.log(player.print());
// player.add_card(new Card(0));
// console.log(player.print());
// player.add_card(new Card(39));
// console.log(player.print());

var game = new Game("nombre", { mode: "parejas" });
console.log(game.print());
console.log(game.join(players[1]));
console.log(game.print());
game.join(players[2]);
console.log(game.last_player());
game.join(players[3]);
console.log(game.last_player());
game.join(players[4]);
console.log(game.print());
