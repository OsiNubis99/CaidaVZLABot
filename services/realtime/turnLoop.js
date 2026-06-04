/**
 * Transport-agnostic turn loop for a WebApp GameSession (SP1, T4).
 *
 * Mirrors the Telegram turn loop (`scheduleCpuTurn`/`cpuStep`/`autoSkipTurn`
 * in index.js + `services/game.js`) but with zero Telegram coupling: it
 * operates on a GameSession and a `broadcast(session)` callback injected by
 * the WS layer, so it is fully unit-testable without sockets or real timers.
 *
 * Two responsibilities:
 *   - CPU auto-step: when the seat now up is a CPU, the server plays it after
 *     a short UX delay (so the client can animate), broadcasts, and repeats
 *     while the next seat up is also a CPU (a chain of bots resolves on its
 *     own). Handles the Start_By dealer-direction pick too.
 *   - Human turn timeout: when the seat up is a human and
 *     config.turn_timeout_seconds > 0, schedule an auto-skip that plays the
 *     lowest/forced card (mirrors autoSkipTurn) after the timeout, cancelled
 *     when they act.
 *
 * Timer hygiene: each session has at most ONE pending CPU timer and ONE
 * pending skip timer. drive() clears both before re-arming. clear() wipes
 * them when the session ends or every socket leaves — no leaked setTimeout.
 */
const CpuPlayer = require("../../class/CpuPlayer");

const STARTBY_SENTINEL = "Start_By";

// UX delays (ms). A canto chains immediately into the follow-up play; a
// fresh play gives the client a beat to animate the previous move.
const CPU_PLAY_DELAY_MS = 2200;
const CPU_CHAIN_DELAY_MS = 1500;

/**
 * Per-session timer handles. Keyed by session.code so a session can be
 * driven repeatedly without leaking timers across calls. Lives module-scope
 * (not on the session) so GameSession stays a pure model.
 */
const timers = new Map(); // code → { cpu: Handle|null, skip: Handle|null }

function slotFor(code) {
  let t = timers.get(code);
  if (!t) {
    t = { cpu: null, skip: null };
    timers.set(code, t);
  }
  return t;
}

/**
 * Default scheduler — real timers. Tests inject a fake one exposing the same
 * { setTimeout, clearTimeout } shape so they can advance time deterministically.
 */
const realScheduler = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h),
};

/** Whether the dealer currently holds the Start_By sentinel (deck just
 *  shuffled, someone must pick direction 1/4). */
function isStartByState(game) {
  const last = game.users[game.users.length - 1];
  return !!(last && Array.isArray(last.cards) && last.cards[0] === STARTBY_SENTINEL);
}

/** The engine index of whoever is up to act right now (dealer in Start_By
 *  state, otherwise game.player). */
function actorIndex(game) {
  if (isStartByState(game)) return game.users.length - 1;
  return game.player;
}

/** The engine User up to act, or null if the game isn't running. */
function actorUser(session) {
  if (session.status !== "playing") return null;
  const game = session.game;
  if (!game || game.decks === 0) return null;
  return game.users[actorIndex(game)] || null;
}

/**
 * Drive the loop after any state change. Clears stale timers, then:
 *   - if the game is finished/not playing → nothing to schedule;
 *   - if the seat up is a CPU → arm the CPU auto-step;
 *   - if the seat up is a human with a configured timeout → arm the skip.
 *
 * @param {GameSession} session
 * @param {(session: GameSession) => void} broadcast - per-viewer broadcaster.
 * @param {Object} [scheduler] - { setTimeout, clearTimeout }; injectable for tests.
 * @param {Object} [opts]
 * @param {boolean} [opts.chain] - shorter delay (a canto just happened, chain
 *   straight into the follow-up play).
 */
