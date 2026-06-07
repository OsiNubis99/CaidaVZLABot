/**
 * Realtime WebSocket server for WebApp game sessions (SP1, T3 + T5).
 *
 * Attaches a socket.io Server to the existing Express http.Server (shares
 * port 3000 → loopback :3010 → nginx). Auth is the same Telegram initData
 * HMAC the dashboard uses (verifyInitData). Every C2S event from protocol.js
 * is routed to the right sessionStore / GameSession call, and after any
 * successful state change the new state is broadcast PER VIEWER (each member
 * gets serializeForClient tailored to their own seat — rivals' hands hidden).
 *
 * The turn loop (CPU auto-step + human timeout) lives in turnLoop.js and is
 * driven here via the injected broadcast callback after every mutation.
 */
const { Server } = require("socket.io");
const protocol = require("./protocol");
const sessionStore = require("./sessionStore");
const { sanitizeConfig } = require("./configSanitize");
const serializeForClient = require("./serializeForClient");
const turnLoop = require("./turnLoop");
const dashboardAuth = require("../dashboardAuth");
const env = require("../../config/env");
const logger = require("../../config/logger");

const { C2S, S2C } = protocol;

let io = null;

/**
 * code → Set<socket>. Tracks which live sockets belong to each session so a
 * broadcast reaches exactly that session's humans, and a disconnect can be
 * resolved to its session. CPUs have no socket — the server plays them.
 */
const sessionSockets = new Map();

function membersOf(code) {
  let set = sessionSockets.get(code);
  if (!set) {
    set = new Set();
    sessionSockets.set(code, set);
  }
  return set;
}

function trackSocket(socket, code) {
  socket.data.code = code;
  membersOf(code).add(socket);
}

function untrackSocket(socket) {
  const code = socket.data.code;
  if (!code) return;
  const set = sessionSockets.get(code);
  if (set) {
    set.delete(socket);
    if (set.size === 0) sessionSockets.delete(code);
  }
  socket.data.code = null;
}

/**
 * Broadcast the current state to every live socket in a session, each with
 * its own per-viewer projection (rivals' hands hidden by serializeForClient).
 */
function broadcastState(session) {
  const set = sessionSockets.get(session.code);
  if (!set) return;
  for (const socket of set) {
    const viewerId = socket.data.user && socket.data.user.id;
    socket.emit(S2C.SESSION_STATE, { state: serializeForClient(session, viewerId) });
  }
}

/**
 * THE broadcast callback handed to the turn loop. Pushes the new state, then
 * if the move just ended the game, emits session:ended and tears the session
 * down. Folding the finish into the broadcast means CPU auto-steps and human
 * timeouts finalise a win exactly like a human action — including the CVB-5
 * deferred pegar-en-mesa case, where a CPU's first play resolves the win.
 */
function broadcastOrFinish(session) {
  broadcastState(session);
  if (session.status === "finished") finishGame(session);
}

/** Emit session:ended to every member, then drop the session + its timers
 *  and sockets. Used when the host leaves the lobby (no winner) or any other
 *  hard close. */
function endSession(session, reason) {
  const set = sessionSockets.get(session.code);
  if (set) {
    for (const socket of set) {
      socket.emit(S2C.SESSION_ENDED, {
        winner: session.winner || null,
        standings: (session.winner && session.winner.standings) || [],
        reason,
      });
      untrackSocket(socket);
    }
  }
  turnLoop.clear(session.code);
  sessionStore.remove(session.code);
}

function emitError(socket, err) {
  socket.emit(S2C.SESSION_ERROR, {
    code: err.code || "internal_error",
    message: err.message || "Error interno",
  });
}

/** Resolve the session a socket is in, or throw a coded error. */
function requireSession(socket) {
  const code = socket.data.code;
  const session = code ? sessionStore.get(code) : null;
  if (!session) {
    const err = new Error("No estás en una sesión");
    err.code = "session_not_found";
    throw err;
  }
  return session;
}

