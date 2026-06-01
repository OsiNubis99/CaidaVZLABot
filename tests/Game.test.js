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

  it("rotates points correctly when some players have zero points (sparse-array regression)", () => {
    // Reproduces a production bug: with 3 players where only players 0
    // and 1 earned points, this.points was [9, 1] (length 2, slot 2
    // never set) and handing_out_cards' push(shift()) misaligned — the
    // new tail index read `undefined` and the player whose 9 pts
    // should follow them across the rotation appeared with 0.
    // The fix normalizes this.points to slotCount entries before
    // rotation. We invoke the rotation via handing_out_cards' empty-
    // deck branch directly.
    const cfg = new Config(game_modes[1]);
    const g = new Game("test", cfg);
    g.join(makeUser(1, "A"));
    g.join(makeUser(2, "B"));
    g.join(makeUser(3, "C"));
    g.increase_points(0, 9); // A earns 9
    g.increase_points(1, 1); // B earns 1
    // C (slot 2) never earns anything — slot 2 stays missing/sparse.
    // Trigger the empty-deck rotation path (deck.length === 0).
    g.decks = 1;
    g.deck = [];
    g.handing_out_cards(0);
    // Users rotated by 1: A → end, B → first.
    expect(g.users.map((u) => u.first_name)).toEqual(["B", "C", "A"]);
    // Points rotated with users so each player keeps their score.
    expect(g.points[0]).toBe(1); // B kept 1
    expect(g.points[1]).toBe(0); // C kept 0
    expect(g.points[2]).toBe(9); // A's 9 followed them to the new tail index
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

  describe("mata_mesa", () => {
    // Helper: build a 2p game already past the deck deal, with a primed
    // mata_mesa candidate. The dealer (idx 1) earned syncPoints and the
    // 4th dealt card sits at position `syncPos`. The first player (idx 0)
    // has one card at the same position so they can caída it.
    function primed({
      mata_mesa = "on",
      type = "individual",
      userCount = 2,
      syncPoints = 5,
      dealerExisting = 10,
      // Pick a position 0..9 for the sync card. The first player will
      // have a card at the same position (so caída fires).
      syncPos = 5,
    } = {}) {
      const cfg = new Config({ ...game_modes[2], type, mata_mesa, mata_canto: "off" });
      cfg.points = 100; // prevent kill during the test
      const g = new Game("T", cfg);
      for (let i = 0; i < userCount; i++) g.join(makeUser(i + 1, "U" + i));
      g.decks = 1;
      g.player = 0; // first player of the new deck
      g.last_hand = false;

      // syncPos -> base card number for that position (any of 4 suits).
      const syncCardNumber = syncPos * 4 + 0; // Oro
      const syncCard = new Card(syncCardNumber);
      // Place the sync card on the table at its own position so the
      // first player's play actually takes (took > 1).
      g.table[syncPos] = syncCard;
      // Park a second card on a different position so the table is NOT
      // empty after the caída-take (otherwise clean_table also fires
      // and inflates the player's points by config.mesa).
      g.table[0] = new Card(3); // position 0, suit Basto
      g.last_card_played = syncCard;
      g._dealerSyncCandidate = {
        dealerIdx: g.dealerIdx(),
        syncCard,
        points: syncPoints,
      };

      // First player has a matching-position card (different suit, Espada).
      const playerCard = new Card(syncPos * 4 + 1);
      g.users[0].cards = [playerCard, new Card(2), new Card(11)]; // 3 cards so handing_out_cards is NOT triggered after play
      // Give all other users 3 cards so users[length-1].cards.length > 0.
      for (let i = 1; i < userCount; i++) {
        g.users[i].cards = [new Card(12 + i), new Card(16 + i), new Card(20 + i)];
      }

      // Seed dealer slot with some existing points so mata_mesa has
      // something to subtract from.
      const dealerSlot = g.scoringSlot(g.dealerIdx());
      g.points[dealerSlot] = dealerExisting;
      return g;
    }

    it("on + first-play caída → subtracts sync points from dealer", () => {
      const g = primed({ mata_mesa: "on", syncPoints: 5, dealerExisting: 10 });
      const dealerSlot = g.scoringSlot(g.dealerIdx());
      const response = g.play_card("1", 0);
      // Dealer loses 5 (10 -> 5). Player (idx 0) got caída points (+1).
      expect(g.points[dealerSlot]).toBe(5);
      expect(g.points[0]).toBe(1);
      expect(response).toContain("Mata mesa");
      expect(g._dealerSyncCandidate).toBeNull();
    });

    it("off + first-play caída → dealer keeps points, player still gets caída", () => {
      const g = primed({ mata_mesa: "off", syncPoints: 5, dealerExisting: 10 });
      const dealerSlot = g.scoringSlot(g.dealerIdx());
      const response = g.play_card("1", 0);
      expect(g.points[dealerSlot]).toBe(10); // unchanged
      expect(g.points[0]).toBe(1); // caída fired
      expect(response).not.toContain("Mata mesa");
      expect(g._dealerSyncCandidate).toBeNull(); // still consumed
    });

    it("candidate cleared after any play — later caída does not trigger mata_mesa", () => {
      const g = primed({ mata_mesa: "on", syncPoints: 5, dealerExisting: 10 });
      // Replace player 0's first card with a non-matching one so no caída
      // fires on this play. Put a non-conflicting card on the table.
      const otherPos = 2;
      g.users[0].cards = [new Card(otherPos * 4), new Card(0), new Card(8)];
      // Make sure the play does not collide with table[syncPos] only.
      g.play_card("1", 0);
      expect(g._dealerSyncCandidate).toBeNull();
      // Now manually set up a caída scenario for the next player.
      // Even if last_card_played matched syncCard, the candidate is gone.
      const dealerSlot = g.scoringSlot(g.dealerIdx());
      expect(g.points[dealerSlot]).toBe(10); // unchanged
    });

    it("mid-deck handing_out_cards (start_by=0) does not set the candidate", () => {
      // Build a mid-deck setup: deck still has cards, players just emptied
      // their hands, handing_out_cards(0) refills.
      const cfg = new Config({ ...game_modes[1], caida_continua: "on" });
      const g = new Game("T", cfg);
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.decks = 1;
      g.deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      g.users.forEach((u) => (u.cards = []));
      g._dealerSyncCandidate = null;
      g.handing_out_cards(0);
      expect(g._dealerSyncCandidate).toBeNull();
    });

    it("dealer sync points = 0 → no candidate set, no mata_mesa fires", () => {
      // Use real handing_out_cards path. start_by=4 deals descending
      // 4 -> 3 -> 2 -> 1; with a shuffled real deck, sync points may or
      // may not be > 0. We force it by setting up a deck where sync
      // points cannot match. Easier: drive the constructor directly,
      // call handing_out_cards with a start_by guaranteed to miss.
      const cfg = new Config({ ...game_modes[1] });
      const g = new Game("T", cfg);
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.decks = 1;
      // Construct a deck where push_cards never hits the predicted value.
      // new_cards(3, 4, true) will push 4 (then 3, 2, 1). To miss every
      // one we craft a deck where the first 4 cards drawn don't match
      // those values. Card number / 4 == value-1; we want positions
      // never equal to 3, 2, 1, 0.
      // But the deck must still have 40 unique cards or push_cards may
      // recurse. Just use a real shuffled deck via shuffle(), then assert
      // the post-state: if points happened to be 0, candidate is null.
      // Deterministic alternative: stub last_card_played manually after
      // calling new_cards-like state.
      // Simpler: directly invoke the branch under test by calling
      // handing_out_cards with start_by=0 (already covered).
      // For start_by != 0 with points == 0: bypass push_cards. Build a
      // deck whose mesa-card values never equal 4,3,2,1.
      // Card position = floor(n/4). value = position+1 (with 8/9/10
      // mapped to 10/11/12). We want value != 4,3,2,1 for the 4 dealt
      // mesa cards. Position 4 (value 5), position 5 (value 6),
      // position 6 (value 7), position 7 (value 10) all qualify.
      g.deck = [];
      // 3 cards per user (6 total) then 4 mesa cards (but new_cards(3, 4)
      // dispatches user cards each iter; mesa card is drawn via
      // push_cards at start of each iter). The order of deck.shift() per
      // iteration is: push_cards (1 card) then add_card x N users (N
      // cards), repeated `number` times, then a final push_cards.
      // For number=3, userCount=2: 4 push_cards drawing 4 mesa cards,
      // 3 iterations of 2 user-card draws = 6 user cards. Total 10 cards.
      // Place mesa cards at positions where value != predicted.
      // Iter 0: predict 4. Mesa drawn must NOT have value 4.
      //   Use Card(16) -> position 4 -> value 5.
      // Iter 1: predict 3 (descending). Mesa drawn must NOT have value 3.
      //   Use Card(20) -> position 5 -> value 6.
      // Iter 2: predict 2. Mesa: Card(24) -> position 6 -> value 7.
      // Final: predict 1. Mesa: Card(28) -> position 7 -> value 10.
      // User cards: 6 leftover unique numbers.
      g.deck = [
        16, // mesa iter 0
        0, 1, // user cards
        20, // mesa iter 1
        2, 3,
        24, // mesa iter 2
        4, 5,
        28, // mesa final
      ];
      g.users.forEach((u) => (u.cards = []));
      g.handing_out_cards(4);
      expect(g._dealerSyncCandidate).toBeNull();
    });

    it("clamp to 0 when dealer has fewer points than sync amount", () => {
      const g = primed({ mata_mesa: "on", syncPoints: 10, dealerExisting: 3 });
      const dealerSlot = g.scoringSlot(g.dealerIdx());
      g.play_card("1", 0);
      expect(g.points[dealerSlot]).toBe(0); // clamped, not -7
    });

    it("parejas-4 + mata_mesa: subtracts from the team slot", () => {
      const g = primed({
        mata_mesa: "on",
        type: "parejas",
        userCount: 4,
        syncPoints: 4,
        dealerExisting: 12,
      });
      // Dealer is idx 3 -> scoringSlot 1 in parejas (3 % 2). Partner
      // (idx 1) is also penalized — they share the slot.
      expect(g.scoringSlot(3)).toBe(1);
      g.play_card("1", 0);
      expect(g.points[1]).toBe(8); // 12 - 4
      // Player 0 got caída (+1) into slot 0 (also their partner idx 2).
      expect(g.points[0]).toBe(1);
    });

    // ─── CVB-5: defer the endgame on a reversible pegar-en-mesa win ───
    describe("endgame deferral (CVB-5)", () => {
      // Build a 2p game and deal a brand-new deck (start_by=4) where the
      // dealt mesa sequence 4->3->2->1 fully matches, so the dealer earns
      // 4+3+2+1 = 10 sync points. With points threshold 10, that crosses.
      function dealFullMesaMatch({ mata_mesa = "on", points = 10 }) {
        const cfg = new Config({ ...game_modes[1], mata_mesa, mata_canto: "off" });
        cfg.points = points;
        const g = new Game("T", cfg);
        g.join(makeUser(1, "U0"));
        g.join(makeUser(2, "U1")); // U1 is the dealer (idx 1)
        g.decks = 1;
        // Deck order per new_cards(3,4): [mesa0,u,u, mesa1,u,u, mesa2,u,u, mesaFinal]
        // value = position+1, position = floor(n/4).
        // mesa: 12(pos3,val4), 8(pos2,val3), 4(pos1,val2), 0(pos0,val1).
        g.deck = [12, 16, 20, 8, 24, 28, 4, 32, 36, 0];
        g.users.forEach((u) => (u.cards = []));
        return g;
      }

      it("mata_mesa on + dealer crosses threshold → defers, no kill", () => {
        const g = dealFullMesaMatch({ mata_mesa: "on", points: 10 });
        const response = g.handing_out_cards(4);
        const dealerSlot = g.scoringSlot(g.users.length - 1);
        expect(g.points[dealerSlot]).toBe(10); // crossed threshold
        expect(g._pendingMesaWinSlot).toBe(dealerSlot); // deferred, not killed
        expect(response).toContain("pegando en mesa"); // pending message shown
        expect(response).not.toContain("🏆"); // no victory yet
      });

      it("mata_mesa off + dealer crosses threshold → ends immediately", () => {
        const g = dealFullMesaMatch({ mata_mesa: "off", points: 10 });
        const response = g.handing_out_cards(4);
        expect(g._pendingMesaWinSlot).toBeNull(); // never deferred
        // kill() returns { finished: true, response }
        expect(response.finished).toBe(true);
        expect(response.response).toContain("🏆"); // game over now
      });

      // For the resolve path, reuse primed() (post-deal state) and set the
      // pending flag + a winning dealer score by hand, then play.
      it("first player kills the mesa → win reverts, game continues", () => {
        const g = primed({ mata_mesa: "on", syncPoints: 5, dealerExisting: 30 });
        g.config.points = 30;
        const dealerSlot = g.scoringSlot(g.dealerIdx());
        g._pendingMesaWinSlot = dealerSlot;
        const response = g.play_card("1", 0); // player 0 caídas the sync card
        expect(g.points[dealerSlot]).toBe(25); // mata_mesa subtracted 5
        expect(g._pendingMesaWinSlot).toBeNull(); // resolved
        expect(response).not.toContain("🏆"); // nobody won
      });

      it("first player does NOT kill the mesa → dealer wins", () => {
        const g = primed({ mata_mesa: "on", syncPoints: 5, dealerExisting: 30 });
        g.config.points = 30;
        const dealerSlot = g.scoringSlot(g.dealerIdx());
        g._pendingMesaWinSlot = dealerSlot;
        // Player 0 plays a card at position 0 → takes table[0] (set by
        // primed) but it's not the sync card's position, so no caída.
        g.users[0].cards = [new Card(1), new Card(13), new Card(17)]; // Card(1) = pos 0
        const response = g.play_card("1", 0);
        expect(g._pendingMesaWinSlot).toBeNull();
        expect(response.finished).toBe(true);
        expect(response.response).toContain("🏆"); // dealer wins
        expect(response.response).toContain("U1"); // the dealer, not player 0
      });

      it("player 0 also reaches threshold but didn't kill → dealer wins (priority)", () => {
        const g = primed({ mata_mesa: "on", syncPoints: 5, dealerExisting: 30 });
        g.config.points = 30;
        const dealerSlot = g.scoringSlot(g.dealerIdx());
        g._pendingMesaWinSlot = dealerSlot;
        g.points[0] = 30; // player 0 also at threshold
        g.users[0].cards = [new Card(1), new Card(13), new Card(17)]; // no caída
        const response = g.play_card("1", 0);
        // Dealer's deferred win resolves first → dealer (U1) wins, not U0.
        expect(response.finished).toBe(true);
        expect(response.response).toContain("🏆");
        expect(response.response).toContain("U1");
      });

      it("pending flag survives serialize → deserialize", () => {
        const { serialize, deserialize } = require("../services/gameSerialize");
        const g = primed({ mata_mesa: "on", syncPoints: 5, dealerExisting: 30 });
        g._pendingMesaWinSlot = g.scoringSlot(g.dealerIdx());
        const restored = deserialize(serialize(g));
        expect(restored._pendingMesaWinSlot).toBe(g._pendingMesaWinSlot);
      });
    });
  });

  describe("started_at + reaper signal", () => {
    it("started_at is null until the first shuffle", () => {
      const g = new Game("test", new Config(game_modes[1]));
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      expect(g.started_at).toBeNull();
      g.shuffle();
      expect(typeof g.started_at).toBe("number");
      expect(g.started_at).toBeGreaterThan(0);
    });

    it("started_at is preserved across subsequent shuffles", () => {
      const g = new Game("test", new Config(game_modes[1]));
      g.join(makeUser(1, "A"));
      g.join(makeUser(2, "B"));
      g.shuffle();
      const first = g.started_at;
      g.shuffle();
      expect(g.started_at).toBe(first);
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