function drive(session, broadcast, scheduler = realScheduler, opts = {}) {
  const t = slotFor(session.code);
  // Always clear both pending timers first: the state changed, so any
  // previously-armed CPU step or human skip is stale.
  if (t.cpu) {
    scheduler.clearTimeout(t.cpu);
    t.cpu = null;
  }
  if (t.skip) {
    scheduler.clearTimeout(t.skip);
    t.skip = null;
  }

  if (session.status !== "playing") return;
  const actor = actorUser(session);
  if (!actor) return;

  if (actor.cpu_difficulty) {
    const delay = opts.chain ? CPU_CHAIN_DELAY_MS : CPU_PLAY_DELAY_MS;
    t.cpu = scheduler.setTimeout(() => {
      t.cpu = null;
      stepCpu(session, broadcast, scheduler);
    }, delay);
    return;
  }

  // Human up: arm an auto-skip if the config wants one and the seat is
  // actually a human turn we can skip.
  const timeout = session.config && session.config.turn_timeout_seconds;
  if (timeout && timeout > 0) {
    const expectedUserId = String(actor.id_user);
    t.skip = scheduler.setTimeout(() => {
      t.skip = null;
      stepSkip(session, broadcast, scheduler, expectedUserId);
    }, timeout * 1000);
  }
}

/**
 * Execute one CPU auto-step for whoever is up, then re-drive. Uses
 * CpuPlayer.decide for the move and the session's own play()/sing() so the
 * engine state and lastEvent stay consistent with human plays.
 *
 * A canto is a two-phase move (declare, then still holding 3 cards, play):
 * we drive() with chain:true so the follow-up play fires on a short delay.
 */
function stepCpu(session, broadcast, scheduler) {
  if (session.status !== "playing") return;
  const game = session.game;
  if (!game || game.decks === 0) return;
  const idx = actorIndex(game);
  const actor = game.users[idx];
  if (!actor || !actor.cpu_difficulty) return;

  let chained = false;
  try {
    const decision = CpuPlayer.decide(game, idx, actor.cpu_difficulty);
    if (decision.action === "start_by") {
      session.play(actor.id_user, decision.value);
    } else if (decision.action === "sing") {
      session.sing(actor.id_user);
      chained = true; // after canto the CPU still has its 3 cards; play next
    } else {
      session.play(actor.id_user, decision.cardIdx);
    }
  } catch {
    // A CPU move should never throw under normal play; if the engine
    // rejects (e.g. a race after disconnect cleanup) we stop the chain
    // rather than spin. The error is swallowed here — the WS layer logs
    // session-level failures, and re-driving on a stale state would loop.
    return;
  }

  broadcast(session);
  if (session.status === "finished") {
    clear(session.code, scheduler);
    return;
  }
  drive(session, broadcast, scheduler, { chain: chained });
}

/**
 * Auto-skip a human who ran out the clock. Mirrors game.autoSkipTurn:
 * in Start_By state the dealer is forced to direction 1; otherwise the
 * player plays card index 0 (the lowest/forced card). Guarded by
 * expectedUserId so a skip armed for one player can't fire after the turn
 * already moved on (the same anti-stale guard the Telegram loop uses).
 */
function stepSkip(session, broadcast, scheduler, expectedUserId) {
  if (session.status !== "playing") return;
  const game = session.game;
  if (!game || game.decks === 0) return;
  const idx = actorIndex(game);
  const actor = game.users[idx];
  if (!actor || String(actor.id_user) !== String(expectedUserId)) return;
  // Don't auto-skip a CPU (it has its own path) — defensive: a CPU should
  // never have a skip timer armed.
  if (actor.cpu_difficulty) return;

  try {
    if (isStartByState(game)) {
      session.play(actor.id_user, 1);
    } else {
      session.play(actor.id_user, 0);
    }
  } catch {
    return;
  }

  broadcast(session);
  if (session.status === "finished") {
    clear(session.code, scheduler);
    return;
  }
  drive(session, broadcast, scheduler);
}

/** Clear and forget a session's timers. Call on session end / full
 *  disconnect so no setTimeout outlives the session. */
function clear(code, scheduler = realScheduler) {
  const t = timers.get(code);
  if (!t) return;
  if (t.cpu) scheduler.clearTimeout(t.cpu);
  if (t.skip) scheduler.clearTimeout(t.skip);
  timers.delete(code);
}

module.exports = {
  drive,
  clear,
  // Exposed for tests / introspection.
  _internal: { isStartByState, actorIndex, actorUser, timers },
  CPU_PLAY_DELAY_MS,
  CPU_CHAIN_DELAY_MS,
};