function requireHost(session, socket) {
  if (String(session.hostUserId) !== String(socket.data.user.id)) {
    const err = new Error("Solo el anfitrión puede hacer esto");
    err.code = "not_host";
    throw err;
  }
}

/**
 * After a session mutation from a human action: broadcast (finalising if the
 * move won the game), otherwise drive the turn loop (CPU auto-step / human
 * timeout). The loop is fed the same broadcastOrFinish so a CPU/timeout that
 * later ends the game finalises identically.
 */
function settle(session) {
  broadcastOrFinish(session);
  if (session.status === "playing") {
    turnLoop.drive(session, broadcastOrFinish);
  }
}

/** Emit session:ended with the winner and clear the turn timers. The session
 *  and its sockets are kept ALIVE so the host can offer a rematch
 *  (SESSION_REMATCH); handleLeave drops a finished table once it's empty or the
 *  host leaves it (there's no in-memory session reaper). */
function finishGame(session) {
  turnLoop.clear(session.code);
  const winner = session.winner || null;
  const set = sessionSockets.get(session.code);
  if (set) {
    for (const socket of set) {
      socket.emit(S2C.SESSION_ENDED, {
        winner,
        standings: (winner && winner.standings) || [],
      });
    }
  }
}

// ── C2S handlers ──────────────────────────────────────────────────────────

/** Seat display name for a human: @username when set, else first_name. */
function displayName(u) {
  if (u && u.username) return "@" + u.username;
  return (u && u.first_name) || "Jugador";
}

const handlers = {
  [C2S.SESSION_CREATE](socket, payload = {}, ack) {
    const user = socket.data.user;
    const session = sessionStore.create(
      { userId: user.id, name: displayName(user) },
      { config: sanitizeConfig(payload.config) },
    );
    trackSocket(socket, session.code);
    // Reply with the code via the ack callback (the spec's "responds { code }")
    // AND emit a named event, so a client that prefers either style works.
    if (typeof ack === "function") ack({ code: session.code });
    socket.emit("session:created", { code: session.code });
    broadcastState(session);
  },

  [C2S.SESSION_JOIN](socket, payload = {}) {
    const code = normalizeCode(payload.code);
    if (!code) {
      const err = new Error("Falta el código de la sesión");
      err.code = "bad_code";
      throw err;
    }
    const user = socket.data.user;
    const existing = sessionStore.get(code);
    // Reconnect: same user.id already seated → resume the seat (mark it
    // connected again) instead of erroring "already_joined". Robust
    // reconnection is SP2; this covers a socket re-open with a live seat.
    if (existing) {
      const seat = existing.seatOf(user.id);
      if (seat) {
        if (seat.kind === "human") seat.connected = true;
        trackSocket(socket, code);
        broadcastState(existing);
        return;
      }
    }
    const session = sessionStore.join(code, { userId: user.id, name: displayName(user) });
    trackSocket(socket, code);
    broadcastState(session);
  },

  [C2S.SESSION_ADD_CPU](socket, payload = {}) {
    const session = requireSession(socket);
    requireHost(session, socket);
    session.addCpu(payload.difficulty);
    broadcastState(session);
  },

  [C2S.SESSION_REMOVE_CPU](socket, payload = {}) {
    const session = requireSession(socket);
    requireHost(session, socket);
    session.removeCpu(payload.seatIndex);
    broadcastState(session);
  },

  [C2S.SESSION_START](socket) {
    const session = requireSession(socket);
    requireHost(session, socket);
    session.start();
    settle(session);
  },

  [C2S.SESSION_REMATCH](socket) {
    const session = requireSession(socket);
    requireHost(session, socket);
    session.rematch();
    // Back in the lobby with the same seats; the host starts again.
    broadcastState(session);
  },

  [C2S.ACTION_PLAY](socket, payload = {}) {
    const session = requireSession(socket);
    session.play(socket.data.user.id, payload.cardIndex);
    settle(session);
  },

  [C2S.ACTION_SING](socket) {
    const session = requireSession(socket);
    session.sing(socket.data.user.id);
    settle(session);
  },

  [C2S.SESSION_LEAVE](socket) {
    handleLeave(socket);
  },
};

