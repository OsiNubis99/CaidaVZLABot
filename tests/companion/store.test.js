const store = require("../../services/companion/store");
const CompanionSession = require("../../services/companion/CompanionSession");

function fakeRepo() {
  const rows = new Map();
  return {
    rows,
    games: [],
    saveSession: vi.fn(async (code, state) => rows.set(code, JSON.parse(JSON.stringify(state)))),
    deleteSession: vi.fn(async (code) => rows.delete(code)),
    loadSessions: vi.fn(async () => [...rows.values()]),
    insertGame: vi.fn(async function (rec) {
      this.games.push(rec);
      return this.games.length;
    }),
  };
}

describe("companion store", () => {
  let repo;
  let clock;
  beforeEach(() => {
    store._clear();
    repo = fakeRepo();
    clock = 1_000_000;
    store.configure({ repo, now: () => clock });
  });

  it("create gives a MESA- code, seats the host, and persists after flush", async () => {
    const s = store.create({ userId: 1, name: "Andrés" });
    expect(s.code).toMatch(/^MESA-[A-Z2-9]{4}$/);
    expect(store.get(s.code)).toBe(s);
    await store.flush();
    expect(repo.saveSession).toHaveBeenCalledTimes(1);
    expect(repo.rows.get(s.code).seats[0]).toMatchObject({ userId: "1" });
  });

  it("debounces saves: several changes → one write", async () => {
    const s = store.create({ userId: 1, name: "A" }, { genCode: () => "MESA-AAAA" });
    s.addGuest("B");
    store.persist(s);
    s.addGuest("C");
    store.persist(s);
    await store.flush();
    expect(repo.saveSession).toHaveBeenCalledTimes(1);
    expect(repo.rows.get("MESA-AAAA").seats.filter(Boolean).length).toBe(3);
  });

  it("findByUser: seated players and a standing host; live tables first", () => {
    const a = store.create({ userId: 1, name: "A" }, { genCode: () => "MESA-AAA1" });
    a.join({ userId: 2, name: "B" });
    expect(store.findByUser(2)).toBe(a);
    a.kick(0); // host stands up ("solo anoto")
    expect(store.findByUser(1)).toBe(a);
    expect(store.findByUser(99)).toBeNull();
  });

  it("loadAll rehydrates persisted tables", async () => {
    const s = store.create({ userId: 1, name: "A" }, { genCode: () => "MESA-LOAD" });
    s.addGuest("B");
    s.start();
    s.record({ kind: "mesa", seat: 1 });
    store.persist(s);
    await store.flush();
    store._clear();
    expect(store.get("MESA-LOAD")).toBeNull();
    expect(await store.loadAll()).toBe(1);
    const back = store.get("MESA-LOAD");
    expect(back).toBeInstanceOf(CompanionSession);
    expect(back.status).toBe("playing");
    expect(back.ops.length).toBe(1);
  });

  it("sweepExpired drops tables idle for too long (memory + DB)", async () => {
    const old = store.create({ userId: 1, name: "A" }, { genCode: () => "MESA-OLD1" });
    clock += store.IDLE_MS + 1;
    const fresh = store.create({ userId: 2, name: "B" }, { genCode: () => "MESA-NEW1" });
    const removed = store.sweepExpired();
    expect(removed.map((s) => s.code)).toEqual([old.code]);
    expect(store.get(old.code)).toBeNull();
    expect(store.get(fresh.code)).toBe(fresh);
    expect(repo.deleteSession).toHaveBeenCalledWith("MESA-OLD1");
  });

  it("saveGame writes the finished record", async () => {
    const s = store.create({ userId: 1, name: "A" }, { genCode: () => "MESA-SAVE" });
    s.addGuest("B");
    s.start();
    s.record({ kind: "mesa", seat: 0 });
    s.closeWithWinner(0);
    await store.saveGame(s);
    expect(repo.insertGame).toHaveBeenCalledTimes(1);
    const rec = repo.games[0];
    expect(rec.players.map((p) => [p.name, p.userId, p.won])).toEqual([
      ["A", "1", true],
      ["B", null, false],
    ]);
  });
});
