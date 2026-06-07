const GameSession = require("../../services/realtime/GameSession");
const sessionStore = require("../../services/realtime/sessionStore");
const Config = require("../../class/Config");
const game_modes = require("../../lang/game_modes_es");

const FIXED_DECK = [
  12, 16, 20, 8, 24, 28, 4, 32, 36, 0, 11, 10, 38, 19, 25, 18, 14, 2, 5, 39,
  15, 29, 30, 1, 9, 35, 22, 31, 6, 3, 23, 34, 21, 7, 33, 37, 26, 13, 27, 17,
];

function patchDeck(session, deck = FIXED_DECK) {
  session.game.shuffle = function () {
    this.decks++;
    if (!this.started_at) this.started_at = Date.now();
    this.played_cards = [];
    this.deck = deck.slice();
    this.markStartByPlayer();
    return "shuffled";
  };
}

describe("GameSession", () => {
  describe("lifecycle: create → addHuman → addCpu → start", () => {
    it("seats the host at index 0 and joins them to the engine", () => {
      const s = new GameSession({ code: "CAIDA-AAAA", host: { userId: "1", name: "Andres" } });
      expect(s.status).toBe("lobby");
      expect(s.hostUserId).toBe("1");
      expect(s.seats.length).toBe(1);
      expect(s.seats[0]).toMatchObject({ index: 0, kind: "human", userId: "1", connected: true });
      expect(s.game.users.length).toBe(1);
      expect(s.game.users[0].id_user).toBe("1");
    });

    it("addHuman fills the next free seat and refuses duplicates", () => {
      const s = new GameSession({ code: "CAIDA-BBBB", host: { userId: "1", name: "A" } });
      s.addHuman({ userId: "2", name: "B" });
      s.addHuman({ userId: "3", name: "C" });
      expect(s.seats.map((x) => x.index)).toEqual([0, 1, 2]);
      expect(() => s.addHuman({ userId: "2", name: "dup" })).toThrow(/Ya estás/);
    });

    it("addHuman refuses a 5th seat (table full)", () => {
      const s = new GameSession({ code: "CAIDA-BBB2", host: { userId: "1", name: "A" } });
      s.addHuman({ userId: "2", name: "B" });
      s.addHuman({ userId: "3", name: "C" });
      s.addHuman({ userId: "4", name: "D" });
      expect(s.seats.map((x) => x.index)).toEqual([0, 1, 2, 3]);
      expect(() => s.addHuman({ userId: "5", name: "E" })).toThrow(/llena/);
    });

    it("addCpu produces a uniform cpu seat with a synthetic cpu_<code>_<slot> id", () => {
      const s = new GameSession({ code: "CAIDA-CCCC", host: { userId: "1", name: "A" } });
      const seat = s.addCpu("pro");
      expect(seat).toMatchObject({ index: 1, kind: "cpu", difficulty: "pro", connected: true });
      expect(seat.userId).toBe("cpu_CAIDA-CCCC_1");
      // The engine sees it as a normal User with cpu_difficulty set.
      const u = s.game.users[s.game.get_user_index(seat.userId)];
      expect(u.cpu_difficulty).toBe("pro");
    });

    it("seats are uniform — human vs cpu differ only by kind/difficulty", () => {
      const s = new GameSession({ code: "CAIDA-DDDD", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      const [human, cpu] = s.seats;
      expect(human.kind).toBe("human");
      expect(cpu.kind).toBe("cpu");
      // Both are real engine users in users[].
      expect(s.game.users.length).toBe(2);
    });

    it("removeCpu drops the cpu and re-indexes surviving seats contiguously", () => {
      const s = new GameSession({ code: "CAIDA-EEEE", host: { userId: "1", name: "A" } });
      s.addCpu("easy"); // seat 1
      s.addCpu("medium"); // seat 2
      s.removeCpu(1);
      expect(s.seats.map((x) => x.index)).toEqual([0, 1]);
      expect(s.seats[1].difficulty).toBe("medium");
      expect(s.game.users.length).toBe(2);
      // A later addCpu does not collide with the removed slot id.
      const seat = s.addCpu("pro");
      expect(seat.userId).toBe("cpu_CAIDA-EEEE_3");
    });

    it("removeCpu refuses a human seat", () => {
      const s = new GameSession({ code: "CAIDA-FFFF", host: { userId: "1", name: "A" } });
      s.addHuman({ userId: "2", name: "B" });
      expect(() => s.removeCpu(0)).toThrow(/no es un CPU/);
    });

    it("start requires ≥2 seats and flips status to playing", () => {
      const solo = new GameSession({ code: "CAIDA-GGGG", host: { userId: "1", name: "A" } });
      patchDeck(solo);
      expect(() => solo.start()).toThrow(/Faltan jugadores/);

      const s = new GameSession({ code: "CAIDA-HHHH", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      patchDeck(s);
      s.start();
      expect(s.status).toBe("playing");
      expect(s.game.decks).toBe(1);
    });

    it("lobby mutations are rejected once playing", () => {
      const s = new GameSession({ code: "CAIDA-IIII", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      patchDeck(s);
      s.start();
      expect(() => s.addHuman({ userId: "2", name: "B" })).toThrow(/ya empezó/);
      expect(() => s.addCpu("pro")).toThrow(/ya empezó/);
      expect(() => s.removeCpu(1)).toThrow(/ya empezó/);
    });
  });

  describe("delegation to the engine", () => {
    function playingPair(config) {
      const s = new GameSession({ code: "CAIDA-PLAY", host: { userId: "1", name: "A" }, config });
      s.addHuman({ userId: "2", name: "B" });
      patchDeck(s);
      s.start(4); // eager direction-4 deal
      return s;
    }

    it("play delegates to game.play_card and advances the turn", () => {
      const s = playingPair();
      // Dealer (B) just dealt; player 0 (A) is up.
      expect(s.game.player).toBe(0);
      const handBefore = s.game.users[s.game.get_user_index("1")].cards.length;
      s.play("1", 0);
      const handAfter = s.game.users[s.game.get_user_index("1")].cards.length;
      expect(handAfter).toBe(handBefore - 1); // a card left the hand
      expect(s.game.player).toBe(1); // turn advanced to seat 1
    });

    it("play rejects a move from a player who is not up", () => {
      const s = playingPair();
      // It's A's (seat 0) turn — B trying to play must be rejected.
      expect(() => s.play("2", 0)).toThrow(/No es tu turno/);
    });

    it("startBy choice is routed through play() and deals the deck", () => {
      const s = new GameSession({ code: "CAIDA-SBY", host: { userId: "1", name: "A" } });
      s.addHuman({ userId: "2", name: "B" });
      patchDeck(s);
      s.start(); // no eager direction → B (dealer) must pick
      // Only the dealer may pick; player 0 cannot.
      expect(() => s.play("1", 1)).toThrow(/dirección/);
      s.play("2", 4); // dealer picks direction 4
      // Deck dealt → the 4→3→2→1 Oro sequence is on the table.
      const onTable = s.game.table.filter(Boolean).map((c) => c.value);
      expect(onTable).toEqual([1, 2, 3, 4]);
    });

    it("sing delegates to game.sing and records a canto lastEvent", () => {
      const s = playingPair();
      const Card = require("../../class/Card");
      const idx = s.game.get_user_index("1");
      const u = s.game.users[idx];
      u.cards = [];
      u.add_card(new Card(0), s.game.config);
      u.add_card(new Card(1), s.game.config);
      u.add_card(new Card(2), s.game.config); // Trivilin
      // Make A the player up so it's a legal moment (turn check is on play,
      // not sing; sing only needs the user seated).
      s.sing("1");
      expect(u.sing.active).toBe(true);
      expect(s.lastEvent).toMatchObject({ kind: "canto", seat: 0 });
    });

    it("a winning play flips status to finished and records the winner", () => {
      const cfg = new Config({ ...game_modes[1], mata_mesa: "off" });
      cfg.points = 10; // dealer's full-mesa 10 points win at deal time
      const s = playingPair(cfg);
      expect(s.status).toBe("finished");
      expect(s.winner.seat).toBe(1); // the dealer (seat 1) won
      // Subsequent actions are rejected (game is over).
      expect(() => s.play("1", 0)).toThrow(/no está en curso/);
    });

    it("lastEvent reflects a caída when one fires", () => {
      const s = playingPair();
      s.play("1", 0);
      // The kind is at least a structural play; flags drive caida/limpia.
      expect(["play", "caida", "mesa_limpia"]).toContain(s.lastEvent.kind);
      expect(s.lastEvent).toHaveProperty("seat");
      expect(s.lastEvent).toHaveProperty("card");
    });
  });

  describe("host & disconnection rules (SP1 minimum)", () => {
    it("host leaving in lobby closes the session", () => {
      const s = new GameSession({ code: "CAIDA-HOST", host: { userId: "1", name: "A" } });
      s.addHuman({ userId: "2", name: "B" });
      const r = s.leave("1");
      expect(r).toEqual({ closed: true, reason: "host_left" });
      expect(s.status).toBe("finished");
      expect(s.winner).toBeNull();
    });

    it("a non-host leaving in lobby frees their seat without closing", () => {
      const s = new GameSession({ code: "CAIDA-NH", host: { userId: "1", name: "A" } });
      s.addHuman({ userId: "2", name: "B" });
      s.addHuman({ userId: "3", name: "C" });
      const r = s.leave("2");
      expect(r.closed).toBe(false);
      expect(s.seats.map((x) => x.userId)).toEqual(["1", "3"]);
      expect(s.seats.map((x) => x.index)).toEqual([0, 1]);
      expect(s.game.users.length).toBe(2);
    });

    it("a human leaving mid-game keeps the seat but marks it disconnected", () => {
      const s = new GameSession({ code: "CAIDA-MID", host: { userId: "1", name: "A" } });
      s.addHuman({ userId: "2", name: "B" });
      patchDeck(s);
      s.start(4);
      const r = s.leave("2");
      expect(r.closed).toBe(false);
      const seat = s.seatOf("2");
      expect(seat.connected).toBe(false);
      // Seat NOT removed — per-index engine state must stay aligned.
      expect(s.game.users.length).toBe(2);
    });
  });
});

describe("sessionStore", () => {
  beforeEach(() => sessionStore._clear());

  it("create generates a unique code and seats the host", () => {
    const s = sessionStore.create({ userId: "1", name: "Andres" });
    expect(s.code).toMatch(/^CAIDA-[A-Z2-9]{4}$/);
    expect(s.seats[0].userId).toBe("1");
    expect(sessionStore.get(s.code)).toBe(s);
  });

  it("supports an injected deterministic code generator", () => {
    const s = sessionStore.create({ userId: "1", name: "A" }, { genCode: () => "CAIDA-ZZZZ" });
    expect(s.code).toBe("CAIDA-ZZZZ");
  });

  it("never reuses an in-use code (retries the generator)", () => {
    const codes = ["CAIDA-DUP1", "CAIDA-DUP1", "CAIDA-DUP2"];
    let i = 0;
    const gen = () => codes[i++];
    const a = sessionStore.create({ userId: "1", name: "A" }, { genCode: gen });
    const b = sessionStore.create({ userId: "2", name: "B" }, { genCode: gen });
    expect(a.code).toBe("CAIDA-DUP1");
    expect(b.code).toBe("CAIDA-DUP2"); // skipped the collision
  });

  it("get/remove/join operate by code", () => {
    const s = sessionStore.create({ userId: "1", name: "A" }, { genCode: () => "CAIDA-JOIN" });
    const joined = sessionStore.join("CAIDA-JOIN", { userId: "2", name: "B" });
    expect(joined).toBe(s);
    expect(s.seats.length).toBe(2);
    expect(sessionStore.remove("CAIDA-JOIN")).toBe(true);
    expect(sessionStore.get("CAIDA-JOIN")).toBeNull();
  });

  it("join throws a coded error for an unknown code", () => {
    expect(() => sessionStore.join("CAIDA-NOPE", { userId: "2", name: "B" })).toThrow(
      /no encontrada/,
    );
  });

  it("the store is separate per code (two live sessions coexist)", () => {
    const a = sessionStore.create({ userId: "1", name: "A" }, { genCode: () => "CAIDA-S1" });
    const b = sessionStore.create({ userId: "2", name: "B" }, { genCode: () => "CAIDA-S2" });
    expect(a).not.toBe(b);
    expect(sessionStore.get("CAIDA-S1")).toBe(a);
    expect(sessionStore.get("CAIDA-S2")).toBe(b);
  });

  describe("lastDeal (pegar-en-mesa animation data)", () => {
    // Deck crafted so a startBy=4 deal draws mesa values 5,3,2,6 (Card n →
    // value floor(n/4)+1): 16→5, 8→3, 4→2, 20→6. Only 3 and 2 match the
    // descending prediction 4,3,2,1 → pegado 3 and 2 (total 5).
    const PARTIAL = [16, 11, 10, 8, 38, 19, 4, 25, 18, 20];

    it("records draw order, suits, and per-card pegado", () => {
      const s = new GameSession({ code: "CAIDA-DEAL", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      patchDeck(s, PARTIAL);
      s.start(4);

      expect(s.lastDeal).toBeTruthy();
      expect(s.lastDeal.direction).toBe(4);
      expect(s.lastDeal.seq.map((c) => c.value)).toEqual([5, 3, 2, 6]);
      expect(s.lastDeal.seq.map((c) => c.pegado)).toEqual([0, 3, 2, 0]);
      expect(s.lastDeal.seq.every((c) => typeof c.type === "string")).toBe(true);
      expect(s.lastDeal.seq.map((c) => c.position)).toEqual([4, 2, 1, 5]);
    });

    it("full 4→3→2→1 match pegs every card", () => {
      const s = new GameSession({ code: "CAIDA-DEAL2", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      patchDeck(s); // FIXED_DECK deals 4,3,2,1 on a direction-4 start
      s.start(4);
      expect(s.lastDeal.seq.map((c) => c.value)).toEqual([4, 3, 2, 1]);
      expect(s.lastDeal.seq.map((c) => c.pegado)).toEqual([4, 3, 2, 1]);
    });

    it("clears on the next play", () => {
      const s = new GameSession({ code: "CAIDA-DEAL3", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      patchDeck(s, PARTIAL);
      s.start(4);
      expect(s.lastDeal).toBeTruthy();
      s.play("1", 0); // human seat 0 plays → deal animation is over
      expect(s.lastDeal).toBeNull();
    });
  });

  describe("rematch", () => {
    it("restarts the same seats from a finished game", () => {
      const cfg = new Config({ ...game_modes[1], mata_mesa: "off" });
      cfg.points = 10; // dealer's pegar-en-mesa wins at deal time
      const s = new GameSession({ code: "CAIDA-RM", host: { userId: "1", name: "A" }, config: cfg });
      s.addCpu("medium");
      patchDeck(s);
      s.start(4);
      expect(s.status).toBe("finished");

      const seatsBefore = s.seats.map((x) => ({ userId: x.userId, kind: x.kind }));
      s.rematch();

      expect(s.status).toBe("lobby");
      expect(s.winner).toBeNull();
      expect(s.lastDeal).toBeNull();
      expect(s.seats.map((x) => ({ userId: x.userId, kind: x.kind }))).toEqual(seatsBefore);
      expect(s.game.users.length).toBe(2);
      expect(s.game.decks).toBe(0); // a brand-new engine
      expect(() => s.start()).not.toThrow();
      expect(s.status).toBe("playing");
    });

    it("is refused before the game finished", () => {
      const s = new GameSession({ code: "CAIDA-RM2", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      expect(() => s.rematch()).toThrow(/no terminó/);
    });
  });
});
