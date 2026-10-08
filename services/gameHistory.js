/**
 * "Mi cuenta → Últimas partidas": the viewer's recent finished games, read
 * from the game_finished events (Telegram groups AND WebApp tables, which log
 * under their CAIDA-XXXX code). Retention is whatever game_events keeps (30
 * days). The projection is pure; only recentForUser touches the DB.
 */
const db = require("../config/db");

function inferReason(result) {
  if (!result || result.ranked) return null;
  if (result.reason !== undefined) return result.reason;
  const entries = Array.isArray(result.entries) ? result.entries : [];
  if (entries.length === 0) return null;
  return entries.some((e) => e && (e.isBot || String(e.statsId || "").startsWith("cpu_")))
    ? "bots"
    : "custom_scoring";
}

/**
 * One game_finished event → one history row, from the viewer's side. Handles
 * payloads from before `reason` / `slot` / `won` / `name` existed.
 * @param {{id_group:string, group_name?:string, created_at:Date, payload:Object}} row
 * @param {(string|number)} userId - the viewer
 */
function projectGameRow(row, userId) {
  const p = (row && row.payload) || {};
  const r = p.result || null;
  const id = String(userId);
  const entries = r && Array.isArray(r.entries) ? r.entries : [];
  const mine = entries.find((e) => e && String(e.statsId) === id) || null;

  let won;
  if (mine && typeof mine.won === "boolean") won = mine.won;
  else if (mine && mine.countWin) won = true;
  else won = p.winner_user_id != null && String(p.winner_user_id) === id;

  const isWebapp = p.source === "webapp" || String(row.id_group || "").startsWith("CAIDA-");

  return {
    at: row.created_at,
    source: isWebapp ? "webapp" : "group",
    place: isWebapp ? null : row.group_name || null,
    won,
    ranked: !!(r && r.ranked),
    reason: inferReason(r),
    preset: (r && r.preset) || null,
    points: Array.isArray(p.points) ? p.points.map((n) => Number(n) || 0) : [],
    winnerSlot: r && r.winnerSlot != null ? r.winnerSlot : null,
    mySlot: mine && mine.slot != null ? mine.slot : null,
    players: entries.map((e) => ({
      name: (e && e.name) || null,
      slot: e && e.slot != null ? e.slot : null,
      bot: !!(e && (e.isBot || String(e.statsId || "").startsWith("cpu_"))),
      me: !!e && String(e.statsId) === id,
    })),
  };
}

/** The viewer's last `limit` finished games (newest first). */
async function recentForUser(userId, limit = 10) {
  const id = String(userId);
  const r = await db.query(
    `SELECT e.id_group, e.payload, e.created_at, g.name AS group_name
       FROM public.game_events e
       LEFT JOIN public.group g ON g.id_group = e.id_group
      WHERE e.event_type = 'game_finished'
        AND (
          e.payload->>'winner_user_id' = $1
          OR EXISTS (
            SELECT 1
              FROM jsonb_array_elements(
                     CASE WHEN jsonb_typeof(e.payload->'result'->'entries') = 'array'
                          THEN e.payload->'result'->'entries'
                          ELSE '[]'::jsonb END) x
             WHERE x->>'statsId' = $1
          )
        )
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $2`,
    [id, limit],
  );
  return r.rows.map((row) => projectGameRow(row, id));
}

module.exports = { projectGameRow, recentForUser };
