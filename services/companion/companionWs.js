/**
 * Acompañante realtime layer: the `/companion` socket.io namespace.
 *
 * Same server, same Telegram initData auth as the game (verifyInitData), but
 * a separate namespace + store so the two never interfere. Only the referee
 * (the host: the table's creator, or whoever got the role) mutates the game;
 * everyone else watches the live score and can line up for the next game.
 * Unlike the game, a disconnect NEVER removes anybody: the referee may lock
 * the phone or switch tabs mid real-life game. If they're gone for good, after
 * CLAIM_AFTER_MS anyone at the table with the app can take the role over.
 */
const { NAMESPACE, C2S, S2C } = require("./protocol");
const { POSITIONS } = require("./scoring");
const store = require("./store");
const dashboardAuth = require("../dashboardAuth");
const logger = require("../../config/logger");

const SWEEP_EVERY_MS = 30 * 60 * 1000;

/** Tunables (configure() in tests). */
const opts = {
  claimAfterMs: 5 * 60 * 1000,
  now: () => Date.now(),
};

let nsp = null;

/** code → Set<socket> watching that table. */
const tableSockets = new Map();
/** code → when the referee was first seen offline (cleared when they're back). */
const hostAwaySince = new Map();

function coded(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function track(socket, code) {
  untrack(socket);
  socket.data.code = code;
  let set = tableSockets.get(code);
  if (!set) {
    set = new Set();
    tableSockets.set(code, set);
  }
  set.add(socket);
}

function untrack(socket) {
  const code = socket.data.code;
  if (!code) return;
  const set = tableSockets.get(code);
  if (set) {
    set.delete(socket);
    if (set.size === 0) tableSockets.delete(code);
  }
  socket.data.code = null;
}

function onlineIds(code) {
  const ids = new Set();
  for (const s of tableSockets.get(code) || []) ids.add(String(s.data.user.id));
  return ids;
}

/** How long the referee has been offline (ms), or null while connected. */
function hostAwayMs(session, online = onlineIds(session.code)) {
  if (online.has(session.hostUserId)) {
    hostAwaySince.delete(session.code);
    return null;
  }
  let since = hostAwaySince.get(session.code);
  if (since == null) {
    // First time seen offline (a disconnect, or the first look after a restart).
    since = opts.now();
    hostAwaySince.set(session.code, since);
  }
  return opts.now() - since;
}

/** Who's connected to a table right now, for toClient. */
function presenceOf(session) {
  const online = onlineIds(session.code);
  const watchers = new Map();
  for (const s of tableSockets.get(session.code) || []) {
    const id = String(s.data.user.id);
    if (!watchers.has(id)) watchers.set(id, displayName(s.data.user));
  }
  return {
    online,
    watchers,
    hostAwayMs: hostAwayMs(session, online),
    claimAfterMs: opts.claimAfterMs,
  };
}

/** Push the table to everyone watching it, each with their own `you`. */
function broadcast(session) {
  const set = tableSockets.get(session.code);
  if (!set) return;
  const presence = presenceOf(session);
  for (const socket of set) {
    socket.emit(S2C.STATE, { state: session.toClient(socket.data.user.id, presence) });
  }
}

/** Mutation done → save (debounced) + broadcast. */
function commit(session) {
  store.persist(session);
  broadcast(session);
}

/** Close a table for everyone (sockets get `ended`) and drop it. */
function endTable(code, reason) {
  for (const socket of [...(tableSockets.get(code) || [])]) {
    socket.emit(S2C.ENDED, { reason });
    untrack(socket);
  }
  hostAwaySince.delete(code);
  store.remove(code);
}

function requireTable(socket) {
  const session = socket.data.code ? store.get(socket.data.code) : null;
  if (!session) throw coded("table_not_found", "No estás en una mesa");
  return session;
}

function requireHost(session, socket) {
  if (!session.isHost(socket.data.user.id)) {
    throw coded("not_host", "Solo quien anota puede hacer esto");
  }
}

function displayName(u) {
  if (u && u.username) return "@" + u.username;
  return (u && u.first_name) || "Jugador";
}

function normalizeCode(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  return s.startsWith(store.CODE_PREFIX) ? s : store.CODE_PREFIX + s.replace(/^MESA/, "");
}

/** Seat name if seated (what the table calls them), else their Telegram name. */
function nameAt(session, user) {
  const pos = session.positionOf(user.id);
  return pos >= 0 ? session.seats[pos].name : displayName(user);
}

/** The name a connected user goes by (any of their sockets on this table). */
function connectedName(code, userId) {
  for (const s of tableSockets.get(code) || []) {
    if (String(s.data.user.id) === userId) return displayName(s.data.user);
  }
  return null;
}

/** For CompanionSession: can this person be seated here (not playing elsewhere)? */
function seatableHere(code) {
  return (userId) => !store.busyElsewhere(userId, code);
}

/**
 * One table per person. Before creating/joining another: a FINISHED table is
 * left behind automatically (its result is already saved); a live one is an
 * error the client turns into "go back to MESA-XXXX".
 */
function releaseOtherTable(user, keepCode) {
  const other = store.findByUser(user.id);
  if (!other || other.code === keepCode) return;
  if (other.status !== "finished") {
    throw coded("already_in_table", `Ya estás en la mesa ${other.code}`);
  }
  if (other.isHost(user.id)) {
    endTable(other.code, "closed");
  } else {
    other.leave(user.id);
    commit(other);
  }
}

/**
 * Finish the game (confirm / close by hand) and save the result. If the DB
 * write fails, roll the table back to "playing" so the host can retry —
 * nothing half-saved, no result lost.
 */
async function finishAndSave(socket, finish) {
  const session = requireTable(socket);
  requireHost(session, socket);
  const snapshot = session.toJSON();
  finish(session);
  try {
    await store.saveGame(session);
  } catch (err) {
    logger.error({ err: err.message, code: session.code }, "companion: saving the result failed");
    const restored = store.restore(snapshot);
    broadcast(restored);
    throw coded("save_failed", "No se pudo guardar el resultado. Intenta de nuevo.");
  }
  commit(session);
}

const handlers = {
  [C2S.CREATE](socket, payload, ack) {
    const user = socket.data.user;
    releaseOtherTable(user, null);
    const session = store.create(
      { userId: user.id, name: displayName(user) },
      // referee: the creator keeps score without playing (no seat, no stats)
      { config: payload.config, hostSeated: !payload.referee },
    );
    track(socket, session.code);
    if (typeof ack === "function") ack({ code: session.code });
    broadcast(session);
  },

  [C2S.JOIN](socket, payload) {
    const code = normalizeCode(payload.code);
    if (!code) throw coded("bad_code", "Falta el código de la mesa");
    const session = store.get(code);
    if (!session) throw coded("table_not_found", "Esa mesa no existe o ya se cerró");
    const user = socket.data.user;
    // Already part of it (seated, or the host) → just re-attach.
    if (session.positionOf(user.id) >= 0 || session.isHost(user.id)) {
      track(socket, code);
      broadcast(session);
      return;
    }
    // Watch without a seat: a reconnecting watcher (`watch`), a game under
    // way, no free seat, or people waiting in line (the link doesn't jump it).
    if (
      payload.watch ||
      session.status !== "lobby" ||
      session.seatedCount() >= POSITIONS ||
      session.queue.length > 0
    ) {
      track(socket, code);
      broadcast(session);
      return;
    }
    releaseOtherTable(user, code);
    session.join({ userId: user.id, name: displayName(user) });
    track(socket, code);
    commit(session);
  },

  [C2S.RESUME](socket) {
    const session = store.findByUser(socket.data.user.id);
    if (!session) return;
    track(socket, session.code);
    broadcast(session);
  },

  [C2S.SWAP](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.swap(payload.a, payload.b);
    commit(session);
  },

  [C2S.GUEST](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.addGuest(payload.name, payload.position);
    commit(session);
  },

  [C2S.KICK](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    const seat = session.seats[payload.position];
    session.kick(payload.position);
    // Tell the removed person (unless it's the host standing up).
    if (seat && seat.userId && !session.isHost(seat.userId)) {
      for (const s of [...(tableSockets.get(session.code) || [])]) {
        if (String(s.data.user.id) === seat.userId) {
          s.emit(S2C.ENDED, { reason: "kicked" });
          untrack(s);
        }
      }
    }
    commit(session);
  },

  [C2S.SIT](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.sitHost(payload.position);
    commit(session);
  },

  [C2S.CONFIG](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.setConfig(payload.config);
    commit(session);
  },

  [C2S.START](socket) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.start();
    commit(session);
  },

  [C2S.RECORD](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.record({
      kind: payload.kind,
      seat: payload.seat,
      value: payload.value,
      canto: payload.canto,
    });
    commit(session);
  },

  [C2S.UNDO](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.undo(payload.opId);
    commit(session);
  },

  [C2S.CONFIRM](socket) {
    return finishAndSave(socket, (s) => s.confirmWin());
  },

  [C2S.CLOSE](socket, payload) {
    return finishAndSave(socket, (s) => s.closeWithWinner(payload.winnerSlot));
  },

  [C2S.DISCARD](socket) {
    const session = requireTable(socket);
    requireHost(session, socket);
    // After a saved game this is just "close the table" — nothing is lost.
    endTable(session.code, session.status === "finished" ? "closed" : "discarded");
  },

  [C2S.REMATCH](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    // "again" | "winners" | "lobby" (see CompanionSession#rematch)
    session.rematch(payload.mode, { canSeat: seatableHere(session.code) });
    commit(session);
  },

  [C2S.LEAVE](socket) {
    const session = socket.data.code ? store.get(socket.data.code) : null;
    untrack(socket);
    if (!session) return;
    if (session.isHost(socket.data.user.id)) {
      broadcast(session); // presence only — the host closes with DISCARD
      return;
    }
    const { left, dequeued } = session.leave(socket.data.user.id);
    if (left || dequeued) commit(session);
    else broadcast(session);
  },

  // ── the line (cola para la próxima) ──

  [C2S.QUEUE_JOIN](socket) {
    const session = requireTable(socket);
    const user = socket.data.user;
    session.enqueue({ userId: user.id, name: nameAt(session, user) });
    commit(session);
  },

  [C2S.QUEUE_LEAVE](socket) {
    const session = requireTable(socket);
    if (session.dequeueUser(socket.data.user.id)) commit(session);
    else broadcast(session);
  },

  [C2S.QUEUE_ADD](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.enqueueGuest(payload.name);
    commit(session);
  },

  [C2S.QUEUE_REMOVE](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.dequeue(payload.qid);
    commit(session);
  },

  [C2S.SEAT_QUEUED](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    session.seatFromQueue(payload.qid, payload.position, { canSeat: seatableHere(session.code) });
    commit(session);
  },

  // ── referee role ──

  [C2S.TRANSFER](socket, payload) {
    const session = requireTable(socket);
    requireHost(session, socket);
    const target = typeof payload.pid === "string" ? session.userIdForPid(payload.pid) : null;
    if (!target) throw coded("bad_target", "Esa persona ya no está en la mesa");
    // Only to someone who can actually run it from their phone right now.
    const name = connectedName(session.code, target);
    if (!name) throw coded("target_offline", "Esa persona no está conectada");
    if (store.busyElsewhere(target, session.code)) {
      throw coded("already_in_table", "Esa persona está en otra mesa");
    }
    session.transferHost({ userId: target, name });
    commit(session);
  },

  [C2S.CLAIM](socket) {
    const session = requireTable(socket);
    const user = socket.data.user;
    if (store.busyElsewhere(user.id, session.code)) {
      throw coded("already_in_table", "Ya estás en otra mesa");
    }
    session.claimHost(
      { userId: user.id, name: nameAt(session, user) },
      { hostAwayMs: hostAwayMs(session), claimAfterMs: opts.claimAfterMs },
    );
    logger.info({ code: session.code }, "companion: referee role taken over");
    commit(session);
  },
};

