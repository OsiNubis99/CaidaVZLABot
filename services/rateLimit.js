/**
 * Per-user, per-command sliding-window rate limit. In-memory only —
 * limits are reset on restart, which is fine for spam-prevention scope.
 */

const buckets = new Map();

/**
 * @param {String|Number} userId
 * @param {String} command - logical command name (e.g. "/unirse").
 * @param {Object} opts
 * @param {Number} opts.windowMs
 * @param {Number} opts.max - max requests in window
 * @returns {{ allowed: boolean, retryInSec?: number }}
 */
function check(userId, command, { windowMs = 10_000, max = 5 } = {}) {
  const key = `${userId}|${command}`;
  const now = Date.now();
  const arr = buckets.get(key) || [];
  // drop stale timestamps
  const fresh = arr.filter((t) => now - t < windowMs);
  if (fresh.length >= max) {
    const retryInSec = Math.ceil((windowMs - (now - fresh[0])) / 1000);
    buckets.set(key, fresh);
    return { allowed: false, retryInSec };
  }
  fresh.push(now);
  buckets.set(key, fresh);
  // opportunistic cleanup if Map grows too large
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
    }
  }
  return { allowed: true };
}

function reset() {
  buckets.clear();
}

module.exports = { check, reset };
