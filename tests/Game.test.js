const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

function makeUser(id, first_name) {
  return new User({ id_user: String(id), first_name, last_name: "", username: first_name, is_banned: false });
}

describe("Game", () => {
  it("starts with no decks played, empty table, no users", () => {
    const g = new Game("test", new Config(game_modes[1]));
    expect(g.decks).toBe(0);
    expect(g.table).toEqual([null, null, null, null, null, null, null, null, null, null]);
    expect(g.users).toEqual([]);
  });

  it("joins players and increments decks on shuffle", () => {
    const g = new Game("test", new Config(game_modes[1]));
    g.join(makeUser(1, "A"));
    g.join(makeUser(2, "B"));
    expect(g.users.length).toBe(2);
    g.shuffle();
    expect(g.decks).toBe(1);
    // last user gets the "Start_By" sentinel
    expect(g.users[g.users.length - 1].cards).toEqual(["Start_By"]);
  });

  it("shuffles the deck (40 cards, no duplicates)", () => {
    const g = new Game("test", new Config(game_modes[1]));
    g.join(makeUser(1, "A"));
    g.join(makeUser(2, "B"));
    g.shuffle();
    expect(g.deck.length).toBe(40);
    expect(new Set(g.deck).size).toBe(40);
    for (const n of g.deck) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(40);
    }
  });

  it("increase_points returns true when threshold reached", () => {
    const cfg = new Config(game_modes[1]);
    cfg.points = 10;
    const g = new Game("test", cfg);
    g.join(makeUser(1, "A"));
    g.join(makeUser(2, "B"));
    expect(g.increase_points(0, 5)).toBe(false);
    expect(g.points[0]).toBe(5);
    expect(g.increase_points(0, 5)).toBe(true);
    expect(g.points[0]).toBe(10);
  });

  it("increase_points groups by team in parejas mode", () => {
    // The Grupish preset defaults to individual now; force parejas here.
    const cfg = new Config({ ...game_modes[2], type: "parejas" });
    cfg.points = 100;
    const g = new Game("test", cfg);
    for (let i = 0; i < 4; i++) g.join(makeUser(i + 1, "U" + i));
    g.increase_points(0, 5); // team 0
    g.increase_points(2, 5); // also team 0 (2 % 2 = 0)
    expect(g.points[0]).toBe(10);
    g.increase_points(1, 3); // team 1
    g.increase_points(3, 4); // team 1
    expect(g.points[1]).toBe(7);
  });
});
