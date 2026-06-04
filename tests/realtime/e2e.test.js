const GameSession = require("../../services/realtime/GameSession");
const turnLoop = require("../../services/realtime/turnLoop");
const serializeForClient = require("../../services/realtime/serializeForClient");

/**
 * Synchronous fake scheduler (same pattern as turnLoop.test.js): timers
 * are stored and fired via flush(), so a CPU chain resolves with no real
 * time elapsed.
 */
function fakeScheduler() {
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(fn) {
      const id = nextId++;
      pending.set(id, fn);
      return id;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    flush(maxRounds = 200) {
      let rounds = 0;
      while (pending.size > 0 && rounds < maxRounds) {
        rounds++;
        const batch = [...pending.entries()];
        pending.clear();
        for (const [, fn] of batch) fn();
      }
      return rounds;
    },
    get size() {
      return pending.size;
    },
  };
}

describe("SP1 e2e — solo-vs-CPU full game (T10)", () => {
  afterEach(() => {
    for (const code of [...turnLoop._internal.timers.keys()]) {
      turnLoop._internal.timers.delete(code);
    }
  });

  it("plays a full game to a winner with the turn loop driving CPUs", () => {
    const s = new GameSession({ code: "CAIDA-E2E1", host: { userId: "1", name: "Andrés" } });
    s.addCpu("medium");
    s.addCpu("medium");
    s.addCpu("pro"); // 4 seats: seat 0 human, 1-3 CPU; seat 3 is the dealer
    s.start(); // no eager deal — the CPU dealer holds Start_By; the loop deals

    const sched = fakeScheduler();
    const hostId = "1";
    const broadcasts = [];
    const broadcast = (sess) => broadcasts.push(serializeForClient(sess, hostId));

    let guard = 0;
    while (s.status === "playing" && guard++ < 5000) {
      // Resolve every CPU that is currently up (and any deck deal) in one go.
      turnLoop.drive(s, broadcast, sched);
      sched.flush();
      if (s.status !== "playing") break;

      const state = serializeForClient(s, hostId);
      if (state.turnSeat !== 0) {
        // The loop should have left a human up; if not, bail (caught below).
        break;
      }
      // Human's turn: pick a direction on Start_By, else play the first card.
      if (state.you.hand && state.you.hand.type === "startBy") {
        s.play(hostId, 1);
      } else {
        s.play(hostId, 0);
      }
      broadcast(s);
    }

    expect(s.status).toBe("finished");
    expect(s.winner).toBeTruthy();
    expect(s.winner.seat).toBeGreaterThanOrEqual(0);
    expect(s.winner.standings.length).toBe(4);
    // A broadcast carried the finished state (what wsServer turns into
    // session:ended).
    expect(broadcasts.some((b) => b.status === "finished")).toBe(true);
  });

  it("never leaks a rival's hand in any broadcast across a full game", () => {
    const s = new GameSession({ code: "CAIDA-E2E2", host: { userId: "1", name: "A" } });
    s.addCpu("easy");
    s.addCpu("easy");
    s.start();

    const sched = fakeScheduler();
    const hostId = "1";
    const seen = [];
    const broadcast = (sess) => seen.push(serializeForClient(sess, hostId));

    let guard = 0;
    while (s.status === "playing" && guard++ < 5000) {
      turnLoop.drive(s, broadcast, sched);
      sched.flush();
      if (s.status !== "playing") break;
      const state = serializeForClient(s, hostId);
      if (state.turnSeat !== 0) break;
      if (state.you.hand && state.you.hand.type === "startBy") s.play(hostId, 1);
      else s.play(hostId, 0);
      broadcast(s);
    }

    expect(s.status).toBe("finished");
    expect(seen.length).toBeGreaterThan(0);
    // Invariant: a seat object never carries card data — only the viewer's
    // own hand (state.you.hand) ever holds cards.
    for (const state of seen) {
      for (const seat of state.seats) {
        expect(seat).not.toHaveProperty("hand");
        expect(seat).not.toHaveProperty("cards");
        expect(typeof seat.cardCount).toBe("number");
      }
      // The viewer (seat 0) is the only place a hand appears.
      if (Array.isArray(state.you.hand)) {
        for (const card of state.you.hand) {
          expect(card).toHaveProperty("value");
          expect(card).toHaveProperty("type");
        }
      }
    }
  });
});
