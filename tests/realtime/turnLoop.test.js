const GameSession = require("../../services/realtime/GameSession");
const turnLoop = require("../../services/realtime/turnLoop");
const Config = require("../../class/Config");
const game_modes = require("../../lang/game_modes_es");

// Same deterministic deck the GameSession tests use: the 4→1 Oro sequence
// lands on the table on a direction-4 deal, and seat 0 is up first.
const FIXED_DECK = [
  12, 16, 20, 8, 24, 28, 4, 32, 36, 0, 11, 10, 38, 19, 25, 18, 14, 2, 5, 39, 15, 29, 30, 1, 9, 35,
  22, 31, 6, 3, 23, 34, 21, 7, 33, 37, 26, 13, 27, 17,
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

/**
 * A synchronous fake scheduler standing in for setTimeout/clearTimeout.
 * Timers are stored and fired manually via flush(), so the loop's chaining
 * resolves deterministically with no real time elapsed.
 */
function fakeScheduler() {
  let nextId = 1;
  const pending = new Map(); // id → fn
  return {
    setTimeout(fn) {
      const id = nextId++;
      pending.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    // Fire all currently-pending timers in insertion order, repeatedly,
    // until no new ones are scheduled (resolves a CPU chain in one call).
    flush(maxRounds = 50) {
      let rounds = 0;
      while (pending.size > 0 && rounds < maxRounds) {
        rounds++;
        const batch = [...pending.entries()];
        pending.clear();
        for (const [, fn] of batch) fn();
      }
      return rounds;
    },
    // Fire exactly the timers pending right now (one round), ignoring any
    // re-armed during the round. Lets a test assert a single auto-skip.
    tick() {
      const batch = [...pending.entries()];
      pending.clear();
      for (const [, fn] of batch) fn();
    },
    get size() {
      return pending.size;
    },
  };
}

function configWithTimeout(seconds) {
  return new Config({ ...game_modes[1], turn_timeout_seconds: seconds });
}

describe("turnLoop", () => {
  afterEach(() => {
    // Wipe module-scope timers so a test's session code can't leak into the
    // next. (clear with the real scheduler is a no-op on fake handles.)
    for (const code of [...turnLoop._internal.timers.keys()]) {
      turnLoop._internal.timers.delete(code);
    }
  });

  describe("CPU auto-step", () => {
    it("auto-plays a CPU seat that is up after a human play", () => {
      const s = new GameSession({ code: "CAIDA-TL01", host: { userId: "1", name: "A" } });
      s.addCpu("medium"); // seat 1 (also the dealer)
      patchDeck(s);
      s.start(4); // eager deal; seat 0 (human) is up first
      expect(s.game.player).toBe(0);

      const sched = fakeScheduler();
      const states = [];
      const broadcast = (sess) => states.push(sess.game.player);

      // Human plays → it becomes the CPU's (seat 1) turn.
      s.play("1", 0);
      broadcast(s);
      expect(s.game.player).toBe(1);

      turnLoop.drive(s, broadcast, sched);
      expect(sched.size).toBe(1); // a CPU step is armed
      sched.flush();
      // The CPU consumed its turn; play advanced off seat 1.
      expect(s.game.player).not.toBe(1);
      expect(states.length).toBeGreaterThan(1);
    });

    it("resolves a chain of CPUs without a human in between", () => {
      // 1 human + 3 CPUs: after the human plays, seats 1,2,3 are all CPUs
      // and must each auto-step in sequence back to the human.
      const s = new GameSession({ code: "CAIDA-TL02", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      s.addCpu("easy");
      s.addCpu("easy"); // seat 3 is the dealer
      patchDeck(s);
      s.start(4);
      expect(s.game.player).toBe(0);

      const sched = fakeScheduler();
      const broadcast = () => {};

      s.play("1", 0); // human seat 0 plays → seat 1 (CPU) up
      expect(s.game.player).toBe(1);

      turnLoop.drive(s, broadcast, sched);
      sched.flush();
      // All three CPUs played and the turn is back to the human (seat 0),
      // or the deck advanced to a new mano (player resets to 0 too). A human
      // seat has no cpu_difficulty set (null on the engine User).
      expect(s.game.users[s.game.player].cpu_difficulty).toBeFalsy();
      expect(sched.size).toBe(0); // no leftover CPU timer once a human is up
    });

    it("a CPU dealer picks a direction out of the Start_By state", () => {
      // No eager direction: after start() the dealer (a CPU) holds Start_By
      // and the loop must drive it to pick 1/4 and deal.
      const s = new GameSession({ code: "CAIDA-TL03", host: { userId: "1", name: "A" } });
      s.addCpu("medium"); // seat 1 = dealer = CPU
      patchDeck(s);
      s.start(); // no eager deal → dealer holds Start_By
      expect(turnLoop._internal.isStartByState(s.game)).toBe(true);

      const sched = fakeScheduler();
      turnLoop.drive(s, () => {}, sched);
      expect(sched.size).toBe(1);
      sched.flush();
      // Deck dealt → no longer Start_By, table has cards.
      expect(turnLoop._internal.isStartByState(s.game)).toBe(false);
      expect(s.game.table.filter(Boolean).length).toBeGreaterThan(0);
    });

    it("does not arm any timer when a human seat is up (no timeout config)", () => {
      const s = new GameSession({ code: "CAIDA-TL04", host: { userId: "1", name: "A" } });
      s.addCpu("easy");
      patchDeck(s);
      s.start(4); // seat 0 (human) up, default config has no turn timeout
      const sched = fakeScheduler();
      turnLoop.drive(s, () => {}, sched);
      expect(sched.size).toBe(0);
    });

    it("clears timers and stops once the game is finished", () => {
      const cfg = new Config({ ...game_modes[1], mata_mesa: "off" });
      cfg.points = 10; // dealer's pegar-en-mesa wins at deal time
      const s = new GameSession({
        code: "CAIDA-TL05",
        host: { userId: "1", name: "A" },
        config: cfg,
      });
      s.addCpu("easy");
      patchDeck(s);
      s.start(4);
      expect(s.status).toBe("finished");
      const sched = fakeScheduler();
      turnLoop.drive(s, () => {}, sched);
      expect(sched.size).toBe(0); // nothing armed for a finished game
    });

    it("broadcasts a finished status when a CPU's own move ends the game", () => {
      // CPU dealer in Start_By state; its direction pick deals a 10-point
      // mesa that wins immediately (mata_mesa off, points=10). The win
      // resolves INSIDE the CPU step, so the injected broadcast must observe
      // status:finished — this is what lets wsServer emit session:ended for a
      // CPU-resolved win (incl. the CVB-5 deferred pegar-en-mesa case).
      const cfg = new Config({ ...game_modes[1], mata_mesa: "off" });
      cfg.points = 10;
      const s = new GameSession({
        code: "CAIDA-TL09",
        host: { userId: "1", name: "A" },
        config: cfg,
      });
      s.addCpu("easy"); // seat 1 = dealer = CPU
      patchDeck(s);
      s.start(); // no eager deal → CPU dealer holds Start_By
      expect(s.status).toBe("playing");

      const sched = fakeScheduler();
      const seen = [];
      turnLoop.drive(s, (sess) => seen.push(sess.status), sched);
      sched.flush();
      expect(s.status).toBe("finished");
      expect(seen).toContain("finished"); // broadcast fired with the win
      expect(sched.size).toBe(0); // no leftover timers
    });
  });

  describe("human turn timeout", () => {
    it("auto-skips a human who runs out the clock", () => {
      const s = new GameSession({
        code: "CAIDA-TL06",
        host: { userId: "1", name: "A" },
        config: configWithTimeout(15),
      });
      s.addCpu("easy"); // seat 1
      patchDeck(s);
      s.start(4); // human seat 0 up
      expect(s.game.player).toBe(0);
      const handBefore = s.game.users[s.game.get_user_index("1")].cards.length;

      const sched = fakeScheduler();
      const broadcasts = [];
      turnLoop.drive(s, (sess) => broadcasts.push(sess.status), sched);
      expect(sched.size).toBe(1); // skip timer armed for the human

      // tick() fires only the skip armed right now (the follow-up CPU step
      // it re-arms stays pending), so we can assert exactly one auto-skip.
      sched.tick();
      // The human's index-0 (forced/lowest) card was played → hand shrank
      // by one and the turn moved off seat 0.
      const handAfter = s.game.users[s.game.get_user_index("1")].cards.length;
      expect(handAfter).toBe(handBefore - 1);
      expect(s.game.player).not.toBe(0);
      expect(broadcasts.length).toBe(1);
    });

    it("a play cancels the pending skip timer (re-drive clears it)", () => {
      const s = new GameSession({
        code: "CAIDA-TL07",
        host: { userId: "1", name: "A" },
        config: configWithTimeout(15),
      });
      s.addHuman({ userId: "2", name: "B" });
      patchDeck(s);
      s.start(4); // seat 0 up
      const sched = fakeScheduler();
      turnLoop.drive(s, () => {}, sched);
      expect(sched.size).toBe(1); // skip armed for seat 0

      // Seat 0 acts, then we re-drive (as the WS layer does after a play).
      s.play("1", 0);
      turnLoop.drive(s, () => {}, sched);
      // The old skip timer was cleared; a fresh one armed for seat 1.
      expect(sched.size).toBe(1);
      // Firing it skips seat 1, not seat 0 (stale guard intact).
      const handBefore = s.game.users[s.game.get_user_index("2")].cards.length;
      sched.tick();
      const handAfter = s.game.users[s.game.get_user_index("2")].cards.length;
      expect(handAfter).toBe(handBefore - 1);
    });

    it("clear() wipes a pending timer", () => {
      const s = new GameSession({
        code: "CAIDA-TL08",
        host: { userId: "1", name: "A" },
        config: configWithTimeout(15),
      });
      s.addHuman({ userId: "2", name: "B" });
      patchDeck(s);
      s.start(4);
      const sched = fakeScheduler();
      turnLoop.drive(s, () => {}, sched);
      expect(sched.size).toBe(1);
      turnLoop.clear(s.code, sched);
      expect(sched.size).toBe(0);
      expect(turnLoop._internal.timers.has(s.code)).toBe(false);
    });
  });
});
