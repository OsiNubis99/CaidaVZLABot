/**
 * Append-only event log for game replay/historial.
 *
 * Each public game emits typed events (join, play, sing, kill, etc.).
 * The /historial command queries by group and pretty-prints the last
 * finished partida.
 */
const db = require("../config/db");
const logger = require("../config/logger");

const EVENT_TYPES = {
  GAME_CREATED: "game_created",
  PLAYER_JOINED: "player_joined",
  PLAYER_LEFT: "player_left",
  DECK_SHUFFLED: "deck_shuffled",
  CARD_PLAYED: "card_played",
  CAIDA: "caida",
  SING: "sing",
  HAND_DEALT: "hand_dealt",
  GAME_FINISHED: "game_finished",
  GAME_EXPIRED: "game_expired",
};

async function record(id_group, event_type, payload = {}) {
  try {
    await db.query(
      "INSERT INTO public.game_events (id_group, event_type, payload) VALUES ($1, $2, $3)",
      [id_group, event_type, payload],
    );
  } catch (err) {
    // Logging is best-effort; never let it break gameplay.
    logger.warn({ err: err.message, id_group, event_type }, "event record failed");
  }
}

/**
 * Fetch the last finished game's events for a group (events between
 * the previous game_finished and the latest one, inclusive).
 */
async function lastGameEvents(id_group, limit = 200) {
  const r = await db.query(
    `SELECT event_type, payload, created_at
       FROM public.game_events
      WHERE id_group = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [id_group, limit],
  );
  // rows are newest-first; slice back to the latest finished partida.
  const rows = r.rows.reverse();
  // walk forward, keep events from the latest game_created to game_finished.
  let lastFinishIdx = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].event_type === EVENT_TYPES.GAME_FINISHED) {
      lastFinishIdx = i;
      break;
    }
  }
  if (lastFinishIdx === -1) return rows; // ongoing
  let startIdx = 0;
  for (let i = lastFinishIdx - 1; i >= 0; i--) {
    if (rows[i].event_type === EVENT_TYPES.GAME_CREATED) {
      startIdx = i;
      break;
    }
  }
  return rows.slice(startIdx, lastFinishIdx + 1);
}

/**
 * Retention: drop events older than N days. Called from a periodic
 * timer in index.js.
 */
async function pruneOlderThan(days = 30) {
  const r = await db.query(
    `DELETE FROM public.game_events WHERE created_at < now() - ($1 || ' days')::interval`,
    [String(days)],
  );
  logger.info({ rowCount: r.rowCount, days }, "pruned game_events");
}

/**
 * Render the events array as a human-readable transcript for /historial.
 */
function renderTranscript(rows) {
  if (!rows || rows.length === 0) {
    return "No hay partidas registradas en este grupo aún.";
  }
  const lines = ["📜 *Última partida*", ""];
  for (const r of rows) {
    const t = new Date(r.created_at).toISOString().slice(11, 19);
    const p = r.payload || {};
    switch (r.event_type) {
      case EVENT_TYPES.GAME_CREATED:
        lines.push(`${t} — partida creada`);
        break;
      case EVENT_TYPES.PLAYER_JOINED:
        lines.push(`${t} — se unió ${p.first_name || p.user_id}`);
        break;
      case EVENT_TYPES.DECK_SHUFFLED:
        lines.push(`${t} — mazo barajado (deck #${p.decks})`);
        break;
      case EVENT_TYPES.HAND_DEALT:
        lines.push(`${t} — nueva mano (start_by=${p.start_by})`);
        break;
      case EVENT_TYPES.CARD_PLAYED:
        lines.push(`${t} — ${p.first_name || p.user_id} jugó ${p.value} de ${p.type}`);
        break;
      case EVENT_TYPES.CAIDA:
        lines.push(`${t} — ⚡ caída de ${p.first_name || p.user_id} con ${p.value} de ${p.type}`);
        break;
      case EVENT_TYPES.SING:
        lines.push(`${t} — 🎵 ${p.first_name || p.user_id} cantó ${p.sing_name}`);
        break;
      case EVENT_TYPES.GAME_FINISHED:
        lines.push(
          `${t} — 🏆 ganó ${p.winner_first_name || p.winner_user_id || "alguien"} ` +
            `(puntos ${JSON.stringify(p.points)}, ${p.decks} decks)`,
        );
        break;
      default:
        lines.push(`${t} — ${r.event_type}`);
    }
  }
  return lines.join("\n");
}

module.exports = { EVENT_TYPES, record, lastGameEvents, pruneOlderThan, renderTranscript };
