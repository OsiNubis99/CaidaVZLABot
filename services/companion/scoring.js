/**
 * Acompañante (real-table scorekeeper) — pure scoring rules. No I/O.
 *
 * The scorer records what happened at a real table ("Daniel hizo caída de
 * caballo", "Mafeer cantó registro", "Andrés limpió la mesa"); this module
 * turns each record into points with the table's config and folds the log
 * into per-seat contributions and per-slot (team or player) totals.
 *
 * Seats are 4 fixed POSITIONS around the table: 0 bottom (scorer by
 * default), 1 right, 2 top, 3 left. Parejas = opposite positions (0+2 vs
 * 1+3) — the same `i % 2` split the engine uses — and only with exactly 4
 * seated; otherwise everyone plays individual.
 */
const { sanitizeConfig } = require("../realtime/configSanitize");
const game_modes = require("../../lang/game_modes_es");

const POSITIONS = 4;
// Points typed by hand: mala echada, pegado en mesa, the cards taken at the
// end of the deck... anything the table scores that isn't a canto/caída/mesa.
const MAX_MANUAL = 99;

const CANTO_KEYS = Object.freeze([
  "chiguire",
  "patrulla",
  "vigia",
  "registro",
  "maguaro",
  "registrico",
  "casa_chica",
  "casa_grande",
  "trivilin",
]);

// The only config the scorer needs: target, type, and the point values. The
// engine toggles (mata_canto, mata_mesa, caida_continua) are things the
// players apply at the real table, not something to score.
const CONFIG_KEYS = Object.freeze(["points", "type", "mesa", "caida", "ronda", ...CANTO_KEYS]);

const DEFAULT_CONFIG = Object.freeze({
  ...pick(game_modes[1], CONFIG_KEYS),
  // 2v2 is the usual real-table format, so it's the companion's default.
  type: "parejas",
});

const OP_KINDS = Object.freeze(["caida", "canto", "mesa", "puntos"]);

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function companionError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

/** Whitelist + clamp a client config down to the companion's fields. */
function sanitizeCompanionConfig(raw) {
  return pick(sanitizeConfig(raw), CONFIG_KEYS);
}

/** "parejas" only with type parejas AND 4 seated; else "individual". */
function effectiveMode(config, seatedCount) {
  return config && config.type === "parejas" && seatedCount === POSITIONS
    ? "parejas"
    : "individual";
}

/** Scoring slot for a seat position: team (0/1) in parejas, the position otherwise. */
function slotOf(position, mode) {
  return mode === "parejas" ? position % 2 : position;
}

function intIn(v, min, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Points for one record under `config`. Throws `bad_op` for anything the
 * scorer UI never sends: unknown kinds/cantos, out-of-range values, or a play
 * worth 0 in this config (a Chigüire in Clásico, a caída with multiplier 0 —
 * the engine doesn't count those either).
 * @param {{kind:string, value?:number, canto?:string}} op
 * @param {Object} config
 * @returns {number}
 */
function opPoints(op, config) {
  const bad = (msg) => companionError("bad_op", msg || "Jugada inválida");
  if (!op || !OP_KINDS.includes(op.kind)) throw bad();
  let points;
  switch (op.kind) {
    case "caida": {
      const v = intIn(op.value, 1, 4);
      if (v == null) throw bad("La caída vale 1, 2, 3 o 4");
      points = v * Number(config.caida);
      break;
    }
    case "canto": {
      if (op.canto === "ronda") {
        const v = intIn(op.value, 1, 4);
        if (v == null) throw bad("La ronda vale 1, 2, 3 o 4");
        points = v * Number(config.ronda);
      } else if (CANTO_KEYS.includes(op.canto)) {
        points = Number(config[op.canto]);
      } else {
        throw bad("Canto desconocido");
      }
      break;
    }
    case "mesa":
      points = Number(config.mesa);
      break;
    case "puntos": {
      const v = intIn(op.value, 1, MAX_MANUAL);
      if (v == null) throw bad(`Puntos: entre 1 y ${MAX_MANUAL}`);
      points = v;
      break;
    }
  }
  if (!Number.isFinite(points) || points <= 0) throw bad("No vale puntos con esta configuración");
  return points;
}

function emptyTally() {
  return {
    points: 0,
    caidas: 0,
    caidaPoints: 0,
    cantos: {},
    cantoPoints: 0,
    mesas: 0,
    mesaPoints: 0,
    manual: 0,
  };
}

/**
 * Fold the record log into per-seat tallies and per-slot totals.
 * @param {{seats:Array, ops:Array, config:Object}} p - seats by position (null = empty)
 * @returns {{mode:string, slots:Array<{slot:number, positions:number[], total:number}>,
 *            perSeat:Object<number, Object>}}
 */
function summarize({ seats, ops, config }) {
  const seated = [];
  for (let p = 0; p < POSITIONS; p++) if (seats[p]) seated.push(p);
  const mode = effectiveMode(config, seated.length);

  const slotMap = new Map();
  const perSeat = {};
  for (const p of seated) {
    const slot = slotOf(p, mode);
    if (!slotMap.has(slot)) slotMap.set(slot, { slot, positions: [], total: 0 });
    slotMap.get(slot).positions.push(p);
    perSeat[p] = emptyTally();
  }

  for (const op of ops || []) {
    const t = perSeat[op.seat];
    if (!t) continue; // a record for a seat that's gone (never happens mid-game)
    t.points += op.points;
    switch (op.kind) {
      case "caida":
        t.caidas += 1;
        t.caidaPoints += op.points;
        break;
      case "canto":
        t.cantos[op.canto] = (t.cantos[op.canto] || 0) + 1;
        t.cantoPoints += op.points;
        break;
      case "mesa":
        t.mesas += 1;
        t.mesaPoints += op.points;
        break;
      case "puntos":
        t.manual += op.points;
        break;
    }
    slotMap.get(slotOf(op.seat, mode)).total += op.points;
  }

  const slots = [...slotMap.values()].sort((a, b) => a.slot - b.slot);
  return { mode, slots, perSeat };
}

/** The slot whose total reached `target`, or null. One record only ever adds
 *  to one slot, so at most one slot can cross on a given record. */
function winningSlot(slots, target) {
  const hit = slots.find((s) => s.total >= target);
  return hit ? hit.slot : null;
}

module.exports = {
  POSITIONS,
  MAX_MANUAL,
  CANTO_KEYS,
  CONFIG_KEYS,
  DEFAULT_CONFIG,
  OP_KINDS,
  companionError,
  sanitizeCompanionConfig,
  effectiveMode,
  slotOf,
  opPoints,
  summarize,
  winningSlot,
};
