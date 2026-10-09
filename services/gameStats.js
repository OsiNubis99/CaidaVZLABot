/**
 * Game-result stats. Decides what to record when a game ends and applies it
 * fire-and-forget (so a DB hiccup never blocks the play response).
 *
 * Rules:
 *  - "win" (ganados) counts only for a RANKED game: no bots in the roster AND
 *    the numeric scoring equals one of the FACTORY modes (Clásico, The
 *    Grupish — every lang/game_modes_es entry with game_mode > 0). On/off
 *    toggles (mata_canto, mata_mesa, caida_continua), `type` (2v2 / todos
 *    contra todos) and `game_mode` do NOT affect rankedness — only changing
 *    points or multipliers does.
 *  - Bots (cpu_easy/medium/pro rows) count ALL their games (a bot is always in
 *    its own game), so their win rate stays measurable.
 *  - "beat_pro" achievement: a human who beats cpu_pro in a 1v1.
 *
 * The decision (computeResult) is pure and unit-tested; recordResult wires it
 * to the DB and stashes the summary on the game for the GAME_FINISHED event.
 * The ranked rules themselves live in services/ranked (no DB).
 */
const { UserController } = require("../database");
const AppGameRepo = require("../database/appGames");
const { appGameRecord } = require("./partners");
const {
  SCORING_FIELDS,
  matchFactoryPreset,
  isDefaultScoring,
  rankedStatus,
} = require("./ranked");

function pickScoring(config) {
  const out = {};
  for (const f of SCORING_FIELDS) out[f] = config ? Number(config[f]) : null;
  return out;
}

/**
 * Pure: decide the stat deltas for a finished game. No DB, no side effects.
 * @param {Object} game - the finished Game (users[], config, scoringSlot()).
 * @param {Number} winnerSlot - the winning scoring slot.
 * @returns {{ranked:boolean, reason:(string|null), preset:(string|null),
 *            is1v1:boolean, winnerSlot:number, entries:Array,
 *            beatProUserId:(string|null), config:Object}}
 */
function computeResult(game, winnerSlot) {
  const users = (game && game.users) || [];
  const hasBots = users.some((u) => u && u.cpu_difficulty);
  const status = rankedStatus({ config: game.config, hasBots });
  const ranked = status.ranked;

  const entries = users.map((u, i) => {
    const isBot = !!u.cpu_difficulty;
    const slot = game.scoringSlot(i);
    const won = slot === winnerSlot;
    return {
      statsId: u.statsId(),
      // Display name for the player's game history (never the Telegram id).
      name: u.first_name || null,
      isBot,
      difficulty: u.cpu_difficulty || null,
      slot,
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
    reason: status.reason,
    preset: status.preset,
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
  // The roster for good (game_events is pruned at 30 days): feeds 🤝 Parejas.
  const rec = appGameRecord(summary);
  if (rec) AppGameRepo.insertGame(rec).catch(() => {});
  return summary;
}

module.exports = {
  isDefaultScoring,
  matchFactoryPreset,
  rankedStatus,
  computeResult,
  recordResult,
  SCORING_FIELDS,
};