/** Remove idle tables and tell whoever is still looking. */
function sweep() {
  for (const s of store.sweepExpired()) {
    for (const socket of [...(tableSockets.get(s.code) || [])]) {
      socket.emit(S2C.ENDED, { reason: "expired" });
      untrack(socket);
    }
  }
}

/** Periodic idle sweep (unref'd so it never holds the process open). */
function startReaper(intervalMs = SWEEP_EVERY_MS) {
  const h = setInterval(sweep, intervalMs);
  if (h.unref) h.unref();
  return { stop: () => clearInterval(h) };
}

/**
 * Mount the namespace on an existing socket.io server.
 * @param {import("socket.io").Server} io
 */
function attach(io) {
  if (nsp) return nsp;
  nsp = io.of(NAMESPACE);

  nsp.use((socket, next) => {
    const initData =
      (socket.handshake.auth && socket.handshake.auth.initData) ||
      (socket.handshake.query && socket.handshake.query.initData);
    const user = dashboardAuth.verifyInitData(initData);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = { id: user.id, first_name: user.first_name, username: user.username };
    next();
  });

  nsp.on("connection", (socket) => {
    for (const event of Object.keys(handlers)) {
      socket.on(event, (payload, ack) => {
        store
          .ready()
          .then(() => handlers[event](socket, payload || {}, ack))
          .catch((err) => {
            if (!err.code) {
              logger.warn(
                { err: err.message, event, code: socket.data.code },
                "companion handler error",
              );
            }
            socket.emit(S2C.ERROR, {
              code: err.code || "internal_error",
              message: err.message || "Error interno",
            });
          });
      });
    }
    socket.on("disconnect", () => {
      const code = socket.data.code;
      untrack(socket);
      const session = code ? store.get(code) : null;
      if (session) broadcast(session); // presence changed; nobody loses their seat
    });
  });

  logger.info({ namespace: NAMESPACE }, "companion ws attached");
  return nsp;
}

/** Test hook: shorten the take-over delay, fake the clock. */
function configure({ claimAfterMs, now } = {}) {
  if (claimAfterMs != null) opts.claimAfterMs = claimAfterMs;
  if (now) opts.now = now;
}

module.exports = {
  attach,
  startReaper,
  sweep,
  configure,
  _internal: { handlers, tableSockets, normalizeCode },
};
