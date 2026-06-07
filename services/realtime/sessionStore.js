const GameSession = require("./GameSession");

/**
 * In-memory registry of WebApp game sessions, keyed by code. SEPARATE from
 * the Telegram `games[chatId]` map in services/game.js — WebApp play is a
 * parallel world. SP1 keeps sessions in memory only; a process restart
 * loses in-flight WebApp games (acceptable per spec).
 */
const sessions = new Map();

const CODE_PREFIX = "CAIDA-";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — ambiguous when typed
const CODE_LEN = 4;

/** Default code generator. Math.random is fine at runtime; tests inject a
 *  deterministic generator via the `genCode` option. */
function defaultGenCode() {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + out;
}

/**
 * Create a session, seating `hostUser` at seat 0.
 * @param {{userId:(string|number), name:string}} hostUser
 * @param {Object} [opts]
 * @param {import("../../class/Config")} [opts.config] - engine config.
 * @param {() => string} [opts.genCode] - inject for deterministic tests.
 * @returns {GameSession}
 */
function create(hostUser, opts = {}) {
  if (!hostUser || hostUser.userId == null) {
    throw new Error("create requires hostUser { userId, name }");
  }
  const gen = opts.genCode || defaultGenCode;
  const code = uniqueCode(gen);
  const session = new GameSession({
    code,
    host: { userId: hostUser.userId, name: hostUser.name },
    config: opts.config,
  });
  sessions.set(code, session);
  return session;
}

/** Draw codes until a free one is found. Bounded so a misbehaving injected
 *  generator can't spin forever. */
function uniqueCode(gen) {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const code = gen();
    if (!sessions.has(code)) return code;
  }
  throw new Error("could not generate a unique session code");
}

/** @returns {GameSession|null} */
function get(code) {
  return sessions.get(code) || null;
}

/**
 * Find the active (non-finished) session this user is still seated at, so a
 * reopened/reconnected client can be dropped back into it. A mid-game
 * disconnect keeps the seat (GameSession.leave marks it disconnected), so this
 * resolves the in-progress table; a finished one is skipped (nothing to resume).
 * @param {string|number} userId
 * @returns {GameSession|null}
 */
function findByUser(userId) {
  const id = String(userId);
  for (const session of sessions.values()) {
    if (session.status === "finished") continue;
    if (session.seatOf(id)) return session;
  }
  return null;
}

/** Drop a session from the store. @returns {boolean} whether it existed. */
function remove(code) {
  return sessions.delete(code);
}

/**
 * Join an existing session: seats `user` at the next free seat.
 * @param {string} code
 * @param {{userId:(string|number), name:string}} user
 * @returns {GameSession}
 */
function join(code, user) {
  const session = get(code);
  if (!session) {
    const err = new Error("Sesión no encontrada");
    err.code = "session_not_found";
    throw err;
  }
  session.addHuman({ userId: user.userId, name: user.name });
  return session;
}

/** Test/maintenance helper: wipe all sessions. */
function _clear() {
  sessions.clear();
}

module.exports = {
  create,
  get,
  findByUser,
  remove,
  join,
  _clear,
  _sessions: sessions,
};
