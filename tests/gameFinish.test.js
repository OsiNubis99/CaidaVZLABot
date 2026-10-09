// How a game ended when no card play explains it: the deal of a new deck
// (mala echada, pegar en mesa) or the cards counted at the end of a deck.
// The text says how the mesa went and why; `_finish` carries the same facts
// for the WebApp's end screen.
const Game = require("../class/Game");
const Card = require("../class/Card");
const User = require("../class/User");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

const user = (id, name) =>
  new User({
    id_user: String(id),
    first_name: name,
    last_name: "",
    username: null,
    is_banned: false,
  });

// Card number → value: position = floor(n / 4); positions 0..6 are 1..7 and
// 7, 8, 9 are 10, 11, 12. A deck start (handing_out_cards(1|4)) draws a mesa
// card, then one card per player, three times, then the 4th mesa card.
function dealDeck(mesa, players) {
  const spare = [...Array(40).keys()].filter((n) => !mesa.includes(n));
  const deck = [];
  for (let i = 0; i < 3; i++) {
    deck.push(mesa[i]);
    for (let p = 0; p < players; p++) deck.push(spare.shift());
  }
  deck.push(mesa[3]);
  return deck;
}

function table(names, { points = 24, mata_mesa = "off", type = "individual" } = {}) {
  const cfg = new Config({ ...game_modes[1], mata_mesa, type });
  cfg.points = points;
  const g = new Game("T", cfg);
  names.forEach((n, i) => g.join(user(i + 1, n)));
  g.decks = 1;
  g.users.forEach((u) => (u.cards = []));
  return g;
}

/** Positions of each snippet in `text`, asserting they appear in that order. */
function inOrder(text, ...snippets) {
  let at = -1;
  for (const s of snippets) {
    const i = text.indexOf(s);
    expect(i, `missing or out of order: ${s}\n---\n${text}`).toBeGreaterThan(at);
    at = i;
  }
}

describe("mala echada", () => {
  // por 1 expects 1, 2, 3, 4; the mesa comes out 4, 3, 7, 12 → nothing sticks.
  const MISS_BY_ONE = [12, 8, 24, 36];

  it("when it ends the game, says how the mesa went and why", () => {
    const g = table(["Mafeer", "Andrés"]); // Andrés (last) deals
    g.points = [23, 4];
    g.deck = dealDeck(MISS_BY_ONE, 2);
    const r = g.handing_out_cards(1);
    expect(r.finished).toBe(true);
    inOrder(
      r.response,
      "🃏 Mesa de Andrés (por 1): 4 → 3 → 7 → 12",
      "❌ Mala echada: Andrés no pegó ninguna → +1 para Mafeer",
      "🏆",
    );
    expect(g._finish).toEqual({
      kind: "mala_echada",
      dealer: "Andrés",
      start: 1,
      table: [
        { value: 4, hit: false },
        { value: 3, hit: false },
        { value: 7, hit: false },
        { value: 12, hit: false },
      ],
      points: 1,
      to: ["Mafeer"],
    });
  });

  it("mid-game shows the same two lines", () => {
    const g = table(["Mafeer", "Andrés"]);
    g.points = [3, 4];
    g.deck = dealDeck(MISS_BY_ONE, 2);
    const r = g.handing_out_cards(1);
    expect(typeof r).toBe("string");
    inOrder(
      r,
      "🃏 Mesa de Andrés (por 1): 4 → 3 → 7 → 12",
      "❌ Mala echada: Andrés no pegó ninguna → +1 para Mafeer",
    );
    expect(r).not.toContain("Mal echada!");
    expect(g.points[0]).toBe(4);
  });

  it("in parejas the point goes to the team of the player after the dealer", () => {
    const g = table(["A", "B", "C", "D"], { type: "parejas" }); // D deals; A + C are a team
    g.points = [23, 4];
    g.deck = dealDeck(MISS_BY_ONE, 4);
    const r = g.handing_out_cards(1);
    expect(r.finished).toBe(true);
    expect(r.response).toContain("❌ Mala echada: D no pegó ninguna → +1 para A y C");
    expect(g._finish.to).toEqual(["A", "C"]);
  });
});

