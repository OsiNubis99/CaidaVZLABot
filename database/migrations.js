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

  // canto sticker file_id cache. Generated alongside the card sticker
  // pack and uploaded by the same bootstrap flow.
  `CREATE TABLE IF NOT EXISTS public.canto_stickers (
     name text PRIMARY KEY,
     file_id text NOT NULL,
     uploaded_at timestamptz DEFAULT CURRENT_TIMESTAMP
   )`,

  // per-group toggle: send a sound clip to the chat every time a
  // caída is detected. Default on so existing groups get the new
  // effect without manual reconfig.
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS audio_effects boolean DEFAULT true`,

  // cache of the caída sound file_id so we send-by-id instead of
  // re-uploading the OGG every time. Single row keyed by 'caida'.
  `CREATE TABLE IF NOT EXISTS public.audio_clips (
     name text PRIMARY KEY,
     file_id text NOT NULL,
     uploaded_at timestamptz DEFAULT CURRENT_TIMESTAMP
   )`,

  // custom emoji pack cache. Each row maps a logical name (e.g.
  // "card-1-Oro" or "canto-Trivilin") to the custom_emoji_id Telegram
  // assigns when the bot creates the emoji set. Used to send messages
  // with inline custom emoji entities — replaces the old sticker flow.
  `CREATE TABLE IF NOT EXISTS public.card_emojis (
     name text PRIMARY KEY,
     custom_emoji_id text NOT NULL,
     set_name text NOT NULL,
     uploaded_at timestamptz DEFAULT CURRENT_TIMESTAMP
   )`,

  // Per-group max game duration in minutes. The reaper cron auto-
  // cancels in-flight games whose started_at exceeds this many
  // minutes ago. Default 120 (2h). Configurable in 30-min steps via
  // /configurar → Sistema.
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS max_game_duration_minutes int DEFAULT 120`,
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
