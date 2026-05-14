const Game = require("../class/Game");
const User = require("../class/User");
const Card = require("../class/Card");
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

  describe("caida_continua", () => {
    // Mid-deck mano boundary: handing_out_cards(0) is called when every
    // player just emptied their hand and the deck still has cards. The
    // dealer's last_card_played determines whether the *next* mano's
    // first player can caída the dealer.

    function midDeckSetup(caida_continua) {
      const cfg = new Config({ ...game_modes[1], caida_continua });
      const g = new Game("T", cfg);
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.decks = 1; // pretend mid-game
      g.deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // enough cards for the refill
      g.users.forEach((u) => (u.cards = [])); // everyone just played their last
      g.last_card_played = new Card(24); // value 7 of Copa (number 24)
      return g;
    }

    it("keeps last_card_played when 'on' so caída crosses mano boundaries", () => {
      const g = midDeckSetup("on");
      const prevCard = g.last_card_played;
      g.handing_out_cards(0);
      expect(g.last_card_played).toBe(prevCard);
    });

    it("resets last_card_played when 'off' so the first play cannot caída", () => {
      const g = midDeckSetup("off");
      g.handing_out_cards(0);
      expect(g.last_card_played).toBeNull();
    });

    it("resets last_card_played between decks regardless of caida_continua", () => {
      // deck.length == 0 branch is the between-deck path. It clears the
      // table and resets last_card_played unconditionally — the table is
      // empty, so there is nothing to caída against anyway.
      const cfg = new Config({ ...game_modes[1], caida_continua: "on" });
      const g = new Game("T", cfg);
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.decks = 1;
      g.deck = []; // empty -> trigger between-deck path
      g.last_card_played = new Card(24);
      g.handing_out_cards(0);
      expect(g.last_card_played).toBeNull();
    });
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

  describe("scoring helpers", () => {
    function buildGame(type, userCount) {
      const cfg = new Config({ ...game_modes[2], type });
      const g = new Game("T", cfg);
      for (let i = 0; i < userCount; i++) g.join(makeUser(i + 1, "U" + i));
      return g;
    }

    it("isParejasMode is true only for 4 users + type=parejas", () => {
      const g = buildGame("parejas", 4);
      expect(g.isParejasMode()).toBe(true);
    });

    it("isParejasMode is false for 4 users + type=individual", () => {
      const g = buildGame("individual", 4);
      expect(g.isParejasMode()).toBe(false);
    });

    it("isParejasMode is false for 3 users + type=parejas (parejas needs 4)", () => {
      const g = buildGame("parejas", 3);
      expect(g.isParejasMode()).toBe(false);
    });

    it("isParejasMode is false for 2 users + type=parejas", () => {
      const g = buildGame("parejas", 2);
      expect(g.isParejasMode()).toBe(false);
    });

    it("scoringSlot maps 1:1 in individual modes (2p, 3p, 4p-individual)", () => {
      const g2 = buildGame("individual", 2);
      expect(g2.scoringSlot(0)).toBe(0);
      expect(g2.scoringSlot(1)).toBe(1);

      const g3 = buildGame("individual", 3);
      expect(g3.scoringSlot(0)).toBe(0);
      expect(g3.scoringSlot(1)).toBe(1);
      expect(g3.scoringSlot(2)).toBe(2);

      const g4 = buildGame("individual", 4);
      expect(g4.scoringSlot(0)).toBe(0);
      expect(g4.scoringSlot(1)).toBe(1);
      expect(g4.scoringSlot(2)).toBe(2);
      expect(g4.scoringSlot(3)).toBe(3);
    });

    it("scoringSlot maps player % 2 in parejas-4", () => {
      const g = buildGame("parejas", 4);
      expect(g.scoringSlot(0)).toBe(0);
      expect(g.scoringSlot(1)).toBe(1);
      expect(g.scoringSlot(2)).toBe(0);
      expect(g.scoringSlot(3)).toBe(1);
    });

    it("scoringSlot ignores parejas flag with 3 players (returns player index unchanged)", () => {
      const g = buildGame("parejas", 3);
      expect(g.scoringSlot(0)).toBe(0);
      expect(g.scoringSlot(1)).toBe(1);
      expect(g.scoringSlot(2)).toBe(2);
    });

    it("dealerIdx returns users.length - 1", () => {
      const g2 = buildGame("individual", 2);
      expect(g2.dealerIdx()).toBe(1);
      const g4 = buildGame("parejas", 4);
      expect(g4.dealerIdx()).toBe(3);
    });

    it("dealerIdx for 3 players is 2", () => {
      const g = buildGame("individual", 3);
      expect(g.dealerIdx()).toBe(2);
    });
  });

  describe("3-player support", () => {
    it("3p threshold rule: dealer (idx 2) gets 14, others get 13", () => {
      const g = new Game("test", new Config(game_modes[1]));
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.join(makeUser(3, "C"));
      const rules = g._selectTookBonusRules();
      expect(rules).toEqual([
        { player: 0, threshold: 13 },
        { player: 1, threshold: 13 },
        { player: 2, threshold: 14 },
      ]);
      // Dealer is the last user (idx 2).
      expect(g.dealerIdx()).toBe(2);
    });

    it("3p individual: scoringSlot maps 1:1 (not collapsed) even with config.type=parejas", () => {
      // With 3 users, isParejasMode() returns false regardless of
      // config.type, so scoringSlot is a 1:1 identity map — the parejas
      // flag is inert.
      const cfg = new Config({ ...game_modes[1], type: "parejas" });
      const g = new Game("test", cfg);
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.join(makeUser(3, "C"));
      expect(g.isParejasMode()).toBe(false);
      expect(g.scoringSlot(0)).toBe(0);
      expect(g.scoringSlot(1)).toBe(1);
      expect(g.scoringSlot(2)).toBe(2);
    });

    it("3p color stamping: each player gets a unique color from 🔴🔵🟢", () => {
      const g = new Game("test", new Config(game_modes[1])); // Clásico = individual
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.join(makeUser(3, "C"));
      expect(g.users[0].color).toBe("🔴");
      expect(g.users[1].color).toBe("🔵");
      expect(g.users[2].color).toBe("🟢");
      // 🟡 (the 4-player color) must not appear with only 3 users.
      for (const u of g.users) {
        expect(u.color).not.toBe("🟡");
      }
    });

    it("3p with type=parejas: colors still get stamped (because !isParejasMode for 3 users)", () => {
      // The parejas flag is inert with 3 players: isParejasMode() returns
      // false, so join() must still stamp the individual color marker.
      const cfg = new Config({ ...game_modes[1], type: "parejas" });
      const g = new Game("test", cfg);
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.join(makeUser(3, "C"));
      expect(g.users[0].color).toBe("🔴");
      expect(g.users[1].color).toBe("🔵");
      expect(g.users[2].color).toBe("🟢");
    });
  });
});
