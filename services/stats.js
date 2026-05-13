/**
 * Stats data fetcher. Pure: takes no input, returns one snapshot of
 * counts queried in parallel. Used by the /stats dashboard route in
 * config/server.js.
 */
const db = require("../config/db");
const { UserController } = require("../database");

async function safeQuery(text, params = []) {
  try {
    const r = await db.query(text, params);
    return { ok: true, rows: r.rows };
  } catch (err) {
    return { ok: false, error: err.message, rows: [] };
  }
}

async function getStats() {
  const [top, groups, gamesInFlight, eventsByType, eventsTotal24h, users, cards] =
    await Promise.allSettled([
      UserController.top(10),
      safeQuery(
        "SELECT COUNT(*)::int AS total, " +
          "COUNT(*) FILTER (WHERE public)::int AS public_count, " +
          "COUNT(*) FILTER (WHERE paid_up_to >= CURRENT_DATE)::int AS paid_active " +
          "FROM public.group",
      ),
      safeQuery("SELECT COUNT(*)::int AS c FROM public.game_state"),
      safeQuery(
        "SELECT event_type, COUNT(*)::int AS c FROM public.game_events " +
          "WHERE created_at >= NOW() - INTERVAL '24 hours' " +
          "GROUP BY event_type ORDER BY c DESC",
      ),
      safeQuery(
        "SELECT COUNT(*)::int AS c FROM public.game_events " +
          "WHERE created_at >= NOW() - INTERVAL '24 hours'",
      ),
      safeQuery(
        "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE is_banned)::int AS banned " +
          "FROM public.user",
      ),
      safeQuery("SELECT COUNT(*)::int AS c FROM public.cards"),
    ]);

  function pickRows(settled) {
    if (settled.status !== "fulfilled") return [];
    if (settled.value && Array.isArray(settled.value.rows)) return settled.value.rows;
    if (Array.isArray(settled.value)) return settled.value;
    return [];
  }

  const groupRow = pickRows(groups)[0] || { total: 0, public_count: 0, paid_active: 0 };
  const usersRow = pickRows(users)[0] || { total: 0, banned: 0 };
  const cardsCount = (pickRows(cards)[0] || { c: 0 }).c;
  const eventsByTypeRows = pickRows(eventsByType);
  const eventsTotal = (pickRows(eventsTotal24h)[0] || { c: 0 }).c;
  const gamesInFlightCount = (pickRows(gamesInFlight)[0] || { c: 0 }).c;
  const topRows = top.status === "fulfilled" ? top.value : [];

  return {
    now: new Date().toISOString(),
    top: topRows,
    groups: groupRow,
    gamesInFlight: gamesInFlightCount,
    eventsByType: eventsByTypeRows,
    eventsTotal24h: eventsTotal,
    users: usersRow,
    cardsBootstrapped: cardsCount,
    cardsTotal: 40,
  };
}

module.exports = { getStats };
