// Deterministic bot token BEFORE anything reads config/env (module registry is
// per test file in vitest, so this stays scoped here).
process.env.TELEGRAM_TOKEN = "TEST:companion-token";
process.env.DASHBOARD_BASE_URL = "https://example.test/caidavzlabot";

const crypto = require("crypto");
const http = require("http");
const { Server } = require("socket.io");
const { io: ioClient } = require("socket.io-client");

const companionWs = require("../../services/companion/companionWs");
const store = require("../../services/companion/store");
const { C2S, S2C, NAMESPACE } = require("../../services/companion/protocol");

function makeInitData(user) {
  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("user", JSON.stringify(user));
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_TOKEN)
    .digest();
  params.set("hash", crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex"));
  return params.toString();
}

const PATH = "/caidavzlabot/socket.io/";
let server;
let io;
let port;
let repo;
const open = new Set();

function connect(user) {
  const sock = ioClient(`http://127.0.0.1:${port}${NAMESPACE}`, {
    path: PATH,
    auth: { initData: typeof user === "string" ? user : makeInitData(user) },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  open.add(sock);
  return sock;
}

function waitFor(socket, event, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

/** Resolve with the first state this socket receives that matches `pred`. */
function until(socket, pred, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(S2C.STATE, on);
      reject(new Error("timeout waiting for a matching state"));
    }, ms);
    function on(p) {
      if (!pred(p.state)) return;
      clearTimeout(timer);
      socket.off(S2C.STATE, on);
      resolve(p.state);
    }
    socket.on(S2C.STATE, on);
  });
}

/** Emit and resolve with the error code this socket gets back (states ignored). */
function errorOf(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(S2C.ERROR, on);
      reject(new Error(`no error for ${event}`));
    }, 2000);
    function on(e) {
      clearTimeout(timer);
      socket.off(S2C.ERROR, on);
      resolve(e.code);
    }
    socket.on(S2C.ERROR, on);
    socket.emit(event, payload);
  });
}