describe("pegar en mesa", () => {
  // por 4 expects 4, 3, 2, 1.
  const ALL_STICK = [12, 8, 4, 0]; // 4, 3, 2, 1 → +10
  const SOME_STICK = [12, 8, 24, 0]; // 4, 3, 7, 1 → +8

  it("when it ends the game, says how the mesa went and how much stuck", () => {
    const g = table(["U0", "U1"], { points: 10 }); // U1 deals
    g.deck = dealDeck(ALL_STICK, 2);
    const r = g.handing_out_cards(4);
    expect(r.finished).toBe(true);
    inOrder(
      r.response,
      "🃏 Mesa de U1 (por 4): 4✓ → 3✓ → 2✓ → 1✓",
      "🎯 U1 pegó en mesa: +10",
      "🏆",
    );
    expect(g._finish).toEqual({
      kind: "pegado_mesa",
      dealer: "U1",
      start: 4,
      table: [
        { value: 4, hit: true },
        { value: 3, hit: true },
        { value: 2, hit: true },
        { value: 1, hit: true },
      ],
      points: 10,
    });
  });

  it("mid-game marks only the cards that stuck", () => {
    const g = table(["U0", "U1"]);
    g.deck = dealDeck(SOME_STICK, 2);
    const r = g.handing_out_cards(4);
    expect(typeof r).toBe("string");
    inOrder(r, "🃏 Mesa de U1 (por 4): 4✓ → 3✓ → 7 → 1✓", "🎯 U1 pegó en mesa: +8");
    expect(r).not.toContain("Pegado en mesa");
  });

  it("a deferred win (mata mesa) replays how the mesa went when nobody kills it", () => {
    const g = table(["U0", "U1"], { points: 10, mata_mesa: "on" });
    g.deck = dealDeck(ALL_STICK, 2);
    const dealt = g.handing_out_cards(4);
    expect(typeof dealt).toBe("string"); // deferred: U0 may still kill it
    expect(g._finish).toBeNull();
    // U0's cards (5, 7, 11) land on empty spots: no caída on the last mesa card.
    const r = g.play_card("1", 0);
    expect(r.finished).toBe(true);
    inOrder(
      r.response,
      "🃏 Mesa de U1 (por 4): 4✓ → 3✓ → 2✓ → 1✓",
      "🎯 U1 pegó en mesa: +10",
      "🏆",
    );
    expect(g._finish).toMatchObject({ kind: "pegado_mesa", dealer: "U1", points: 10 });
  });

  it("a win that comes from a play has no `_finish`", () => {
    const g = table(["U0", "U1"], { points: 10, mata_mesa: "on" });
    g.deck = dealDeck(ALL_STICK, 2);
    g.handing_out_cards(4);
    g.config.points = 99; // the deferred win no longer holds…
    g.points[0] = 99; // …and U0 reaches the target on the play instead
    const r = g.play_card("1", 0);
    expect(r.finished).toBe(true);
    expect(g._finish).toBeNull();
  });
});

describe("cards counted at the end of a deck", () => {
  // End of deck: the deck and the hands are empty; 2 players keep what's
  // over 20 cards (parejas too: 2 slots).
  function endOfDeck(names, took, points, opts) {
    const g = table(names, opts);
    g.deck = [];
    g.took = took;
    g.points = points;
    return g;
  }

  it("when they end the game, says who took how many", () => {
    const g = endOfDeck(["A", "B"], [22, 18, 0, 0], [22, 10]);
    const r = g.handing_out_cards(0, "");
    expect(r.finished).toBe(true);
    inOrder(r.response, "🔚 Fin del mazo: A se llevó 22 cartas → +2", "🏆");
    expect(g._finish).toEqual({ kind: "cartas", who: ["A"], took: 22, points: 2 });
  });

  it("mid-game shows the same line before the next deck", () => {
    const g = endOfDeck(["A", "B"], [23, 17, 0, 0], [5, 10]);
    const r = g.handing_out_cards(0, "");
    expect(typeof r).toBe("string");
    expect(r).toContain("🔚 Fin del mazo: A se llevó 23 cartas → +3");
  });

  it("in parejas it names the pair", () => {
    const g = endOfDeck(["A", "B", "C", "D"], [22, 18, 0, 0], [22, 10], { type: "parejas" });
    const r = g.handing_out_cards(0, "");
    expect(r.finished).toBe(true);
    expect(r.response).toContain("🔚 Fin del mazo: A y C se llevaron 22 cartas → +2");
    expect(g._finish.who).toEqual(["A", "C"]);
  });

  it("in parejas it credits cards left on table to team of last player who took (partner index 2)", () => {
    const g = endOfDeck(["A", "B", "C", "D"], [19, 18, 0, 0], [23, 10], { type: "parejas" });
    g.table[4] = new Card(16);
    g.table[5] = new Card(20);
    g.last_player_on_take = 2; // C (partner of A, Team 0) was the last to take
    const r = g.handing_out_cards(0, "");
    expect(r.finished).toBe(true);
    expect(g.points[0]).toBe(24);
    expect(r.response).toContain("🔚 Fin del mazo: A y C se llevaron 21 cartas → +1");
    expect(g._finish.who).toEqual(["A", "C"]);
  });

  it("in parejas it credits cards left on table to team of last player who took (partner index 3)", () => {
    const g = endOfDeck(["A", "B", "C", "D"], [18, 19, 0, 0], [10, 23], { type: "parejas" });
    g.table[4] = new Card(16);
    g.table[5] = new Card(20);
    g.last_player_on_take = 3; // D (partner of B, Team 1) was the last to take
    const r = g.handing_out_cards(0, "");
    expect(r.finished).toBe(true);
    expect(g.points[1]).toBe(24);
    expect(r.response).toContain("🔚 Fin del mazo: B y D se llevaron 21 cartas → +1");
    expect(g._finish.who).toEqual(["B", "D"]);
  });
});
