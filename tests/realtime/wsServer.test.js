// Set a deterministic bot token BEFORE requiring anything that pulls in
// config/env (which captures process.env at module load). Vitest isolates
// the module registry per test file, so this token is scoped to this file.
process.env.TELEGRAM_TOKEN = "TEST:wsServer-token";
process.env.DASHBOARD_BASE_URL = "https://example.test/caidavzlabot";

const crypto = require("crypto");
const http = require("http");
const { io: ioClient } = require("socket.io-client");

const wsServer = require("../../services/realtime/wsServer");
const sessionStore = require("../../services/realtime/sessionStore");
const protocol = require("../../services/realtime/protocol");

const { C2S, S2C } = protocol;

/** Build a valid Telegram initData query-string signed with the test token,
 *  matching the algorithm in dashboardAuth.verifyInitData. */
function makeInitData(user, startParam) {
  const params = new URLSearchParams();
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));
  params.set("user", JSON.stringify(user));
  if (startParam) params.set("start_param", startParam);
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_TOKEN)
    .digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

let server;
let io;
let port;
const openSockets = new Set();

function connect(initData) {
  // The server mounts socket.io under DASHBOARD_PATH (default /dashboard)
  // so it rides the nginx-proxied prefix; the client must use the same path.
  const env = require("../../config/env");
  const sock = ioClient(`http://127.0.0.1:${port}`, {
    path: `${env.dashboard_path}/socket.io/`,
    auth: { initData },
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
  });
  openSockets.add(sock);
  sock.on("disconnect", () => openSockets.delete(sock));
  return sock;
}

