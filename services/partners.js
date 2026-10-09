/**
 * "🤝 Parejas": who you win with. Pure helpers (no DB):
 *  - appGameRecord: what the app stores per finished game (database/appGames),
 *    from the gameStats summary — the roster with seats, scoring slots and
 *    bot flags. Partners = same game, same slot.
 *  - summarizePartners: a person's partner list (one row per partner, from
 *    either system — app or Mesa real, never mixed) → rates, the difference
 *    with their own 2v2 average, who they play with most and their best
 *    partner (minimum games, so a 2-of-2 isn't "100%").
 */
const MIN_PARTNER_GAMES = 5;

/** "parejas" when two players share a scoring slot (a team). */
function gameMode(entries) {
  const seen = new Set();
  for (const e of entries || []) {
    if (seen.has(e.slot)) return "parejas";
    seen.add(e.slot);
  }
  return "individual";
}

/**
 * gameStats.computeResult summary → the app_game record, or null when there's
 * no roster to keep (payloads from before `slot` can't tell partners apart).
 */
function appGameRecord(summary) {
  const entries = summary && Array.isArray(summary.entries) ? summary.entries : [];
  if (entries.length === 0 || !entries.every((e) => e && Number.isInteger(e.slot))) return null;
  return {
    ranked: !!summary.ranked,
    preset: summary.preset || null,
    mode: gameMode(entries),
    winnerSlot: Number.isInteger(summary.winnerSlot) ? summary.winnerSlot : null,
    players: entries.map((e, seat) => ({
      seat,
      userId: String(e.statsId),
      name: e.name || null,
      bot: !!e.isBot,
      slot: e.slot,
      won: !!e.won,
    })),
  };
}

const pct = (won, played) => (played > 0 ? Math.round((won / played) * 100) : null);

/**
 * @param {{key:string, name:string, guest?:boolean, played:number, won:number}[]} rows
 *   one per partner (games together, games won together)
 * @returns {{minGames:number, played:number, won:number, rate:(number|null),
 *   rows:Object[], mostPlayed:(Object|null), best:(Object|null)}}
 *   `rate` = your 2v2 win %; per row `delta` = points over/under it (null
 *   below the minimum).
 */
function summarizePartners(rows, { minGames = MIN_PARTNER_GAMES } = {}) {
  const list = (rows || []).map((r) => ({
    ...r,
    played: Number(r.played) || 0,
    won: Number(r.won) || 0,
  }));
  const played = list.reduce((a, r) => a + r.played, 0);
  const won = list.reduce((a, r) => a + r.won, 0);
  const base = played > 0 ? won / played : null;

  const out = list
    .map((r) => {
      const enough = r.played >= minGames;
      return {
        ...r,
        lost: r.played - r.won,
        rate: pct(r.won, r.played),
        delta:
          enough && base != null && r.played > 0
            ? Math.round((r.won / r.played - base) * 100)
            : null,
        enough,
      };
    })
    .sort(
      (a, b) =>
        b.played - a.played ||
        b.won - a.won ||
        String(a.name || "").localeCompare(String(b.name || "")),
    );

  const best =
    out
      .filter((r) => r.enough)
      .sort((a, b) => b.won / b.played - a.won / a.played || b.played - a.played)[0] || null;

  return {
    minGames,
    played,
    won,
    rate: pct(won, played),
    rows: out,
    mostPlayed: out[0] || null,
    best,
  };
}

module.exports = { MIN_PARTNER_GAMES, gameMode, appGameRecord, summarizePartners };
