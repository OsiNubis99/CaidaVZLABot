/**
 * Game state persistence (F5).
 *
 * In-flight Game objects are serialized to public.game_state (JSONB) after
 * every mutation so the bot can resume mid-deck after a restart or
 * deploy. On startup, all rows are loaded back into the in-memory map.
 *
 * Pure (de)serialization lives in services/gameSerialize.js — that
 * module has no DB dependency so it can be imported by unit tests.
 */
const db = require("../config/db");
const logger = require("../config/logger");
const { serialize, deserialize } = require("./gameSerialize");

async function save(id_group, game) {
  const state = serialize(game);
  await db.query(
    `INSERT INTO public.game_state (id_group, state, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (id_group) DO UPDATE SET state = EXCLUDED.state, updated_at = CURRENT_TIMESTAMP`,
    [id_group, state],
  );
}

async function remove(id_group) {
  await db.query("DELETE FROM public.game_state WHERE id_group = $1", [id_group]);
}

async function loadAll() {
  const r = await db.query("SELECT id_group, state FROM public.game_state");
  const games = {};
  const users = {};
  for (const row of r.rows) {
    try {
      const game = deserialize(row.state);
      games[row.id_group] = game;
      for (const u of game.users) {
        users[u.id_user] = row.id_group;
      }
    } catch (err) {
      logger.error({ err: err.message, id_group: row.id_group }, "failed to deserialize game");
    }
  }
  logger.info({ count: r.rows.length }, "loaded games from db");
  return { games, users };
}

module.exports = { serialize, deserialize, save, remove, loadAll };
