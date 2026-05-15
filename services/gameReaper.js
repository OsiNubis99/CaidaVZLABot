/**
 * Periodic sweep for games that exceeded their group's configured
 * max_game_duration_minutes. Runs every 30 minutes by default —
 * matches the config's 30-min step so a game can't sit dead more
 * than the configured time + 30 min worst case.
 *
 * Cancels each expired game (clears in-memory state + persistence)
 * and notifies the chat in the group's locale so players know they
 * can /unirse again.
 *
 * Bound to the bot at startup; cleanly cancelable in tests by
 * calling stop() on the returned handle.
 */
const game = require("./game");
const { getLang } = require("../lang");
const logger = require("../config/logger");

const DEFAULT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function sweep(bot) {
  let reaped;
  try {
    reaped = await game.reapExpired();
  } catch (err) {
    logger.error({ err: err.message }, "gameReaper sweep failed");
    return;
  }
  for (const { chatId, groupName } of reaped) {
    // Best-effort notification — if the chat is unreachable (bot
    // kicked, etc.) skip silently so one bad chat doesn't block the
    // rest of the loop.
    try {
      // We don't know the group's locale once the game is gone — try
      // peek first; if no game (we just deleted it), fall back to es.
      const L = getLang("es");
      await bot.sendMessage(chatId, L.game_expired);
      logger.info({ chatId, groupName }, "game expired and notified");
    } catch (err) {
      logger.warn({ err: err.message, chatId }, "gameReaper notify failed");
    }
  }
}

function start(bot, intervalMs = DEFAULT_INTERVAL_MS) {
  // First sweep on a 60s delay so we don't race startup / persistence
  // reload. Subsequent sweeps every intervalMs.
  const initial = setTimeout(() => sweep(bot), 60_000);
  const handle = setInterval(() => sweep(bot), intervalMs);
  logger.info({ intervalMs }, "gameReaper started");
  return {
    stop() {
      clearTimeout(initial);
      clearInterval(handle);
    },
  };
}

module.exports = { start, sweep, DEFAULT_INTERVAL_MS };