/** Emit and resolve with the next state (or error) this socket receives. */
function act(socket, event, payload = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no reply to ${event}`)), 2000);
    const onState = (p) => done(p.state);
    const onError = (e) => done({ error: e });
    function done(v) {
      clearTimeout(timer);
      socket.off(S2C.STATE, onState);
      socket.off(S2C.ERROR, onError);
      resolve(v);
    }
    socket.on(S2C.STATE, onState);
    socket.on(S2C.ERROR, onError);
    socket.emit(event, payload);
  });
}

async function hostWithTable(id = 1, name = "Andrés") {
  const host = connect({ id, first_name: name });
  await waitFor(host, "connect");
  const first = waitFor(host, S2C.STATE);
  const { code } = await new Promise((res) => host.emit(C2S.CREATE, {}, res));
  await first;
  return { host, code };
}

describe("companion ws (/companion namespace)", () => {
  beforeAll(async () => {
    server = http.createServer();
    io = new Server(server, { path: PATH, serveClient: false });
    companionWs.attach(io);
    await new Promise((res) => server.listen(0, "127.0.0.1", res));
    port = server.address().port;
  });

  afterAll(async () => {
    for (const s of open) s.disconnect();
    await new Promise((res) => io.close(res));
    await new Promise((res) => server.close(res));
  });

  beforeEach(() => {
    store._clear();
    repo = {
      games: [],
      failNext: false,
      saveSession: vi.fn(async () => {}),
      deleteSession: vi.fn(async () => {}),
      loadSessions: vi.fn(async () => []),
      insertGame: vi.fn(async (rec) => {
        if (repo.failNext) {
          repo.failNext = false;
          throw new Error("db down");
        }
        repo.games.push(rec);
        return repo.games.length;
      }),
    };
    store.configure({ repo });
  });

  afterEach(() => {
    for (const s of open) s.disconnect();
    open.clear();
  });

  it("rejects an invalid initData", async () => {
    const sock = connect("not-signed");
    const err = await waitFor(sock, "connect_error");
    expect(String(err.message)).toMatch(/unauthorized/);
  });

  it("create → the host is seated at the bottom, parejas by default", async () => {
    const { host, code } = await hostWithTable();
    expect(code).toMatch(/^MESA-/);
    const st = await act(host, C2S.RESUME);
    expect(st.you).toMatchObject({ position: 0, isHost: true });
    expect(st.config.type).toBe("parejas");
    expect(st.seats[0]).toMatchObject({ name: "Andrés", online: true });
  });

  it("a friend joins by code; both see the table; only the host can arrange it", async () => {
    const { host, code } = await hostWithTable(10);
    const friend = connect({ id: 11, first_name: "Daniel" });
    await waitFor(friend, "connect");
    const hostSees = waitFor(host, S2C.STATE);
    const st = await act(friend, C2S.JOIN, { code: code.replace("MESA-", "") }); // bare suffix works
    expect(st.you).toMatchObject({ position: 1, isHost: false });
    expect((await hostSees).state.seats[1]).toMatchObject({ name: "Daniel", online: true });

    const denied = await act(friend, C2S.SWAP, { a: 0, b: 1 });
    expect(denied.error.code).toBe("not_host");

    const swapped = await act(host, C2S.SWAP, { a: 1, b: 2 });
    expect(swapped.seats[2]).toMatchObject({ name: "Daniel" });
    expect(swapped.seats[1]).toBeNull();
  });

  it("score a whole game: record, undo, reach the target, confirm → saved once", async () => {
    const { host } = await hostWithTable(20);
    await act(host, C2S.CONFIG, { config: { points: 12, type: "individual" } });
    await act(host, C2S.GUEST, { name: "Abuela" });
    let st = await act(host, C2S.START);
    expect(st.status).toBe("playing");

    st = await act(host, C2S.RECORD, { kind: "caida", seat: 1, value: 4 });
    expect(st.slots.find((s) => s.slot === 1).total).toBe(4);
    st = await act(host, C2S.UNDO);
    expect(st.ops).toEqual([]);

    await act(host, C2S.RECORD, { kind: "mesa", seat: 0 }); // 4
    st = await act(host, C2S.RECORD, { kind: "canto", seat: 0, canto: "registro" }); // 12
    expect(st.pendingWin).toEqual({ slot: 0 });
    const blocked = await act(host, C2S.RECORD, { kind: "mesa", seat: 1 });
    expect(blocked.error.code).toBe("pending_win");

    st = await act(host, C2S.CONFIRM);
    expect(st.status).toBe("finished");
    expect(st.result).toMatchObject({ winnerSlot: 0, endedBy: "target" });
    expect(repo.insertGame).toHaveBeenCalledTimes(1);
    expect(repo.games[0].players.map((p) => [p.name, p.guest, p.won])).toEqual([
      ["Andrés", false, true],
      ["Abuela", true, false],
    ]);
  });

  it("a failed save rolls the table back to playing (nothing lost)", async () => {
    const { host } = await hostWithTable(30);
    await act(host, C2S.GUEST, { name: "B" });
    await act(host, C2S.START);
    await act(host, C2S.RECORD, { kind: "mesa", seat: 1 });
    repo.failNext = true;
    const states = [];
    host.on(S2C.STATE, (p) => states.push(p.state));
    const res = await new Promise((resolve) => {
      host.once(S2C.ERROR, resolve);
      host.emit(C2S.CLOSE, { winnerSlot: 1 });
    });
    expect(res.code).toBe("save_failed");
    expect(states[states.length - 1].status).toBe("playing");
    expect(states[states.length - 1].ops.length).toBe(1);
    // Retry works.
    const st = await act(host, C2S.CLOSE, { winnerSlot: 1 });
    expect(st.status).toBe("finished");
    expect(repo.games.length).toBe(1);
  });

  it("discard ends the table for everyone, without saving", async () => {
    const { host, code } = await hostWithTable(40);
    const friend = connect({ id: 41, first_name: "Mafeer" });
    await waitFor(friend, "connect");
    await act(friend, C2S.JOIN, { code });
    const ended = waitFor(friend, S2C.ENDED);
    host.emit(C2S.DISCARD, {});
    expect((await ended).reason).toBe("discarded");
    expect(store.get(code)).toBeNull();
    expect(repo.insertGame).not.toHaveBeenCalled();
  });

  it("a viewer disconnecting mid-game keeps their seat", async () => {
    const { host, code } = await hostWithTable(50);
    const friend = connect({ id: 51, first_name: "Jhonne" });
    await waitFor(friend, "connect");
    await act(friend, C2S.JOIN, { code });
    await act(host, C2S.START);
    const presence = waitFor(host, S2C.STATE);
    friend.disconnect();
    const st = (await presence).state;
    expect(st.seats[1]).toMatchObject({ name: "Jhonne", online: false });
    expect(st.status).toBe("playing");
  });

  it("one live table per person", async () => {
    const { code } = await hostWithTable(60);
    const other = await hostWithTable(61, "Otro");
    const r = await act(other.host, C2S.JOIN, { code });
    expect(r.error.code).toBe("already_in_table");
  });

  it("a late friend watches a game in progress without taking a seat", async () => {
    const { host, code } = await hostWithTable(70);
    await act(host, C2S.GUEST, { name: "B" });
    await act(host, C2S.START);
    const late = connect({ id: 71, first_name: "Tarde" });
    await waitFor(late, "connect");
    const st = await act(late, C2S.JOIN, { code });
    expect(st.status).toBe("playing");
    expect(st.you).toMatchObject({ position: null, isHost: false });
    expect(store.get(code).positionOf("71")).toBe(-1);
    // ...and keeps getting live updates
    const next = waitFor(late, S2C.STATE);
    host.emit(C2S.RECORD, { kind: "mesa", seat: 1 });
    expect((await next).state.ops.length).toBe(1);
  });

  it("closing a finished (already saved) table says 'closed', not 'discarded'", async () => {
    const { host, code } = await hostWithTable(80);
    const friend = connect({ id: 81, first_name: "Amigo" });
    await waitFor(friend, "connect");
    await act(friend, C2S.JOIN, { code });
    await act(host, C2S.START);
    await act(host, C2S.CLOSE, { winnerSlot: 0 });
    const ended = waitFor(friend, S2C.ENDED);
    host.emit(C2S.DISCARD, {});
    expect((await ended).reason).toBe("closed");
    expect(repo.games.length).toBe(1);
  });

  it("the creator can just referee: no seat, still runs the table", async () => {
    const host = connect({ id: 100, first_name: "Árbitro" });
    await waitFor(host, "connect");
    const first = waitFor(host, S2C.STATE);
    const { code } = await new Promise((res) => host.emit(C2S.CREATE, { referee: true }, res));
    let st = (await first).state;
    expect(st.you).toMatchObject({ position: null, isHost: true });
    expect(st.seats.every((s) => s === null)).toBe(true);
    const p1 = connect({ id: 101, first_name: "Uno" });
    await waitFor(p1, "connect");
    const hostSees = waitFor(host, S2C.STATE);
    st = await act(p1, C2S.JOIN, { code });
    expect(st.you.position).toBe(0);
    await hostSees;
    // changes their mind and plays: first free seat
    st = await act(host, C2S.SIT, {});
    expect(st.you).toMatchObject({ position: 1, isHost: true });
  });

  it("a reconnecting watcher re-attaches without a seat; 'Sentarme' seats them", async () => {
    const { code } = await hostWithTable(110);
    const w = connect({ id: 111, first_name: "Mira" });
    await waitFor(w, "connect");
    let st = await act(w, C2S.JOIN, { code, watch: true });
    expect(st.you.position).toBeNull();
    expect(store.get(code).positionOf("111")).toBe(-1);
    st = await act(w, C2S.JOIN, { code });
    expect(st.you.position).toBe(1);
  });

  it("after a win: winners stay (the line takes the losers' seats) or everyone plays again", async () => {
    const { host } = await hostWithTable(120);
    for (const name of ["B", "C", "D"]) await act(host, C2S.GUEST, { name });
    await act(host, C2S.START);
    await act(host, C2S.CLOSE, { winnerSlot: 1 }); // B(1) + D(3)
    await act(host, C2S.QUEUE_ADD, { name: "E" });
    await act(host, C2S.QUEUE_ADD, { name: "F" });
    let st = await act(host, C2S.REMATCH, { mode: "winners" });
    expect(st.status).toBe("lobby");
    expect(st.seats.map((s) => s && s.name)).toEqual(["E", "B", "F", "D"]);
    expect(st.queue.map((e) => e.name)).toEqual(["Andrés", "C"]);
    expect(st.you).toMatchObject({ position: null, isHost: true, queued: 1 }); // lost → in line

    await act(host, C2S.START);
    await act(host, C2S.CLOSE, { winnerSlot: 0 });
    st = await act(host, C2S.REMATCH, { mode: "again" });
    expect(st.status).toBe("playing");
    expect(st.gameNo).toBe(3);
    expect(st.ops).toEqual([]);
    expect(repo.games.length).toBe(2);
  });
  describe("people, line and referee role", () => {
    /** Host + guests B/C/D: every seat taken. */
    async function fullTable(hostId) {
      const t = await hostWithTable(hostId);
      for (const name of ["B", "C", "D"]) await act(t.host, C2S.GUEST, { name });
      return t;
    }
    async function watcher(id, name, code) {
      const w = connect({ id, first_name: name });
      await waitFor(w, "connect");
      const st = await act(w, C2S.JOIN, { code });
      return { w, st };
    }

    it("someone watching asks for the next game; the referee seats them from the line", async () => {
      const { host, code } = await fullTable(200);
      const { w, st: watching } = await watcher(201, "Pedro", code);
      expect(watching.you).toMatchObject({ position: null, queued: null });

      let st = await act(w, C2S.QUEUE_JOIN);
      expect(st.you.queued).toBe(1);
      st = await act(host, C2S.QUEUE_ADD, { name: "Luis" });
      expect(st.queue.map((e) => [e.name, e.guest])).toEqual([
        ["Pedro", false],
        ["Luis", true],
      ]);
      expect(st.spectators).toEqual([]); // Pedro is in the line, not just watching

      await act(host, C2S.KICK, { position: 3 }); // D gets up
      const pedroSeated = until(w, (x) => x.you.position === 3);
      st = await act(host, C2S.SEAT_QUEUED, { qid: st.queue[0].qid, position: 3 });
      expect(st.seats[3]).toMatchObject({ name: "Pedro", guest: false });
      expect(st.queue.map((e) => e.name)).toEqual(["Luis"]);
      expect((await pedroSeated).you).toMatchObject({ position: 3, queued: null });

      st = await act(host, C2S.QUEUE_REMOVE, { qid: st.queue[0].qid });
      expect(st.queue).toEqual([]);
      expect(await errorOf(w, C2S.QUEUE_REMOVE, { qid: 1 })).toBe("not_host");
    });

    it("the invite link doesn't jump the line; leaving the line works", async () => {
      const { host, code } = await fullTable(210);
      await act(host, C2S.QUEUE_ADD, { name: "Luis" });
      await act(host, C2S.KICK, { position: 2 }); // a free seat, but Luis is waiting
      const { w, st } = await watcher(211, "Ana", code);
      expect(st.you.position).toBeNull();
      expect((await act(w, C2S.QUEUE_JOIN)).you.queued).toBe(2);
      const after = await act(w, C2S.QUEUE_LEAVE);
      expect(after.you.queued).toBeNull();
      expect(after.queue.map((e) => e.name)).toEqual(["Luis"]);
      expect(after.spectators.map((x) => x.name)).toEqual(["Ana"]);
    });

    it("lists who's watching by name only (no Telegram ids)", async () => {
      const { host, code } = await fullTable(220);
      const hostSees = waitFor(host, S2C.STATE);
      await watcher(221, "Carla", code);
      const st = (await hostSees).state;
      expect(st.spectators).toEqual([{ pid: expect.any(String), name: "Carla", you: false }]);
      expect(st.hostOnline).toBe(true);
      expect(JSON.stringify(st)).not.toMatch(/221/);
    });

    it("the referee passes the role to someone watching; the old one can't score anymore", async () => {
      const { host, code } = await fullTable(230);
      const { w } = await watcher(231, "Carlos", code);
      const hostState = await act(host, C2S.START);
      const pid = hostState.spectators.find((x) => x.name === "Carlos").pid;
      const carlosRuns = until(w, (x) => x.you.isHost);
      const after = await act(host, C2S.TRANSFER, { pid });
      expect(after.you).toMatchObject({ position: 0, isHost: false });
      expect(after.hostName).toBe("Carlos");
      expect((await carlosRuns).you).toMatchObject({ position: null, isHost: true });
      expect(await errorOf(host, C2S.RECORD, { kind: "mesa", seat: 1 })).toBe("not_host");
      const scored = await act(w, C2S.RECORD, { kind: "mesa", seat: 1 });
      expect(scored.ops).toHaveLength(1);
    });

    it("won't pass the role to someone who isn't connected", async () => {
      const { host, code } = await hostWithTable(240);
      const p = connect({ id: 241, first_name: "Ida" });
      await waitFor(p, "connect");
      const seated = await act(p, C2S.JOIN, { code });
      const pid = seated.seats[seated.you.position].pid;
      const hostSees = waitFor(host, S2C.STATE);
      p.disconnect();
      await hostSees;
      expect(await errorOf(host, C2S.TRANSFER, { pid })).toBe("target_offline");
      expect(await errorOf(host, C2S.TRANSFER, { pid: "nobody" })).toBe("bad_target");
    });

    it("a player takes the role over once the referee has been away long enough", async () => {
      companionWs.configure({ claimAfterMs: 80 });
      try {
        const { host, code } = await hostWithTable(250);
        const p = connect({ id: 251, first_name: "Toma" });
        await waitFor(p, "connect");
        await act(p, C2S.JOIN, { code });
        expect(await errorOf(p, C2S.CLAIM)).toBe("referee_online");

        const awayState = until(p, (x) => x.hostOnline === false);
        host.disconnect();
        const away = await awayState;
        expect(away.hostOnline).toBe(false);
        expect(away.you.claimInMs).toBeGreaterThan(0);
        expect(await errorOf(p, C2S.CLAIM)).toBe("too_soon");

        await new Promise((r) => setTimeout(r, 120));
        const st = await act(p, C2S.CLAIM);
        expect(st.you).toMatchObject({ isHost: true });
        expect(st.hostName).toBe("Toma");
        expect(store.get(code).isHost("251")).toBe(true);
      } finally {
        companionWs.configure({ claimAfterMs: 5 * 60 * 1000 });
      }
    });
  });
});
