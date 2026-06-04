const GameSession = require("../../services/realtime/GameSession");
const serializeForClient = require("../../services/realtime/serializeForClient");
const Config = require("../../class/Config");
const Card = require("../../class/Card");
const game_modes = require("../../lang/game_modes_es");

// A deterministic deck whose dealt mesa sequence (start_by=4) is 4→3→2→1
// of Oro (all matched), so the dealer earns 10 sync points. The remaining
// cards give player 0 the Oro 11/7/5 hand and player 1 the Oro 12/10/6
// hand — handy fixed values to assert against.
const FIXED_DECK = [
  12, 16, 20, 8, 24, 28, 4, 32, 36, 0, 11, 10, 38, 19, 25, 18, 14, 2, 5, 39,
  15, 29, 30, 1, 9, 35, 22, 31, 6, 3, 23, 34, 21, 7, 33, 37, 26, 13, 27, 17,
];

function patchDeck(session, deck = FIXED_DECK) {
  // Replace shuffle with a deterministic deal: same side effects as the
  // real shuffle (decks++, started_at, played_cards reset, dealer gets the
  // Start_By sentinel) but a fixed deck.
  session.game.shuffle = function () {
    this.decks++;
    if (!this.started_at) this.started_at = Date.now();
    this.played_cards = [];
    this.deck = deck.slice();
    this.markStartByPlayer();
    return "shuffled";
  };
}

function twoSeatPlaying(config) {
  const s = new GameSession({
    code: "CAIDA-TST1",
    host: { userId: "1", name: "Andres" },
    config,
  });
  s.addHuman({ userId: "2", name: "Bea" });
  patchDeck(s);
  s.start(4); // eager deal, direction 4
  return s;
}

describe("serializeForClient", () => {
  it("exposes the viewer's own hand and hides rivals' cards", () => {
    const s = twoSeatPlaying();
    const stA = serializeForClient(s, "1");
    const stB = serializeForClient(s, "2");

    // Andres sees his 3 cards; Bea's seat shows only a count.
    expect(Array.isArray(stA.you.hand)).toBe(true);
    expect(stA.you.hand.length).toBe(3);
    expect(stA.you.seat).toBe(0);
    expect(stA.seats[1].cardCount).toBe(3);
    expect(stA.seats[1].hand).toBeUndefined();

    // Bea sees her own (different) cards.
    expect(stB.you.hand.length).toBe(3);
    expect(stB.you.seat).toBe(1);
    expect(stB.you.hand).not.toEqual(stA.you.hand);

    // Each card is the minimal client shape.
    for (const c of stA.you.hand) {
      expect(c).toHaveProperty("value");
      expect(c).toHaveProperty("type");
      expect(c).not.toHaveProperty("number");
    }
  });

  it("maps table, turnSeat, dealerSeat and per-seat points/took", () => {
    const s = twoSeatPlaying();
    const st = serializeForClient(s, "1");

    // The dealt 4→3→2→1 Oro sequence sits on the table.
    const onTable = st.table.filter(Boolean).map((c) => `${c.value}-${c.type}`);
    expect(onTable).toEqual(["1-Oro", "2-Oro", "3-Oro", "4-Oro"]);
    expect(st.table.length).toBe(10);

    expect(st.turnSeat).toBe(0); // first player is up
    expect(st.dealerSeat).toBe(1); // last seat is the dealer
    // Dealer earned the 10 pegar-en-mesa points (slot mapping intact).
    expect(st.seats[1].points).toBe(10);
    expect(st.seats[0].points).toBe(0);
    expect(typeof st.seats[0].took).toBe("number");
    expect(st.status).toBe("playing");
  });

  it("marks canSing when the viewer holds a declarable canto", () => {
    const s = twoSeatPlaying();
    // Hand-craft a Trivilin (three value-1 cards) for the viewer.
    const idx = s.game.get_user_index("1");
    const u = s.game.users[idx];
    u.cards = [];
    u.add_card(new Card(0), s.game.config); // 1 Oro
    u.add_card(new Card(1), s.game.config); // 1 Espada
    u.add_card(new Card(2), s.game.config); // 1 Copa → Trivilin

    const st = serializeForClient(s, "1");
    expect(st.you.canSing).toEqual({ name: "Trivilin", value: 24 });
    // canSing must not leak the trailing Sings object into the hand.
    expect(st.you.hand.length).toBe(3);
  });

  it("canSing is null once the canto is declared (sing.active)", () => {
    const s = twoSeatPlaying();
    const idx = s.game.get_user_index("1");
    const u = s.game.users[idx];
    u.cards = [];
    u.add_card(new Card(0), s.game.config);
    u.add_card(new Card(1), s.game.config);
    u.add_card(new Card(2), s.game.config);
    u.sing.active = true; // already declared
    const st = serializeForClient(s, "1");
    expect(st.you.canSing).toBeNull();
  });

  it("renders the startBy picker for the dealer instead of a hand", () => {
    const s = new GameSession({
      code: "CAIDA-SB",
      host: { userId: "1", name: "Andres" },
    });
    s.addHuman({ userId: "2", name: "Bea" });
    patchDeck(s);
    s.start(); // no eager direction → dealer holds the Start_By sentinel

    // Bea (seat 1) is the dealer in the Start_By state.
    const stDealer = serializeForClient(s, "2");
    expect(stDealer.you.hand).toEqual({ type: "startBy" });
    expect(stDealer.turnSeat).toBe(1); // dealer is up to pick direction
    // The sentinel must not render as "1 card" on the dealer's seat.
    expect(stDealer.seats[1].cardCount).toBe(0);
  });

  it("reports winner and finished status when the game ends", () => {
    const cfg = new Config({ ...game_modes[1], mata_mesa: "off" });
    cfg.points = 10; // dealer's 10 mesa points win immediately
    const s = twoSeatPlaying(cfg);

    const st = serializeForClient(s, "1");
    expect(st.status).toBe("finished");
    expect(st.winner).toBeTruthy();
    expect(st.winner.seat).toBe(1); // the dealer (seat 1) won
    expect(st.winner.standings[0]).toMatchObject({ seat: 1, points: 10 });
  });

  it("lobby state has no table cards, no hand, and seats with zeroed stats", () => {
    const s = new GameSession({
      code: "CAIDA-LOB",
      host: { userId: "1", name: "Andres" },
    });
    s.addCpu("easy");
    const st = serializeForClient(s, "1");
    expect(st.status).toBe("lobby");
    expect(st.table.every((c) => c === null)).toBe(true);
    expect(st.you.hand).toEqual([]);
    expect(st.turnSeat).toBeNull();
    expect(st.seats[1]).toMatchObject({ kind: "cpu", difficulty: "easy", points: 0 });
  });

  it("a non-seated spectator gets an empty hand and null seat", () => {
    const s = twoSeatPlaying();
    const st = serializeForClient(s, "999"); // not at the table
    expect(st.you.seat).toBeNull();
    expect(st.you.hand).toEqual([]);
    // But the public board is still visible.
    expect(st.table.filter(Boolean).length).toBe(4);
  });

  it("lastEvent carries the structural kind after a play", () => {
    const s = twoSeatPlaying();
    // start(4) just dealt; play the first player's first card.
    s.play("1", 0);
    const st = serializeForClient(s, "1");
    expect(st.lastEvent).toBeTruthy();
    expect(["play", "caida", "mesa_limpia", "mata_mesa", "canto"]).toContain(
      st.lastEvent.kind,
    );
  });
});
