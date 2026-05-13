/**
 * Pure Game (de)serializer. Kept in its own module so unit tests can
 * import it without triggering services/persistence.js -> config/db.js
 * which opens a Postgres connection on load.
 */
const Game = require("../class/Game");
const User = require("../class/User");
const Card = require("../class/Card");
const Sings = require("../class/Sings");
const Config = require("../class/Config");

function cardToNumber(c) {
  if (c == null) return null;
  if (c === "Start_By") return "Start_By";
  if (typeof c === "number") return c;
  return c.number;
}

function numberToCard(n) {
  if (n == null) return null;
  if (n === "Start_By") return "Start_By";
  return new Card(n);
}

function serialize(game) {
  return {
    name: game.name,
    decks: game.decks,
    last_hand: game.last_hand,
    last_player_on_take: game.last_player_on_take,
    player: game.player,
    points: game.points,
    table_order: game.table_order,
    took: game.took,
    config: { ...game.config },
    deck: game.deck,
    last_card_played: cardToNumber(game.last_card_played),
    table: game.table.map(cardToNumber),
    users: game.users.map((u) => ({
      id_user: u.id_user,
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      is_banned: u.is_banned,
      caida: u.caida,
      caido: u.caido,
      cards: (u.cards || []).map(cardToNumber),
      sing: {
        active: u.sing && u.sing.active,
        value: u.sing && u.sing.value,
        name: u.sing && u.sing.name,
        dbName: u.sing && u.sing.dbName,
      },
    })),
  };
}

function deserialize(data) {
  const config = new Config(data.config);
  const game = new Game(data.name, config);
  game.decks = data.decks;
  game.last_hand = data.last_hand;
  game.last_player_on_take = data.last_player_on_take;
  game.player = data.player;
  game.points = data.points || [];
  game.table_order = data.table_order || "";
  game.took = data.took || [0, 0, 0, 0];
  game.deck = data.deck || [];
  game.last_card_played = numberToCard(data.last_card_played);
  game.table = (data.table || Array(10).fill(null)).map(numberToCard);
  game.users = (data.users || []).map((u) => {
    const user = new User({
      id_user: u.id_user,
      first_name: u.first_name,
      last_name: u.last_name,
      username: u.username,
      is_banned: u.is_banned,
    });
    user.caida = u.caida || 0;
    user.caido = u.caido || 0;
    user.cards = (u.cards || []).map(numberToCard);
    const sing = new Sings([]);
    if (u.sing) {
      sing.active = !!u.sing.active;
      sing.value = u.sing.value || 0;
      sing.name = u.sing.name || "No cantó";
      sing.dbName = u.sing.dbName;
    }
    user.sing = sing;
    return user;
  });
  return game;
}

module.exports = { serialize, deserialize };