/** Resolve on the first matching event, reject on a timeout/error. */
function waitFor(socket, event, ms = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe("wsServer (socket.io integration)", () => {
  beforeAll(async () => {
    server = http.createServer();
    io = wsServer.attach(server);
    await new Promise((res) => server.listen(0, "127.0.0.1", res));
    port = server.address().port;
  });

  afterAll(async () => {
    for (const s of openSockets) s.disconnect();
    openSockets.clear();
    // Close socket.io (terminates server-side sockets) then the http server.
    await new Promise((res) => io.close(res));
    await new Promise((res) => server.close(res));
  });

  beforeEach(() => sessionStore._clear());

  it("rejects a handshake with invalid initData", async () => {
    const sock = connect("garbage-not-signed");
    try {
      const err = await waitFor(sock, "connect_error");
      expect(String(err.message)).toMatch(/unauthorized/);
    } finally {
      sock.disconnect();
    }
  });

  it("accepts a valid handshake and creates a session", async () => {
    const sock = connect(makeInitData({ id: 100, first_name: "Host" }));
    try {
      await waitFor(sock, "connect");
      // Listen for the post-create state broadcast BEFORE emitting so the
      // synchronous server-side emit can't race ahead of the listener.
      const statePromise = waitFor(sock, S2C.SESSION_STATE);
      const created = await new Promise((res) => sock.emit(C2S.SESSION_CREATE, {}, res));
      expect(created.code).toMatch(/^CAIDA-[A-Z2-9]{4}$/);
      const state = await statePromise;
      expect(state.state.status).toBe("lobby");
      expect(state.state.seats[0].name).toBe("Host");
    } finally {
      sock.disconnect();
    }
  });

  it("a second client joins by code and both see the updated lobby", async () => {
    const host = connect(makeInitData({ id: 200, first_name: "Host" }));
    await waitFor(host, "connect");
    const hostInitState = waitFor(host, S2C.SESSION_STATE);
    const { code } = await new Promise((res) => host.emit(C2S.SESSION_CREATE, {}, res));
    await hostInitState;

    const guest = connect(makeInitData({ id: 201, first_name: "Guest" }));
    await waitFor(guest, "connect");
    // Register both listeners BEFORE emitting: the join handler broadcasts
    // synchronously to host + guest, so a listener attached after emit could
    // miss the event.
    const hostUpdate = waitFor(host, S2C.SESSION_STATE);
    const guestUpdate = waitFor(guest, S2C.SESSION_STATE);
    guest.emit(C2S.SESSION_JOIN, { code });
    const guestState = await guestUpdate;
    const hostState = await hostUpdate;

    expect(guestState.state.seats.length).toBe(2);
    expect(hostState.state.seats.length).toBe(2);
    // Per-viewer projection: each sees their own seat in `you`.
    expect(guestState.state.you.seat).toBe(1);
    expect(hostState.state.you.seat).toBe(0);

    host.disconnect();
    guest.disconnect();
  });

  it("errors on joining an unknown code", async () => {
    const sock = connect(makeInitData({ id: 300, first_name: "X" }));
    await waitFor(sock, "connect");
    sock.emit(C2S.SESSION_JOIN, { code: "CAIDA-NOPE" });
    const err = await waitFor(sock, S2C.SESSION_ERROR);
    expect(err.code).toBe("session_not_found");
    sock.disconnect();
  });

  it("host adds CPUs, starts, and the table reaches playing", async () => {
    const host = connect(makeInitData({ id: 400, first_name: "Host" }));
    await waitFor(host, "connect");
    // Each action broadcasts state synchronously; emit-with-ack-callback for
    // create, and for the rest pre-register the state listener before emit.
    const initState = waitFor(host, S2C.SESSION_STATE);
    await new Promise((res) => host.emit(C2S.SESSION_CREATE, {}, res));
    await initState;

    // Fill with 3 CPUs so a start() + CPU auto-step chain can run.
    for (let i = 0; i < 3; i++) {
      const st = waitFor(host, S2C.SESSION_STATE);
      host.emit(C2S.SESSION_ADD_CPU, { difficulty: "easy" });
      const seats = (await st).state.seats.length;
      expect(seats).toBe(i + 2);
    }

    const playingState = waitFor(host, S2C.SESSION_STATE);
    host.emit(C2S.SESSION_START, {});
    const playing = await playingState;
    expect(playing.state.status).toBe("playing");
    // The host is seated and gets their own view (a startBy picker or cards).
    expect(playing.state.you.seat).toBe(0);

    host.disconnect();
  });

  it("a non-host cannot add a CPU", async () => {
    const host = connect(makeInitData({ id: 500, first_name: "Host" }));
    await waitFor(host, "connect");
    const initState = waitFor(host, S2C.SESSION_STATE);
    const { code } = await new Promise((res) => host.emit(C2S.SESSION_CREATE, {}, res));
    await initState;

    const guest = connect(makeInitData({ id: 501, first_name: "Guest" }));
    await waitFor(guest, "connect");
    const guestState = waitFor(guest, S2C.SESSION_STATE);
    guest.emit(C2S.SESSION_JOIN, { code });
    await guestState;

    const errPromise = waitFor(guest, S2C.SESSION_ERROR);
    guest.emit(C2S.SESSION_ADD_CPU, { difficulty: "pro" });
    const err = await errPromise;
    expect(err.code).toBe("not_host");

    host.disconnect();
    guest.disconnect();
  });

  // ── rematch after a finished game (regression: "No estás en una sesión") ──
  // finishGame used to untrack sockets + drop the session, so SESSION_REMATCH
  // failed requireSession. Now a finished table stays alive for the rematch.
  describe("rematch lifecycle", () => {
    const { handlers, handleLeave, sessionSockets } = wsServer._internal;

    function fakeSocket(code, userId, name) {
      const emitted = [];
      const socket = {
        emitted,
        data: { code, user: { id: userId, first_name: name } },
        emit: (event, payload) => emitted.push([event, payload]),
      };
      sessionSockets.set(code, new Set([socket]));
      return socket;
    }

    it("keeps a finished session alive so the host can rematch", () => {
      const session = sessionStore.create({ userId: 900, name: "Host" });
      session.addCpu("medium");
      session.status = "finished";
      session.winner = { seat: 1, standings: [] };
      const code = session.code;
      const host = fakeSocket(code, 900, "Host");

      handlers[C2S.SESSION_REMATCH](host);

      expect(session.status).toBe("lobby");
      expect(sessionStore.get(code)).toBe(session); // not dropped
      expect(host.emitted.some(([e]) => e === S2C.SESSION_STATE)).toBe(true);
      sessionSockets.delete(code);
    });

    it("rejects a non-host rematch and leaves the session finished", () => {
      const session = sessionStore.create({ userId: 910, name: "Host" });
      session.addHuman({ userId: 911, name: "Guest" });
      session.status = "finished";
      const code = session.code;
      const guest = fakeSocket(code, 911, "Guest");

      expect(() => handlers[C2S.SESSION_REMATCH](guest)).toThrow(/anfitrión/i);
      expect(session.status).toBe("finished");
      sessionSockets.delete(code);
    });

    it("drops a finished table when the host leaves it", () => {
      const session = sessionStore.create({ userId: 920, name: "Host" });
      session.status = "finished";
      const code = session.code;
      const host = fakeSocket(code, 920, "Host");

      handleLeave(host);
      expect(sessionStore.get(code)).toBe(null);
    });

    it("drops a finished table once the last viewer leaves", () => {
      const session = sessionStore.create({ userId: 930, name: "Host" });
      session.addHuman({ userId: 931, name: "Guest" });
      session.status = "finished";
      const code = session.code;
      // Guest is the only tracked socket; their leave empties the table.
      const guest = fakeSocket(code, 931, "Guest");

      handleLeave(guest);
      expect(sessionStore.get(code)).toBe(null);
    });
  });

  // ── resume on reopen / reconnect ─────────────────────────────────────────
  describe("resume lifecycle", () => {
    const { handlers, sessionSockets } = wsServer._internal;

    /** A reopened client: a brand-new socket with no session tracked yet. */
    function freshSocket(userId, name) {
      const emitted = [];
      return {
        emitted,
        data: { code: null, user: { id: userId, first_name: name } },
        emit: (event, payload) => emitted.push([event, payload]),
      };
    }

    it("re-attaches a reopened socket to the user's active table", () => {
      const session = sessionStore.create({ userId: 940, name: "Host" });
      session.addCpu("medium");
      const code = session.code;
      // Simulate a mid-game disconnect: seat kept, marked disconnected.
      const seat = session.seatOf(940);
      seat.connected = false;

      const reopened = freshSocket(940, "Host");
      handlers[C2S.SESSION_RESUME](reopened);

      expect(reopened.data.code).toBe(code); // tracked back into the table
      expect(seat.connected).toBe(true); // marked connected again
      expect(reopened.emitted.some(([e]) => e === S2C.SESSION_STATE)).toBe(true);
      sessionSockets.delete(code);
    });

    it("is a no-op when the user isn't seated anywhere", () => {
      const stranger = freshSocket(950, "Nadie");
      handlers[C2S.SESSION_RESUME](stranger);
      expect(stranger.data.code).toBe(null);
      expect(stranger.emitted.length).toBe(0);
    });

    it("does not resume a finished table", () => {
      const session = sessionStore.create({ userId: 960, name: "Host" });
      session.status = "finished";
      const code = session.code;
      const reopened = freshSocket(960, "Host");

      handlers[C2S.SESSION_RESUME](reopened);

      expect(reopened.data.code).toBe(null);
      expect(reopened.emitted.length).toBe(0);
      sessionSockets.delete(code);
    });
  });

  // ── host reconfigures from the lobby ─────────────────────────────────────
  describe("lobby config", () => {
    const { handlers, sessionSockets } = wsServer._internal;

    function fakeSocket(code, userId, name) {
      const emitted = [];
      const socket = {
        emitted,
        data: { code, user: { id: userId, first_name: name } },
        emit: (event, payload) => emitted.push([event, payload]),
      };
      sessionSockets.set(code, new Set([socket]));
      return socket;
    }

    it("lets the host change the rules and broadcasts the new config", () => {
      const session = sessionStore.create({ userId: 970, name: "Host" });
      const code = session.code;
      const host = fakeSocket(code, 970, "Host");

      handlers[C2S.SESSION_CONFIG](host, { config: { points: 30, mata_canto: "on" } });

      expect(session.config.points).toBe(30);
      expect(session.config.mata_canto).toBe("on");
      expect(session.game.config.points).toBe(30);
      const last = host.emitted[host.emitted.length - 1];
      expect(last[0]).toBe(S2C.SESSION_STATE);
      expect(last[1].state.config.points).toBe(30);
      sessionSockets.delete(code);
    });

    it("clamps out-of-range values via sanitizeConfig", () => {
      const session = sessionStore.create({ userId: 971, name: "Host" });
      const code = session.code;
      const host = fakeSocket(code, 971, "Host");

      handlers[C2S.SESSION_CONFIG](host, { config: { points: 9999, type: "hack" } });

      expect(session.config.points).toBe(100); // clamped
      expect(session.config.type).toBe("individual"); // bad enum dropped → default kept
      sessionSockets.delete(code);
    });

    it("rejects a non-host config change", () => {
      const session = sessionStore.create({ userId: 980, name: "Host" });
      session.addHuman({ userId: 981, name: "Guest" });
      const code = session.code;
      const guest = fakeSocket(code, 981, "Guest");

      expect(() =>
        handlers[C2S.SESSION_CONFIG](guest, { config: { points: 30 } }),
      ).toThrow(/anfitrión/i);
      expect(session.config.points).toBe(24);
      sessionSockets.delete(code);
    });
  });
});