/** Shared leave/disconnect path. In lobby a host-leave closes the session
 *  for everyone; otherwise the seat is freed (lobby) or marked disconnected
 *  (mid-game, so the turn loop can auto-skip it). */
function handleLeave(socket) {
  const code = socket.data.code;
  const session = code ? sessionStore.get(code) : null;
  untrackSocket(socket);
  if (!session) return;
  const user = socket.data.user;

  // A finished table only lingers to offer a rematch. Drop it when the host
  // leaves (rematch is host-only) or when nobody is left on the result screen;
  // a non-host who leaves just frees their seat from the next rematch.
  if (session.status === "finished") {
    const remaining = sessionSockets.get(code);
    const empty = !remaining || remaining.size === 0;
    const hostLeft = String(user.id) === session.hostUserId;
    if (hostLeft && !empty) {
      endSession(session, "host_left");
    } else if (empty) {
      turnLoop.clear(code);
      sessionStore.remove(code);
    } else {
      session.leave(user.id);
      broadcastState(session);
    }
    return;
  }

  const result = session.leave(user.id);
  if (result.closed) {
    endSession(session, result.reason || "host_left");
    return;
  }
  broadcastState(session);
  // A mid-game disconnect may have left a (now connected:false) human up;
  // re-drive so the auto-skip timer arms for the absent player.
  if (session.status === "playing") turnLoop.drive(session, broadcastOrFinish);
}

function normalizeCode(code) {
  if (!code || typeof code !== "string") return null;
  return code.trim().toUpperCase();
}

// ── attach ──────────────────────────────────────────────────────────────

/**
 * Attach the socket.io server to an http.Server. Gated by the caller on
 * dashboard being enabled. Returns the io instance (or null if already
 * attached / disabled).
 *
 * @param {import("http").Server} server
 */
function attach(server) {
  if (io) return io;
  io = new Server(server, {
    // The WebApp is served under DASHBOARD_PATH (e.g. /caidavzlabot), and
    // nginx only proxies that prefix to this process — the default root
    // /socket.io/ would hit nginx's catch-all instead. Mount socket.io
    // UNDER the same prefix so the handshake rides the dashboard location.
    // The client mirrors this by deriving the path from its page URL.
    path: `${env.dashboard_path}/socket.io/`,
    // Same-origin behind nginx; CORS stays closed.
    serveClient: false,
  });

  // Handshake auth: verify the Telegram initData HMAC. The client sends it
  // in socket.handshake.auth.initData (preferred) or the query string.
  io.use((socket, next) => {
    const initData =
      (socket.handshake.auth && socket.handshake.auth.initData) ||
      (socket.handshake.query && socket.handshake.query.initData);
    const user = dashboardAuth.verifyInitData(initData);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = { id: user.id, first_name: user.first_name, username: user.username };
    // The deep-link `startapp` value rides in initData as start_param. The
    // frontend reads it and sends session:join {code}; we expose it on the
    // socket for convenience/debugging but do not auto-join.
    try {
      const params = new URLSearchParams(initData);
      const sp = params.get("start_param");
      if (sp) socket.data.startParam = sp;
    } catch (_) {}
    next();
  });

  io.on("connection", (socket) => {
    for (const event of Object.keys(handlers)) {
      socket.on(event, (payload, ack) => {
        try {
          handlers[event](socket, payload, ack);
        } catch (err) {
          if (!err.code) {
            logger.warn({ err: err.message, event, code: socket.data.code }, "ws handler error");
          }
          emitError(socket, err);
        }
      });
    }

    socket.on("disconnect", () => {
      try {
        handleLeave(socket);
      } catch (err) {
        logger.warn({ err: err.message }, "ws disconnect cleanup failed");
      }
    });
  });

  logger.info("realtime ws server attached");
  return io;
}

module.exports = {
  attach,
  // Exposed for tests.
  _internal: { broadcastState, sessionSockets, handlers, handleLeave },
};
