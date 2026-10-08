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
    expect(st.you).toEqual({ position: 0, isHost: true });
    expect(st.config.type).toBe("parejas");
    expect(st.seats[0]).toMatchObject({ name: "Andrés", online: true });
  });

  it("a friend joins by code; both see the table; only the host can arrange it", async () => {
    const { host, code } = await hostWithTable(10);
    const friend = connect({ id: 11, first_name: "Daniel" });
    await waitFor(friend, "connect");
    const hostSees = waitFor(host, S2C.STATE);
    const st = await act(friend, C2S.JOIN, { code: code.replace("MESA-", "") }); // bare suffix works
    expect(st.you).toEqual({ position: 1, isHost: false });
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
    expect(st.you).toEqual({ position: null, isHost: false });
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
    expect(st.you).toEqual({ position: null, isHost: true });
    expect(st.seats.every((s) => s === null)).toBe(true);
    const p1 = connect({ id: 101, first_name: "Uno" });
    await waitFor(p1, "connect");
    const hostSees = waitFor(host, S2C.STATE);
    st = await act(p1, C2S.JOIN, { code });
    expect(st.you.position).toBe(0);
    await hostSees;
    // changes their mind and plays: first free seat
    st = await act(host, C2S.SIT, {});
    expect(st.you).toEqual({ position: 1, isHost: true });
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

  it("after a win: winners stay (the rest stand up) or everyone plays again", async () => {
    const { host } = await hostWithTable(120);
    for (const name of ["B", "C", "D"]) await act(host, C2S.GUEST, { name });
    await act(host, C2S.START);
    await act(host, C2S.CLOSE, { winnerSlot: 1 }); // B(1) + D(3)
    let st = await act(host, C2S.REMATCH, { mode: "winners" });
    expect(st.status).toBe("lobby");
    expect(st.seats.map((s) => s && s.name)).toEqual([null, "B", null, "D"]);
    expect(st.you).toEqual({ position: null, isHost: true }); // the host lost → referees

    await act(host, C2S.GUEST, { name: "E" }); // → 0
    await act(host, C2S.GUEST, { name: "F" }); // → 2
    await act(host, C2S.START);
    await act(host, C2S.CLOSE, { winnerSlot: 0 });
    st = await act(host, C2S.REMATCH, { mode: "again" });
    expect(st.status).toBe("playing");
    expect(st.gameNo).toBe(3);
    expect(st.ops).toEqual([]);
    expect(repo.games.length).toBe(2);
  });
});
