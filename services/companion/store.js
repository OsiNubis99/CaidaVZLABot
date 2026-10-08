/**
 * In-memory registry of Acompañante tables (code → CompanionSession), backed
 * by public.companion_session so a deploy in the middle of a real-life game
 * doesn't lose the score. Saves are debounced per table and flushed on
 * SIGTERM. Separate from the WebApp game sessionStore — different codes
 * (MESA-XXXX), different lifecycle (a disconnect never removes anybody).
 *
 * The repository is injectable (configure({repo})) so tests run without a DB.
 */
const CompanionSession = require("./CompanionSession");
const logger = require("../../config/logger");

const CODE_PREFIX = "MESA-";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1
const CODE_LEN = 4;
const SAVE_DEBOUNCE_MS = 200;
// A real game takes an hour or two; a table nobody touched in 12 h is dead.
const IDLE_MS = 12 * 60 * 60 * 1000;

const sessions = new Map();
const saveTimers = new Map(); // code → timeout handle
let repo = null;
let now = Date.now;
let loaded = Promise.resolve(0);

function getRepo() {
  if (!repo) repo = require("../../database/companion");
  return repo;
}

/** Inject a repository / clock (tests). */
function configure({ repo: r, now: n } = {}) {
  if (r) repo = r;
  if (n) now = n;
}

function defaultGenCode() {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + out;
}

/**
 * Open a new table with `host` seated at the bottom.
 * @param {{userId:(string|number), name:string}} host
 * @param {{config?:Object, genCode?:() => string}} [opts]
 */
function create(host, opts = {}) {
  const gen = opts.genCode || defaultGenCode;
  let code = null;
  for (let i = 0; i < 1000 && !code; i++) {
    const c = gen();
    if (!sessions.has(c)) code = c;
  }
  if (!code) throw new Error("could not generate a unique companion code");
  const session = new CompanionSession({
    code,
    host,
    config: opts.config,
    now: () => now(),
    hostSeated: opts.hostSeated !== false,
  });
  sessions.set(code, session);
  persist(session);
  return session;
}

/** @returns {CompanionSession|null} */
function get(code) {
  return sessions.get(code) || null;
}

/**
 * The table this user belongs to: seated there, or hosting it (a host can
 * stand up and only keep score). Unfinished tables win over finished ones.
 */
function findByUser(userId) {
  const id = String(userId);
  let finished = null;
  for (const s of sessions.values()) {
    if (s.positionOf(id) < 0 && !s.isHost(id)) continue;
    if (s.status !== "finished") return s;
    finished = finished || s;
  }
  return finished;
}

/** Swap in a rebuilt session object (e.g. restoring a snapshot). */
function replace(session) {
  sessions.set(session.code, session);
  persist(session);
}

/** Rebuild a table from a toJSON() snapshot and make it the live one. */
function restore(snapshot) {
  const s = CompanionSession.fromJSON(snapshot, { now: () => now() });
  replace(s);
  return s;
}

/** Drop a table from memory and from the DB. */
function remove(code) {
  const had = sessions.delete(code);
  const t = saveTimers.get(code);
  if (t) {
    clearTimeout(t);
    saveTimers.delete(code);
  }
  getRepo()
    .deleteSession(code)
    .catch((err) => logger.warn({ err: err.message, code }, "companion: delete failed"));
  return had;
}

/** Debounced save of a table's live state. */
function persist(session) {
  const code = session.code;
  const prev = saveTimers.get(code);
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => {
    saveTimers.delete(code);
    saveNow(code);
  }, SAVE_DEBOUNCE_MS);
  if (t.unref) t.unref();
  saveTimers.set(code, t);
}

function saveNow(code) {
  const session = sessions.get(code);
  if (!session) return Promise.resolve();
  return getRepo()
    .saveSession(code, session.toJSON())
    .catch((err) => logger.warn({ err: err.message, code }, "companion: save failed"));
}

/** Write every pending save now (SIGTERM / tests). */
async function flush() {
  const codes = [...saveTimers.keys()];
  for (const code of codes) {
    clearTimeout(saveTimers.get(code));
    saveTimers.delete(code);
  }
  await Promise.all(codes.map(saveNow));
}

/** Persist a finished game's result. Throws if the DB write fails. */
async function saveGame(session) {
  return getRepo().insertGame(session.buildRecord());
}

/** Rehydrate every persisted table on boot. @returns {Promise<number>} */
function loadAll() {
  loaded = (async () => {
    const rows = await getRepo().loadSessions();
    let n = 0;
    for (const data of rows) {
      try {
        const s = CompanionSession.fromJSON(data, { now: () => now() });
        if (!sessions.has(s.code)) sessions.set(s.code, s);
        n++;
      } catch (err) {
        logger.warn({ err: err.message }, "companion: could not restore a table");
      }
    }
    if (n) logger.info({ count: n }, "companion: tables restored");
    return n;
  })();
  return loaded;
}

/** Resolves once the boot restore is done (immediately if never started), so
 *  a client reconnecting right after a deploy finds its table. */
function ready() {
  return loaded.then(
    () => undefined,
    () => undefined,
  );
}

/** Remove tables idle for longer than `maxIdleMs`. @returns {CompanionSession[]} */
function sweepExpired(maxIdleMs = IDLE_MS) {
  const removed = [];
  const t = now();
  for (const s of [...sessions.values()]) {
    if (t - (s.updatedAt || 0) > maxIdleMs) {
      removed.push(s);
      remove(s.code);
    }
  }
  return removed;
}

function _clear() {
  for (const t of saveTimers.values()) clearTimeout(t);
  saveTimers.clear();
  sessions.clear();
}

module.exports = {
  CODE_PREFIX,
  IDLE_MS,
  configure,
  create,
  get,
  findByUser,
  replace,
  restore,
  remove,
  persist,
  flush,
  saveGame,
  loadAll,
  ready,
  sweepExpired,
  _clear,
  _sessions: sessions,
};
