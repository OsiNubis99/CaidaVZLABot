const CompanionSession = require("../../services/companion/CompanionSession");

function mk(over = {}) {
  return new CompanionSession({
    code: "MESA-TEST",
    host: { userId: "1", name: "Andrés" },
    now: () => 1000,
    ...over,
  });
}

/** Host + 3 joined players, all four positions filled (parejas by default). */
function fullTable() {
  const s = mk();
  s.join({ userId: "2", name: "Daniel" }); // pos 1
  s.join({ userId: "3", name: "Mafeer" }); // pos 2
  s.join({ userId: "4", name: "Jhonne" }); // pos 3
  return s;
}

const code = (c) => expect.objectContaining({ code: c });

describe("CompanionSession", () => {
  describe("lobby", () => {
    it("seats the host at the bottom (position 0) with parejas as default", () => {
      const s = mk();
      expect(s.status).toBe("lobby");
      expect(s.positionOf("1")).toBe(0);
      expect(s.config.type).toBe("parejas");
    });

    it("join fills the first free position and is idempotent for a seated user", () => {
      const s = mk();
      expect(s.join({ userId: "2", name: "Daniel" })).toBe(1);
      expect(s.join({ userId: "2", name: "Daniel" })).toBe(1);
      expect(s.seatedCount()).toBe(2);
    });

    it("refuses a 5th player", () => {
      const s = fullTable();
      expect(() => s.join({ userId: "5", name: "E" })).toThrow(code("table_full"));
    });

    it("swap moves players between positions, including into an empty one", () => {
      const s = mk();
      s.join({ userId: "2", name: "Daniel" }); // 1
      s.swap(1, 3); // Daniel → left
      expect(s.positionOf("2")).toBe(3);
      expect(s.seats[1]).toBeNull();
      s.swap(0, 2); // host → top
      expect(s.positionOf("1")).toBe(2);
    });

    it("guests take a free seat; kick frees it; the host can stand up and sit back", () => {
      const s = mk();
      const pos = s.addGuest("Abuela");
      expect(pos).toBe(1);
      expect(s.seats[1]).toMatchObject({ name: "Abuela", guest: true, userId: null });
      s.kick(1);
      expect(s.seats[1]).toBeNull();
      s.kick(0); // host: "no juego, solo anoto"
      expect(s.positionOf("1")).toBe(-1);
      s.sitHost(3);
      expect(s.positionOf("1")).toBe(3);
    });

    it("rejects empty guest names and bad positions", () => {
      const s = mk();
      expect(() => s.addGuest("   ")).toThrow(code("bad_name"));
      expect(() => s.swap(0, 7)).toThrow(code("bad_position"));
      expect(() => s.kick(2)).toThrow(code("empty_seat"));
    });

    it("start needs 2 seated players", () => {
      const s = mk();
      expect(() => s.start()).toThrow(code("not_enough_players"));
      s.addGuest("B");
      s.start();
      expect(s.status).toBe("playing");
      expect(s.startedAt).toBe(1000);
    });

    it("lobby-only actions are refused while playing", () => {
      const s = fullTable();
      s.start();
      expect(() => s.swap(0, 1)).toThrow(code("not_in_lobby"));
      expect(() => s.join({ userId: "9", name: "X" })).toThrow(code("not_in_lobby"));
      expect(() => s.setConfig({ points: 30 })).toThrow(code("not_in_lobby"));
    });
  });

  describe("scoring", () => {
    it("records plays to the person and sums the team in parejas", () => {
      const s = fullTable();
      s.start();
      s.record({ kind: "caida", seat: 0, value: 4 });
      s.record({ kind: "canto", seat: 2, canto: "patrulla" });
      s.record({ kind: "mesa", seat: 1 });
      const sum = s.summary();
      expect(sum.mode).toBe("parejas");
      expect(sum.slots.find((x) => x.slot === 0).total).toBe(10);
      expect(sum.slots.find((x) => x.slot === 1).total).toBe(4);
      expect(s.ops.map((o) => o.points)).toEqual([4, 6, 4]);
    });

    it("refuses plays on an empty seat or before the game starts", () => {
      const s = mk();
      s.addGuest("B");
      expect(() => s.record({ kind: "mesa", seat: 1 })).toThrow(code("not_playing"));
      s.start();
      expect(() => s.record({ kind: "mesa", seat: 3 })).toThrow(code("empty_seat"));
    });

    it("reaching the target leaves a pending win that blocks new plays", () => {
      const s = mk({ config: { points: 10, type: "individual" } });
      s.addGuest("B");
      s.start();
      s.record({ kind: "canto", seat: 0, canto: "registrico" }); // 10
      expect(s.pendingWinSlot).toBe(0);
      expect(s.status).toBe("playing");
      expect(() => s.record({ kind: "mesa", seat: 1 })).toThrow(code("pending_win"));
    });

    it("undo of the winning play clears the pending win", () => {
      const s = mk({ config: { points: 10, type: "individual" } });
      s.addGuest("B");
      s.start();
      s.record({ kind: "mesa", seat: 1 });
      s.record({ kind: "canto", seat: 0, canto: "registrico" });
      s.undo();
      expect(s.pendingWinSlot).toBeNull();
      expect(s.ops.length).toBe(1);
    });

    it("undo by id removes that play only", () => {
      const s = fullTable();
      s.start();
      const a = s.record({ kind: "mesa", seat: 0 });
      s.record({ kind: "mesa", seat: 1 });
      s.undo(a.id);
      expect(s.ops.map((o) => o.seat)).toEqual([1]);
      expect(() => s.undo(999)).toThrow(code("no_such_op"));
    });

    it("confirmWin finishes with the pending slot", () => {
      const s = mk({ config: { points: 10, type: "individual" } });
      s.addGuest("B");
      s.start();
      s.record({ kind: "canto", seat: 1, canto: "registrico" });
      s.confirmWin();
      expect(s.status).toBe("finished");
      expect(s.result).toMatchObject({ winnerSlot: 1, endedBy: "target" });
    });

    it("manual points (mala echada, pegado, cartas al final) go to the person and the team", () => {
      const s = fullTable();
      s.start();
      s.record({ kind: "puntos", seat: 3, value: 5 });
      expect(s.summary().slots.find((x) => x.slot === 1).total).toBe(5);
      s.closeWithWinner(1);
      const jhonne = s.buildRecord().players.find((p) => p.name === "Jhonne");
      expect(jhonne).toMatchObject({ manual: 5, points: 5, won: true });
    });

    it("closeWithWinner ends the game by hand with any valid slot", () => {
      const s = fullTable();
      s.start();
      s.record({ kind: "mesa", seat: 0 });
      expect(() => s.closeWithWinner(5)).toThrow(code("bad_slot"));
      s.closeWithWinner(1); // team B wins by forfeit
      expect(s.result).toMatchObject({ winnerSlot: 1, endedBy: "manual", totals: { 0: 4, 1: 0 } });
    });
  });

  describe("after the game", () => {
    function finished() {
      const s = fullTable();
      s.start();
      s.record({ kind: "caida", seat: 0, value: 2 });
      s.record({ kind: "caida", seat: 0, value: 3 });
      s.record({ kind: "canto", seat: 2, canto: "registro" });
      s.record({ kind: "canto", seat: 3, canto: "ronda", value: 1 });
      s.record({ kind: "mesa", seat: 1 });
      s.closeWithWinner(0);
      return s;
    }

    it("buildRecord: per-person stats + team result", () => {
      const r = finished().buildRecord();
      expect(r).toMatchObject({
        code: "MESA-TEST",
        mode: "parejas",
        target: 24,
        winnerSlot: 0,
        endedBy: "manual",
      });
      const byName = Object.fromEntries(r.players.map((p) => [p.name, p]));
      expect(byName["Andrés"]).toMatchObject({
        userId: "1",
        won: true,
        points: 5,
        caidas: 2,
        slot: 0,
      });
      expect(byName["Mafeer"]).toMatchObject({ won: true, cantos: { registro: 1 } });
      expect(byName["Daniel"]).toMatchObject({ won: false, mesas: 1 });
      expect(byName["Jhonne"]).toMatchObject({ won: false, cantos: { ronda: 1 } });
      expect(r.totals).toEqual({ 0: 13, 1: 5 });
    });

    it("rematch goes back to the lobby with the same seats and a clean score", () => {
      const s = finished();
      s.rematch();
      expect(s.status).toBe("lobby");
      expect(s.ops).toEqual([]);
      expect(s.result).toBeNull();
      expect(s.gameNo).toBe(2);
      expect(s.seatedCount()).toBe(4);
    });

    it("a non-host leaving: frees the seat in lobby/finished, keeps it while playing", () => {
      const s = fullTable();
      s.start();
      expect(s.leave("2")).toEqual({ left: false, dequeued: false });
      expect(s.positionOf("2")).toBe(1);
      s.closeWithWinner(0);
      expect(s.leave("2")).toEqual({ left: true, dequeued: false });
      expect(s.positionOf("2")).toBe(-1);
      expect(() => s.leave("1")).toThrow(code("host_cannot_leave"));
    });
  });

  describe("persistence + client view", () => {
    it("round-trips through JSON", () => {
      const s = fullTable();
      s.start();
      s.record({ kind: "mesa", seat: 2 });
      const back = CompanionSession.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
      expect(back.code).toBe("MESA-TEST");
      expect(back.status).toBe("playing");
      expect(back.ops).toEqual(s.ops);
      back.record({ kind: "mesa", seat: 1 });
      expect(back.ops[1].id).toBe(2); // op sequence continues
    });

    it("toClient hides user ids and tells each viewer who they are", () => {
      const s = fullTable();
      const host = s.toClient("1", new Set(["1", "3"]));
      const guest = s.toClient("3", new Set(["1", "3"]));
      expect(host.you).toMatchObject({ position: 0, isHost: true });
      expect(guest.you).toMatchObject({ position: 2, isHost: false });
      expect(host.seats[2]).toMatchObject({ name: "Mafeer", online: true, isHost: false });
      expect(host.seats[1].online).toBe(false);
      expect(JSON.stringify(host)).not.toMatch(/"userId"/);
      expect(host.hostPosition).toBe(0);
    });
  });

  describe("referee (the creator doesn't have to play)", () => {
    it("starts unseated but still runs the table", () => {
      const s = mk({ hostSeated: false });
      expect(s.positionOf("1")).toBe(-1);
      expect(s.isHost("1")).toBe(true);
      expect(s.seatedCount()).toBe(0);
      expect(s.toClient("1").you).toMatchObject({ position: null, isHost: true });
      expect(s.toClient("1").hostPosition).toBeNull();
    });

    it("scores a game without getting stats", () => {
      const s = mk({ hostSeated: false });
      s.addGuest("Ana");
      s.join({ userId: "2", name: "Beto" });
      s.start();
      s.record({ kind: "mesa", seat: 0 });
      s.closeWithWinner(0);
      expect(s.buildRecord().players.map((p) => p.name)).toEqual(["Ana", "Beto"]);
    });

    it("sitHost with no position takes the first free seat", () => {
      const s = mk({ hostSeated: false });
      s.addGuest("Ana"); // 0
      expect(s.sitHost()).toBe(1);
      expect(() => s.sitHost()).toThrow(code("already_seated"));
    });
  });

  describe("next game after a win", () => {
    /** Parejas at 4: Andrés(0) Daniel(1) Mafeer(2) Jhonne(3); `slot` wins by hand. */
    function wonBy(slot) {
      const s = fullTable();
      s.start();
      s.record({ kind: "mesa", seat: 1 });
      s.closeWithWinner(slot);
      return s;
    }

    it("the result remembers who won (positions)", () => {
      expect(wonBy(1).result).toMatchObject({ winnerSlot: 1, mode: "parejas", winners: [1, 3] });
    });

    it("again: same seats, the next game starts right away", () => {
      const s = wonBy(0);
      s.rematch("again");
      expect(s.status).toBe("playing");
      expect(s.gameNo).toBe(2);
      expect(s.ops).toEqual([]);
      expect(s.result).toBeNull();
      expect(s.seatedCount()).toBe(4);
      s.record({ kind: "mesa", seat: 2 });
      expect(s.ops[0].id).toBe(1);
    });

    it("winners: the winning pair keeps its seats, the losers line up (host included)", () => {
      const s = wonBy(1);
      s.enqueueGuest("E");
      s.enqueueGuest("F");
      s.rematch("winners");
      expect(s.status).toBe("lobby");
      expect(s.seats.map((x) => x && x.name)).toEqual(["E", "Daniel", "F", "Jhonne"]);
      expect(s.queue.map((e) => e.name)).toEqual(["Andrés", "Mafeer"]);
      expect(s.positionOf("1")).toBe(-1); // the host lost: referees while in line
      expect(s.isHost("1")).toBe(true);
    });

    it("winners in individual: only the winner stays", () => {
      const s = mk({ config: { type: "individual" } });
      s.addGuest("B");
      s.addGuest("C");
      s.start();
      s.record({ kind: "mesa", seat: 2 });
      s.closeWithWinner(2);
      for (const n of ["X", "Y", "Z"]) s.enqueueGuest(n);
      s.rematch("winners");
      expect(s.seats.map((x) => x && x.name)).toEqual(["X", "Y", "C", "Z"]);
      expect(s.queue.map((e) => e.name)).toEqual(["Andrés", "B"]);
    });

    it("winners uses who actually won even if someone left after the game", () => {
      const s = wonBy(0); // Andrés(0) + Mafeer(2)
      s.leave("4"); // Jhonne leaves: 3 seated → the summary alone would say individual
      s.enqueueGuest("E");
      s.enqueueGuest("F");
      s.rematch("winners");
      // Mafeer still counts as a winner: only Daniel lines up.
      expect(s.seats.map((x) => x && x.name)).toEqual(["Andrés", "E", "Mafeer", "F"]);
      expect(s.queue.map((e) => e.name)).toEqual(["Daniel"]);
    });

    it("lobby (default): everyone back to the lobby to reorganize", () => {
      const s = wonBy(0);
      s.rematch();
      expect(s.status).toBe("lobby");
      expect(s.seatedCount()).toBe(4);
    });

    it("rejects unknown options, and 'again' with fewer than 2 seated", () => {
      expect(() => wonBy(0).rematch("todos")).toThrow(code("bad_mode"));
      const u = mk({ config: { type: "individual" } });
      u.join({ userId: "2", name: "B" });
      u.start();
      u.closeWithWinner(0);
      u.leave("2");
      expect(() => u.rematch("again")).toThrow(code("not_enough_players"));
      expect(u.status).toBe("finished");
    });
  });
});

