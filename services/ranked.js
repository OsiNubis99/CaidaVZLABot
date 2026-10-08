/**
 * Pure "does this game count for ganados?" rules — no DB, no I/O, so both the
 * stats writer (services/gameStats) and the per-viewer WebApp projection
 * (services/realtime/serializeForClient) can use them.
 *
 * A game is RANKED when there are no bots AND its 13 numeric scoring values
 * equal one of the FACTORY modes (every lang/game_modes_es entry with
 * game_mode > 0: Clásico, The Grupish). `type` (2v2 / todos contra todos),
 * `game_mode` and the on/off toggles (mata_canto, mata_mesa, caida_continua)
 * never make a game "custom" — only changing points or multipliers does.
 */
const game_modes = require("../lang/game_modes_es");

// Numeric scoring fields that define a game's scoring.
const SCORING_FIELDS = [
  "points",
  "mesa",
  "caida",
  "ronda",
  "chiguire",
  "patrulla",
  "vigia",
  "registro",
  "maguaro",
  "registrico",
  "casa_chica",
  "casa_grande",
  "trivilin",
];

// game_mode 0 is the "Modificado" placeholder (no values).
const FACTORY_MODES = game_modes.filter((m) => m && m.game_mode > 0);

/**
 * The factory mode whose numeric scoring matches `config` exactly, or null.
 * @param {Object|null} config
 * @returns {{game_mode:number, name:string}|null}
 */
function matchFactoryPreset(config) {
  if (!config) return null;
  const hit = FACTORY_MODES.find((preset) =>
    SCORING_FIELDS.every((f) => Number(config[f]) === Number(preset[f])),
  );
  return hit ? { game_mode: hit.game_mode, name: hit.name } : null;
}

/** True when every numeric scoring value matches a factory mode. */
function isDefaultScoring(config) {
  return matchFactoryPreset(config) !== null;
}

/**
 * Whether a game with this config/roster counts for "ganados", and why not.
 * Bots win over custom scoring as the reported reason (the more obvious cause
 * for the players).
 * @param {{config:Object, hasBots:boolean}} p
 * @returns {{ranked:boolean, reason:(null|"bots"|"custom_scoring"), preset:(string|null)}}
 */
function rankedStatus({ config, hasBots }) {
  const preset = matchFactoryPreset(config);
  const presetName = preset ? preset.name : null;
  if (hasBots) return { ranked: false, reason: "bots", preset: presetName };
  if (!preset) return { ranked: false, reason: "custom_scoring", preset: null };
  return { ranked: true, reason: null, preset: presetName };
}

module.exports = {
  SCORING_FIELDS,
  FACTORY_MODES,
  matchFactoryPreset,
  isDefaultScoring,
  rankedStatus,
};
