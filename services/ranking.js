/**
 * Top (leaderboards) order. The official ranking is win rate, but only among
 * people with enough games — otherwise a 1-of-1 sits at 100% above everyone.
 * People below the minimum still show, after the ranked ones (also by rate).
 *
 * Sort keys come from the client (?sort=): only these whitelisted keys reach
 * SQL; anything else falls back to the official order. Every clause ends in
 * id_user so ties are deterministic.
 */
const MIN_RANKED_GAMES = 10;

const rate = (won, played) => `${won}::float8 / NULLIF(${played}, 0)`;

/** public.user columns (app stats: groups + WebApp games). */
const APP_SORTS = Object.freeze({
  win_rate: `(finished >= ${MIN_RANKED_GAMES}) DESC, ${rate("win", "finished")} DESC NULLS LAST, win DESC, finished DESC, id_user`,
  win: `win DESC, ${rate("win", "finished")} DESC NULLS LAST, id_user`,
  finished: `finished DESC, win DESC, id_user`,
  beat_pro: `COALESCE(beat_pro, 0) DESC, win DESC, id_user`,
  caida: `caida DESC, finished DESC, id_user`,
  caido: `caido DESC, finished DESC, id_user`,
  // all given, none received = best (∞); nothing either way = last
  caida_ratio: `CASE WHEN caido > 0 THEN caida::float8 / caido WHEN caida > 0 THEN 'Infinity'::float8 END DESC NULLS LAST, caida DESC, id_user`,
});

/** Aggregated companion_player columns (Mesa real — separate ranking). */
const REAL_SORTS = Object.freeze({
  win_rate: `(played >= ${MIN_RANKED_GAMES}) DESC, ${rate("won", "played")} DESC NULLS LAST, won DESC, played DESC, id_user`,
  won: `won DESC, ${rate("won", "played")} DESC NULLS LAST, id_user`,
  played: `played DESC, won DESC, id_user`,
  caidas: `caidas DESC, played DESC, id_user`,
  mesas: `mesas DESC, played DESC, id_user`,
  points: `points DESC, played DESC, id_user`,
});

/** Pair aggregates — `a`, `b` = the two user ids (sorted), games together. */
const PAIR_SORTS = Object.freeze({
  win_rate: `(played >= ${MIN_RANKED_GAMES}) DESC, ${rate("won", "played")} DESC NULLS LAST, won DESC, played DESC, a, b`,
  won: `won DESC, ${rate("won", "played")} DESC NULLS LAST, a, b`,
  played: `played DESC, won DESC, a, b`,
});

function pick(table, sort) {
  const key = typeof sort === "string" && Object.hasOwn(table, sort) ? sort : "win_rate";
  return { sort: key, sql: table[key] };
}

module.exports = {
  MIN_RANKED_GAMES,
  APP_SORT_KEYS: Object.keys(APP_SORTS),
  REAL_SORT_KEYS: Object.keys(REAL_SORTS),
  /** @returns {{sort:string, sql:string}} ORDER BY body for public.user */
  appOrderBy: (sort) => pick(APP_SORTS, sort),
  /** @returns {{sort:string, sql:string}} ORDER BY body for the companion aggregate */
  realOrderBy: (sort) => pick(REAL_SORTS, sort),
  PAIR_SORT_KEYS: Object.keys(PAIR_SORTS),
  /** @returns {{sort:string, sql:string}} ORDER BY body for a pair aggregate (a, b, played, won) */
  pairOrderBy: (sort) => pick(PAIR_SORTS, sort),
  /** Enough games to be in the official (win-rate) ranking. */
  qualifies: (games) => (Number(games) || 0) >= MIN_RANKED_GAMES,
};
