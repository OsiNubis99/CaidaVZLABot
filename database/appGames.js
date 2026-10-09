/**
 * App games (Telegram groups + WebApp tables): one row per finished game with
 * its roster (public.app_game + app_game_player), written fire-and-forget by
 * services/gameStats.recordResult. Kept for good — unlike game_events — so
 * per-game stats like "🤝 Parejas" have history. Never mixed with the
 * Acompañante (companion_*).
 *
 * Partners = same game, same scoring slot. Pair stats count RANKED games only
 * (no CPUs, factory scoring), the same rule as "Ganados".
 */
const db = require("../config/db");
const ranking = require("../services/ranking");

module.exports = {
  /**
   * Save one finished game (services/partners.appGameRecord) in a transaction.
   * @returns {Promise<number>} the app_game id
   */
  async insertGame(rec) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const g = await client.query(
        `INSERT INTO public.app_game (ranked, preset, mode, winner_slot)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [rec.ranked, rec.preset, rec.mode, rec.winnerSlot],
      );
      const id = g.rows[0].id;
      for (const p of rec.players) {
        await client.query(
          `INSERT INTO public.app_game_player (game_id, seat, id_user, name, bot, slot, won)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, p.seat, p.userId, p.name, p.bot, p.slot, p.won],
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
   * One row per partner of `userId` in ranked games: games together and won
   * together (services/partners.summarizePartners input).
   */
  async partnersOf(userId, limit = 50) {
    const r = await db.query(
      `SELECT q.id_user AS key,
              (ARRAY_AGG(q.name ORDER BY g.id DESC))[1] AS game_name,
              u.first_name, u.username,
              COUNT(*)::int AS played,
              COUNT(*) FILTER (WHERE p.won)::int AS won
       FROM public.app_game_player p
       JOIN public.app_game g ON g.id = p.game_id AND g.ranked
       JOIN public.app_game_player q
         ON q.game_id = p.game_id AND q.slot = p.slot AND q.seat <> p.seat AND NOT q.bot
       LEFT JOIN public.user u ON u.id_user = q.id_user
       WHERE p.id_user = $1
       GROUP BY q.id_user, u.first_name, u.username
       ORDER BY played DESC, won DESC, q.id_user
       LIMIT $2`,
      [String(userId), limit],
    );
    return r.rows.map((row) => ({
      key: row.key,
      name: row.first_name || row.game_name || "?",
      username: row.username || null,
      guest: false,
      played: Number(row.played) || 0,
      won: Number(row.won) || 0,
    }));
  },

  /**
   * Top pairs of the app (ranked games). Default = the official order: win
   * rate with a minimum of games together (services/ranking.js).
   * @param {Number} limit
   * @param {String} [sort] - ranking.PAIR_SORT_KEYS (anything else → win_rate)
   */
  async pairLeaderboard(limit = 25, sort) {
    const order = ranking.pairOrderBy(sort);
    const r = await db.query(
      `SELECT t.*, ua.first_name AS a_first, ua.username AS a_username,
              ub.first_name AS b_first, ub.username AS b_username
       FROM (
         SELECT LEAST(p.id_user, q.id_user) AS a, GREATEST(p.id_user, q.id_user) AS b,
                (ARRAY_AGG(CASE WHEN p.id_user < q.id_user THEN p.name ELSE q.name END
                           ORDER BY p.game_id DESC))[1] AS a_name,
                (ARRAY_AGG(CASE WHEN p.id_user < q.id_user THEN q.name ELSE p.name END
                           ORDER BY p.game_id DESC))[1] AS b_name,
                COUNT(*)::int AS played,
                COUNT(*) FILTER (WHERE p.won)::int AS won
         FROM public.app_game_player p
         JOIN public.app_game_player q
           ON q.game_id = p.game_id AND q.slot = p.slot AND q.seat > p.seat
         JOIN public.app_game g ON g.id = p.game_id AND g.ranked
         WHERE NOT p.bot AND NOT q.bot
         GROUP BY 1, 2
       ) t
       LEFT JOIN public.user ua ON ua.id_user = t.a
       LEFT JOIN public.user ub ON ub.id_user = t.b
       WHERE COALESCE(ua.is_banned, false) = false AND COALESCE(ub.is_banned, false) = false
       ORDER BY ${order.sql}
       LIMIT $1`,
      [limit],
    );
    return r.rows.map((row) => ({
      a: { id: row.a, name: row.a_first || row.a_name || "?", username: row.a_username || null },
      b: { id: row.b, name: row.b_first || row.b_name || "?", username: row.b_username || null },
      played: Number(row.played) || 0,
      won: Number(row.won) || 0,
    }));
  },
};
