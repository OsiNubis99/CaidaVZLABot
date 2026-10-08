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
      expect(s.leave("2")).toEqual({ left: false });
      expect(s.positionOf("2")).toBe(1);
      s.closeWithWinner(0);
      expect(s.leave("2")).toEqual({ left: true });
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
      expect(host.you).toEqual({ position: 0, isHost: true });
      expect(guest.you).toEqual({ position: 2, isHost: false });
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
      expect(s.toClient("1").you).toEqual({ position: null, isHost: true });
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

    it("winners: the winning pair keeps its seats, the rest stand up (host included)", () => {
      const s = wonBy(1);
      s.rematch("winners");
      expect(s.status).toBe("lobby");
      expect(s.seats.map((x) => x && x.name)).toEqual([null, "Daniel", null, "Jhonne"]);
      expect(s.positionOf("1")).toBe(-1); // the host lost: now referees
      expect(s.isHost("1")).toBe(true);
    });

    it("winners in individual: only the winner stays", () => {
      const s = mk({ config: { type: "individual" } });
      s.addGuest("B");
      s.addGuest("C");
      s.start();
      s.record({ kind: "mesa", seat: 2 });
      s.closeWithWinner(2);
      s.rematch("winners");
      expect(s.seats.map((x) => x && x.name)).toEqual([null, null, "C", null]);
    });

    it("winners uses who actually won even if someone left after the game", () => {
      const s = wonBy(0); // Andrés(0) + Mafeer(2)
      s.leave("4"); // Jhonne leaves: 3 seated → the summary alone would say individual
      s.rematch("winners");
      expect(s.seats.map((x) => x && x.name)).toEqual(["Andrés", null, "Mafeer", null]);
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
