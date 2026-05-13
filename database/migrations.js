/**
 * Idempotent schema migrations run once on bot startup.
 *
 * Postgres only runs docker-entrypoint-initdb.d scripts on first init
 * (empty volume), so adding columns/tables later requires migrations.
 * Each statement uses IF NOT EXISTS / IF EXISTS so it is safe to rerun.
 */
const db = require("../config/db");
const logger = require("../config/logger");

const STATEMENTS = [
  // visual rendering toggles on group
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS visual_cards boolean DEFAULT true`,
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS visual_table boolean DEFAULT true`,

  // cache of Telegram file_ids per card so we upload each card only once
  `CREATE TABLE IF NOT EXISTS public.cards (
     value int NOT NULL,
     type text NOT NULL,
     file_id text NOT NULL,
     uploaded_at timestamptz DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT pk_cards PRIMARY KEY (value, type)
   )`,

  // persistence for in-flight games (F5)
  `CREATE TABLE IF NOT EXISTS public.game_state (
     id_group varchar(50) PRIMARY KEY,
     state jsonb NOT NULL,
     updated_at timestamptz DEFAULT CURRENT_TIMESTAMP
   )`,

  // opt-in DM-when-it-is-your-turn notification (round 2)
  `ALTER TABLE public.user ADD COLUMN IF NOT EXISTS notify_on_turn boolean DEFAULT false`,

  // round 3: replay/historial — append-only event log per group game.
  `CREATE TABLE IF NOT EXISTS public.game_events (
     id bigserial PRIMARY KEY,
     id_group varchar(50) NOT NULL,
     event_type text NOT NULL,
     payload jsonb NOT NULL,
     created_at timestamptz DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_game_events_group_time
     ON public.game_events (id_group, created_at DESC)`,

  // round 3: per-group locale and turn-timeout (TURBO).
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS locale text DEFAULT 'es'`,
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS turn_timeout_seconds int DEFAULT 0`,
];

async function run() {
  for (const sql of STATEMENTS) {
    try {
      await db.query(sql);
    } catch (err) {
      logger.error({ err: err.message, sql: sql.slice(0, 80) }, "migration failed");
      throw err;
    }
  }
  logger.info({ count: STATEMENTS.length }, "migrations applied");
}

module.exports = { run };