describe("CompanionSession — people, queue and referee role", () => {
  const { MAX_QUEUE } = CompanionSession;
  const names = (s) => s.seats.map((x) => x && x.name);
  const line = (s) => s.queue.map((e) => e.name);

  describe("queue (pedir la próxima)", () => {
    it("someone watching queues once; seated people can't; the referee adds guests", () => {
      const s = fullTable();
      const q1 = s.enqueue({ userId: "5", name: "Pedro" });
      expect(s.enqueue({ userId: "5", name: "Pedro" })).toBe(q1); // idempotent
      expect(() => s.enqueue({ userId: "2", name: "Daniel" })).toThrow(code("already_seated"));
      s.enqueueGuest("Luis");
      expect(line(s)).toEqual(["Pedro", "Luis"]);
      expect(s.queue[1]).toMatchObject({ userId: null, guest: true });
      expect(() => s.enqueueGuest("   ")).toThrow(code("bad_name"));
    });

    it("leaving the line: the referee removes an entry, or a person leaves it themselves", () => {
      const s = fullTable();
      const a = s.enqueue({ userId: "5", name: "Pedro" });
      s.enqueueGuest("Luis");
      s.dequeue(a);
      expect(line(s)).toEqual(["Luis"]);
      expect(() => s.dequeue(999)).toThrow(code("not_in_queue"));
      s.enqueue({ userId: "6", name: "Ana" });
      expect(s.dequeueUser("6")).toBe(true);
      expect(s.dequeueUser("6")).toBe(false);
      expect(line(s)).toEqual(["Luis"]);
    });

    it("has a cap", () => {
      const s = fullTable();
      for (let i = 0; i < MAX_QUEUE; i++) s.enqueueGuest("G" + i);
      expect(() => s.enqueueGuest("uno más")).toThrow(code("queue_full"));
    });

    it("taking a seat or leaving the table takes you out of the line", () => {
      const s = mk();
      s.enqueue({ userId: "5", name: "Pedro" });
      s.join({ userId: "5", name: "Pedro" });
      expect(s.queue).toEqual([]);
      s.enqueue({ userId: "6", name: "Ana" });
      expect(s.leave("6")).toEqual({ left: false, dequeued: true });
      expect(s.queue).toEqual([]);
    });

    it("the referee seats someone from the line on an empty seat (lobby)", () => {
      const s = mk(); // host at 0
      s.addGuest("B"); // 1
      const qid = s.enqueue({ userId: "5", name: "Pedro" });
      expect(s.seatFromQueue(qid, 3)).toBe(3);
      expect(s.seats[3]).toEqual({ userId: "5", name: "Pedro", guest: false });
      expect(s.queue).toEqual([]);
      const g = s.enqueueGuest("Luis");
      expect(() => s.seatFromQueue(g, 1)).toThrow(code("seat_taken"));
      expect(s.seatFromQueue(g, 2, { canSeat: () => false })).toBe(2); // guests are never busy
    });

    it("won't seat someone who's playing at another table", () => {
      const s = mk();
      const qid = s.enqueue({ userId: "5", name: "Pedro" });
      expect(() => s.seatFromQueue(qid, 1, { canSeat: () => false })).toThrow(code("busy"));
      expect(line(s)).toEqual(["Pedro"]);
    });

    it("survives a restart", () => {
      const s = fullTable();
      s.enqueue({ userId: "5", name: "Pedro" });
      s.enqueueGuest("Luis");
      const back = CompanionSession.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
      expect(line(back)).toEqual(["Pedro", "Luis"]);
      const next = back.enqueueGuest("Ana");
      expect(next).toBeGreaterThan(Math.max(...s.queue.map((e) => e.qid)));
    });
  });

  describe("winners stay + the line", () => {
    /** Parejas at 4, the B pair (Daniel 1 + Jhonne 3) wins; `queued` lines up first. */
    function wonByB(queued = []) {
      const s = fullTable();
      for (const q of queued) {
        if (q.guest) s.enqueueGuest(q.name);
        else s.enqueue(q);
      }
      s.start();
      s.closeWithWinner(1);
      return s;
    }

    it("the first in line take the losers' seats; the losers go to the end of the line", () => {
      const s = wonByB([
        { userId: "5", name: "Pedro" },
        { guest: true, name: "Luis" },
      ]);
      s.rematch("winners");
      expect(names(s)).toEqual(["Pedro", "Daniel", "Luis", "Jhonne"]);
      expect(line(s)).toEqual(["Andrés", "Mafeer"]);
      expect(s.status).toBe("lobby");
    });

    it("only one waiting: they play with the first loser", () => {
      const s = wonByB([{ userId: "5", name: "Pedro" }]);
      s.rematch("winners");
      expect(names(s)).toEqual(["Pedro", "Daniel", "Andrés", "Jhonne"]);
      expect(line(s)).toEqual(["Mafeer"]);
    });

    it("nobody waiting: the losers sit back down where they were", () => {
      const s = wonByB();
      s.rematch("winners");
      expect(names(s)).toEqual(["Andrés", "Daniel", "Mafeer", "Jhonne"]);
      expect(s.queue).toEqual([]);
    });

    it("skips someone busy at another table (they keep their place in line)", () => {
      const s = wonByB([
        { userId: "5", name: "Pedro" },
        { userId: "6", name: "Ana" },
        { guest: true, name: "Luis" },
      ]);
      s.rematch("winners", { canSeat: (id) => id !== "5" });
      expect(names(s)).toEqual(["Ana", "Daniel", "Luis", "Jhonne"]);
      expect(line(s)).toEqual(["Pedro", "Andrés", "Mafeer"]);
    });

    it("guests who lose keep their name in the line", () => {
      const s = mk();
      s.addGuest("Invitado"); // 1
      s.join({ userId: "3", name: "Mafeer" }); // 2
      s.addGuest("Otro"); // 3
      s.start();
      s.closeWithWinner(0); // Andrés + Mafeer win
      s.enqueue({ userId: "5", name: "Pedro" });
      s.rematch("winners");
      expect(names(s)).toEqual(["Andrés", "Pedro", "Mafeer", "Invitado"]);
      expect(s.queue).toEqual([
        expect.objectContaining({ name: "Otro", guest: true, userId: null }),
      ]);
    });

    it("'again' and 'lobby' leave the line alone", () => {
      for (const mode of ["again", "lobby"]) {
        const s = wonByB([{ userId: "5", name: "Pedro" }]);
        s.rematch(mode);
        expect(line(s)).toEqual(["Pedro"]);
        expect(s.seatedCount()).toBe(4);
      }
    });
  });

  describe("referee role: pass it on / take it over", () => {
    it("passing it to a seated player: they run the table, the old referee keeps playing", () => {
      const s = fullTable();
      s.transferHost({ userId: "3", name: "Mafeer" });
      expect(s.isHost("3")).toBe(true);
      expect(s.isHost("1")).toBe(false);
      expect(s.hostName).toBe("Mafeer");
      expect(s.positionOf("1")).toBe(0);
      expect(s.toClient("1").you).toMatchObject({ position: 0, isHost: false });
      expect(s.toClient("3")).toMatchObject({ hostPosition: 2, you: { isHost: true } });
    });

    it("passing it to someone watching; a referee in line leaves the line", () => {
      const s = mk({ hostSeated: false });
      s.enqueue({ userId: "9", name: "Carlos" });
      s.transferHost({ userId: "9", name: "Carlos" });
      expect(s.toClient("9")).toMatchObject({
        hostPosition: null,
        you: { position: null, isHost: true },
      });
      expect(s.queue).toEqual([]);
    });

    it("refuses passing it to yourself or to a guest", () => {
      const s = fullTable();
      expect(() => s.transferHost({ userId: "1", name: "Andrés" })).toThrow(code("already_host"));
      expect(() => s.transferHost({ userId: null, name: "Luis" })).toThrow(code("bad_target"));
    });

    it("works in any phase (mid-game too) and survives a restart", () => {
      const s = fullTable();
      s.start();
      s.record({ kind: "mesa", seat: 1 });
      s.transferHost({ userId: "2", name: "Daniel" });
      s.record({ kind: "mesa", seat: 2 });
      const back = CompanionSession.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
      expect(back.isHost("2")).toBe(true);
      expect(back.hostName).toBe("Daniel");
    });

    it("taking it over: only once the referee has been away long enough", () => {
      const s = fullTable();
      const away = (ms) => ({ hostAwayMs: ms, claimAfterMs: 300_000 });
      expect(() => s.claimHost({ userId: "2", name: "Daniel" }, away(null))).toThrow(
        code("referee_online"),
      );
      expect(() => s.claimHost({ userId: "2", name: "Daniel" }, away(299_999))).toThrow(
        code("too_soon"),
      );
      s.claimHost({ userId: "2", name: "Daniel" }, away(300_000));
      expect(s.isHost("2")).toBe(true);
      expect(() => s.claimHost({ userId: "2", name: "Daniel" }, away(400_000))).toThrow(
        code("already_host"),
      );
    });
  });

  describe("who's at the table (toClient)", () => {
    const presence = (ids, extra = {}) => ({
      online: new Set(ids),
      watchers: new Map(ids.map((id) => [id, "@u" + id])),
      ...extra,
    });

    it("lists who's watching (connected, not seated, not the referee, not in line) and the line", () => {
      const s = fullTable();
      s.enqueue({ userId: "5", name: "Pedro" });
      s.enqueueGuest("Luis");
      const st = s.toClient("7", presence(["1", "2", "5", "7", "8"]));
      expect(st.spectators.map((x) => x.name)).toEqual(["@u7", "@u8"]);
      // the viewer finds themselves in the list
      expect(st.spectators.map((x) => x.you)).toEqual([true, false]);
      expect(st.queue).toEqual([
        expect.objectContaining({ name: "Pedro", guest: false, online: true, you: false }),
        expect.objectContaining({ name: "Luis", guest: true, online: false, you: false }),
      ]);
      expect(st.hostOnline).toBe(true);
      expect(st.you).toMatchObject({
        position: null,
        isHost: false,
        queued: null,
        claimInMs: null,
      });
      expect(s.toClient("5", presence(["5"])).you.queued).toBe(1);
    });

    it("never sends Telegram ids: people are referenced by an opaque per-table id", () => {
      const s = fullTable();
      s.enqueue({ userId: "5", name: "Pedro" });
      const st = s.toClient("1", presence(["1", "2", "5", "7"]));
      expect(JSON.stringify(st)).not.toMatch(/"userId"/);
      const pid = st.spectators[0].pid;
      expect(pid).toMatch(/^[\w-]{6,}$/);
      expect(s.userIdForPid(pid)).toBe("7");
      expect(s.userIdForPid(st.seats[1].pid)).toBe("2");
      expect(s.userIdForPid(st.queue[0].pid)).toBe("5");
      expect(s.userIdForPid("nope")).toBeNull();
    });

    it("tells non-referees when they can take the role over", () => {
      const s = fullTable();
      const st = (viewer, ms) =>
        s.toClient(viewer, presence(["2", "7"], { hostAwayMs: ms, claimAfterMs: 300_000 }));
      expect(st("2", 120_000).you.claimInMs).toBe(180_000);
      expect(st("7", 400_000).you.claimInMs).toBe(0);
      expect(st("2", 400_000).hostOnline).toBe(false);
      expect(s.toClient("1", presence(["1"], { hostAwayMs: null })).you.claimInMs).toBeNull();
    });
  });
});
