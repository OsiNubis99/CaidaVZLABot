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

  // shareable link for public groups, resolved + cached on /unirse (public
  // @username link, or a bot-admin invite link).
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS invite_link text`,

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

  // Supporting index for the /top leaderboard query. Without it the
  // hot path is a seq-scan + sort on public.user every call. Filter
  // matches the WHERE clause shape so the index covers it.
  `CREATE INDEX IF NOT EXISTS idx_user_leaderboard
     ON public.user (win DESC, win_custom DESC, finished DESC)
     WHERE finished > 0 AND COALESCE(is_banned, false) = false`,

  // Liberation: groups auto-register on first /unirse. Admin retains
  // a ban switch so we can boot bad actors. games_played feeds the
  // "sort by most active" option in /admin list.
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false`,
  `ALTER TABLE public.group ADD COLUMN IF NOT EXISTS games_played int DEFAULT 0`,

  // Seed CPU users. Bots are in-memory objects per-lobby but they roll
  // up stats into 3 shared rows (one per difficulty) so they show in
  // the leaderboard, in the admin user list, and accumulate caída /
  // sing counters globally. The synthetic in-memory id stays
  // cpu_<chatId>_<slot> for lobby isolation; only the persistence
  // writes route to these three rows via User.statsId().
  `INSERT INTO public.user (id_user, first_name, last_name, username, is_banned)
   VALUES ('cpu_easy',   '🤖 CPU Fácil', '', NULL, false),
          ('cpu_medium', '🤖 CPU Medio', '', NULL, false),
          ('cpu_pro',    '🤖 CPU Pro',   '', NULL, false)
   ON CONFLICT (id_user) DO NOTHING`,

  // Stats redesign: "le ganó al PRO" achievement counter.
  `ALTER TABLE public.user ADD COLUMN IF NOT EXISTS beat_pro int DEFAULT 0`,

  // One-shot data migrations, guarded by a marker row so they run exactly once
  // (migrations run on every boot).
  `CREATE TABLE IF NOT EXISTS public.schema_meta (
     key text PRIMARY KEY,
     applied_at timestamptz DEFAULT now()
   )`,
  // Reset `win` to 0 once: the column now means "ganados" (ranked only), but
  // historical values were accumulated under the old preset/custom rule.
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM public.schema_meta WHERE key = 'win_reset_v1') THEN
       UPDATE public.user SET win = 0;
       INSERT INTO public.schema_meta(key) VALUES ('win_reset_v1');
     END IF;
   END $$`,
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
