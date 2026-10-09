/**
 * Acompañante persistence: live tables (companion_session) and saved games
 * (companion_game + companion_player). Deliberately separate from
 * public.user — the companion's stats never mix with the app's.
 */
const db = require("../config/db");
const ranking = require("../services/ranking");

const CANTO_KEYS = [
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

module.exports = {
  /** Upsert the live state of a table. */
  async saveSession(code, state) {
    await db.query(
      `INSERT INTO public.companion_session (code, state, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (code) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [code, state],
    );
  },

  async deleteSession(code) {
    await db.query("DELETE FROM public.companion_session WHERE code = $1", [code]);
  },

  /** @returns {Promise<Object[]>} every persisted table state */
  async loadSessions() {
    const r = await db.query("SELECT state FROM public.companion_session");
    return r.rows.map((row) => row.state);
  },

  /**
   * Save a finished game (CompanionSession#buildRecord) in one transaction.
   * @returns {Promise<number>} the companion_game id
   */
  async insertGame(rec) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const g = await client.query(
        `INSERT INTO public.companion_game
           (code, game_no, host_id, mode, players, target, winner_slot, ended_by,
            totals, config, ops, started_at, finished_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,to_timestamp($12 / 1000.0),to_timestamp($13 / 1000.0))
         RETURNING id`,
        [
          rec.code,
          rec.gameNo,
          rec.hostUserId,
          rec.mode,
          rec.players.length,
          rec.target,
          rec.winnerSlot,
          rec.endedBy,
          JSON.stringify(rec.totals),
          JSON.stringify(rec.config),
          JSON.stringify(rec.ops),
          rec.startedAt || rec.finishedAt,
          rec.finishedAt,
        ],
      );
      const id = g.rows[0].id;
      for (const p of rec.players) {
        await client.query(
          `INSERT INTO public.companion_player
             (game_id, position, id_user, name, guest, slot, won, points, caidas, cantos, mesas, manual)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            id,
            p.position,
            p.userId,
            p.name,
            p.guest,
            p.slot,
            p.won,
            p.points,
            p.caidas,
            JSON.stringify(p.cantos || {}),
            p.mesas,
            p.manual || 0,
          ],
        );
      }
      await client.query("COMMIT");
      return Number(id);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Lifetime companion stats for one Telegram user — the Mesa real side of
   * "Mi cuenta". `manual` = points added with "Sumar puntos" (mala echada,
   * lo pegado, the last cards); `refereed` = saved games they scored (as the
   * referee when the game was saved, playing or not). Caídas received aren't
   * recorded at real tables (the referee only taps who made the caída).
   */
  async userStats(userId) {
    const id = String(userId);
    const totals = await db.query(
      `SELECT COUNT(*)::int AS played,
              COUNT(*) FILTER (WHERE won)::int AS won,
              COALESCE(SUM(caidas), 0)::int AS caidas,
              COALESCE(SUM(mesas), 0)::int AS mesas,
              COALESCE(SUM(points), 0)::int AS points,
              COALESCE(SUM(manual), 0)::int AS manual
       FROM public.companion_player WHERE id_user = $1`,
      [id],
    );
    const cantosR = await db.query(
      `SELECT c.key, COALESCE(SUM(c.value::int), 0)::int AS n
       FROM public.companion_player p, jsonb_each_text(p.cantos) c
       WHERE p.id_user = $1
       GROUP BY c.key`,
      [id],
    );
    const refereedR = await db.query(
      "SELECT COUNT(*)::int AS n FROM public.companion_game WHERE host_id = $1",
      [id],
    );
    const cantos = {};
    for (const k of CANTO_KEYS) cantos[k] = 0;
    for (const row of cantosR.rows) cantos[row.key] = Number(row.n) || 0;
    const t = totals.rows[0] || {};
    return {
      played: Number(t.played) || 0,
      won: Number(t.won) || 0,
      caidas: Number(t.caidas) || 0,
      mesas: Number(t.mesas) || 0,
      points: Number(t.points) || 0,
      manual: Number(t.manual) || 0,
      refereed: Number(refereedR.rows[0]?.n) || 0,
      cantos,
    };
  },

  /** The user's latest saved companion games, newest first, with the roster. */
  async recentGames(userId, limit = 10) {
    const r = await db.query(
      `SELECT g.id, g.finished_at, g.mode, g.target, g.totals, g.winner_slot, g.ended_by,
              p.slot, p.won, p.points,
              (SELECT json_agg(json_build_object('name', q.name, 'slot', q.slot, 'position', q.position,
                                                 'me', COALESCE(q.id_user = $1, false))
                               ORDER BY q.position)
                 FROM public.companion_player q WHERE q.game_id = g.id) AS roster
       FROM public.companion_player p
       JOIN public.companion_game g ON g.id = p.game_id
       WHERE p.id_user = $1
       ORDER BY g.finished_at DESC, g.id DESC
       LIMIT $2`,
      [String(userId), limit],
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      at: row.finished_at,
      mode: row.mode,
      target: Number(row.target),
      totals: row.totals || {},
      winnerSlot: Number(row.winner_slot),
      endedBy: row.ended_by,
      mySlot: Number(row.slot),
      won: !!row.won,
      myPoints: Number(row.points) || 0,
      roster: row.roster || [],
    }));
  },

  /**
   * Companion leaderboard (players with an account only). Default = the
   * official ranking (win rate, minimum games — services/ranking.js).
   * @param {Number} limit
   * @param {String} [sort] - ranking.REAL_SORT_KEYS (anything else → win_rate)
   */
  async leaderboard(limit = 25, sort) {
    const order = ranking.realOrderBy(sort);
    // Aggregate first: ORDER BY expressions can't use output aliases.
    const r = await db.query(
      `SELECT * FROM (
         SELECT id_user,
                (ARRAY_AGG(name ORDER BY game_id DESC))[1] AS name,
                COUNT(*)::int AS played,
                COUNT(*) FILTER (WHERE won)::int AS won,
                COALESCE(SUM(caidas), 0)::int AS caidas,
                COALESCE(SUM(mesas), 0)::int AS mesas,
                COALESCE(SUM(points), 0)::int AS points
         FROM public.companion_player
         WHERE id_user IS NOT NULL
         GROUP BY id_user
       ) t
       ORDER BY ${order.sql}
       LIMIT $1`,
      [limit],
    );
    return r.rows.map((row) => ({
      id_user: row.id_user,
      name: row.name,
      played: Number(row.played) || 0,
      won: Number(row.won) || 0,
      caidas: Number(row.caidas) || 0,
      mesas: Number(row.mesas) || 0,
      points: Number(row.points) || 0,
    }));
  },
};
