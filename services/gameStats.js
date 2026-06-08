/**
 * Game-result stats. Decides what to record when a game ends and applies it
 * fire-and-forget (so a DB hiccup never blocks the play response).
 *
 * Rules:
 *  - "win" (ganados) counts only for a RANKED game: no bots in the roster AND
 *    default scoring (the numeric config equals Clásico). On/off toggles
 *    (mata_canto, mata_mesa, caida_continua), `type` and `game_mode` do NOT
 *    affect rankedness.
 *  - Bots (cpu_easy/medium/pro rows) count ALL their games (a bot is always in
 *    its own game), so their win rate stays measurable.
 *  - "beat_pro" achievement: a human who beats cpu_pro in a 1v1.
 *
 * The decision (computeResult) is pure and unit-tested; recordResult wires it
 * to the DB and stashes the summary on the game for the GAME_FINISHED event.
 */
const { UserController } = require("../database");
const game_modes = require("../lang/game_modes_es");

// Numeric scoring fields that define a "default" (Clásico) game. On/off toggles
// and `type` are intentionally excluded.
const SCORING_FIELDS = [
  "points", "mesa", "caida", "ronda",
  "chiguire", "patrulla", "vigia", "registro", "maguaro",
  "registrico", "casa_chica", "casa_grande", "trivilin",
];

/** True when every numeric scoring value matches the Clásico preset. */
function isDefaultScoring(config) {
  if (!config) return false;
  const def = game_modes[1];
  return SCORING_FIELDS.every((f) => Number(config[f]) === Number(def[f]));
}

function pickScoring(config) {
  const out = {};
  for (const f of SCORING_FIELDS) out[f] = config ? Number(config[f]) : null;
  return out;
}

/**
 * Pure: decide the stat deltas for a finished game. No DB, no side effects.
 * @param {Object} game - the finished Game (users[], config, scoringSlot()).
 * @param {Number} winnerSlot - the scoring slot passed to kill().
 * @returns {{ranked:boolean, is1v1:boolean, winnerSlot:number,
 *            entries:Array, beatProUserId:(string|null), config:Object}}
 */
function computeResult(game, winnerSlot) {
  const users = (game && game.users) || [];
  const hasBots = users.some((u) => u && u.cpu_difficulty);
  const ranked = !hasBots && isDefaultScoring(game.config);

  const entries = users.map((u, i) => {
    const isBot = !!u.cpu_difficulty;
    const won = game.scoringSlot(i) === winnerSlot;
    return {
      statsId: u.statsId(),
      isBot,
      difficulty: u.cpu_difficulty || null,
      won,
      // Bots count their wins always (for win rate); humans only when ranked.
      countWin: isBot ? won : ranked && won,
      caida: u.caida || 0,
      caido: u.caido || 0,
    };
  });

  // PRO achievement: a 1v1 of exactly one human + one cpu_pro, human wins.
  let beatProUserId = null;
  if (users.length === 2) {
    const humanIdx = users.findIndex((u) => !u.cpu_difficulty);
    const hasPro = users.some((u) => u.cpu_difficulty === "pro");
    if (humanIdx >= 0 && hasPro && game.scoringSlot(humanIdx) === winnerSlot) {
      beatProUserId = users[humanIdx].statsId();
    }
  }

  return {
    ranked,
    is1v1: users.length === 2,
    winnerSlot,
    entries,
    beatProUserId,
    config: pickScoring(game.config),
  };
}

/**
 * Apply a finished game's stats (fire-and-forget) and stash the summary on the
 * game so the GAME_FINISHED event can carry it. Returns the summary (or null).
 * @param {Object} game
 * @param {Number} winnerSlot
 */
function recordResult(game, winnerSlot) {
  let summary;
  try {
    summary = computeResult(game, winnerSlot);
  } catch (_) {
    return null;
  }
  game._lastResult = summary;
  for (const e of summary.entries) {
    UserController.recordGameStats(e.statsId, {
      won: e.countWin,
      caida: e.caida,
      caido: e.caido,
    }).catch(() => {});
  }
  if (summary.beatProUserId) {
    UserController.incrementBeatPro(summary.beatProUserId).catch(() => {});
  }
  return summary;
}

module.exports = { isDefaultScoring, computeResult, recordResult, SCORING_FIELDS };
