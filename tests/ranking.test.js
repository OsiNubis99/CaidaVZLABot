const ranking = require("../services/ranking");
const { renderTop } = require("../services/leaderboard");

describe("ranking (Top order)", () => {
  it("the official order is win rate, people with enough games first", () => {
    const app = ranking.appOrderBy();
    expect(app.sort).toBe("win_rate");
    expect(ranking.MIN_RANKED_GAMES).toBe(10);
    expect(app.sql).toMatch(/^\(finished >= 10\) DESC, /);
    expect(ranking.realOrderBy().sql).toMatch(/^\(played >= 10\) DESC, /);
  });

  it("only whitelisted columns; anything else falls back to the official order", () => {
    for (const bad of ["", "nope", "win; DROP TABLE public.user", null, undefined, 42]) {
      expect(ranking.appOrderBy(bad).sort).toBe("win_rate");
      expect(ranking.realOrderBy(bad).sort).toBe("win_rate");
    }
    expect(ranking.appOrderBy("finished").sort).toBe("finished");
    expect(ranking.realOrderBy("points").sort).toBe("points");
    expect(ranking.appOrderBy("points").sort).toBe("win_rate"); // real-table column
  });

  it("every sort ends with a deterministic tie-break", () => {
    for (const key of ranking.APP_SORT_KEYS) {
      expect(ranking.appOrderBy(key).sql).toMatch(/id_user( ASC)?$/);
    }
    for (const key of ranking.REAL_SORT_KEYS) {
      expect(ranking.realOrderBy(key).sql).toMatch(/id_user( ASC)?$/);
    }
  });

  it("knows who's in the official ranking", () => {
    expect(ranking.qualifies(10)).toBe(true);
    expect(ranking.qualifies(9)).toBe(false);
  });

  it("pairs: official = win rate with ≥10 games together; only pair columns", () => {
    expect(ranking.pairOrderBy().sort).toBe("win_rate");
    expect(ranking.pairOrderBy().sql).toMatch(/^\(played >= 10\) DESC, /);
    expect(ranking.pairOrderBy("won").sort).toBe("won");
    expect(ranking.pairOrderBy("played").sort).toBe("played");
    for (const bad of ["points", "caida", "won; DROP TABLE x", undefined]) {
      expect(ranking.pairOrderBy(bad).sort).toBe("win_rate");
    }
    for (const key of ranking.PAIR_SORT_KEYS) {
      expect(ranking.pairOrderBy(key).sql).toMatch(/, a, b$/);
    }
  });
});

describe("/top message", () => {
  const u = (first_name, win, finished, extra = {}) => ({
    first_name,
    username: null,
    win,
    finished,
    beat_pro: 0,
    ...extra,
  });

  it("ranks by win rate and separates the people with too few games", () => {
    const text = renderTop([u("Ana", 8, 10), u("Beto", 9, 20), u("Caro", 2, 2), u("Dani", 1, 4)]);
    const lines = text.split("\n");
    expect(lines[0]).toMatch(/Top jugadores/);
    expect(text).toMatch(/% de victorias/);
    const ana = lines.findIndex((l) => l.includes("Ana"));
    const divider = lines.findIndex((l) => /menos de 10 partidas/.test(l));
    const caro = lines.findIndex((l) => l.includes("Caro"));
    expect(ana).toBeLessThan(divider);
    expect(divider).toBeLessThan(caro);
    expect(lines[ana]).toMatch(/^1\. Ana — 80% · 8 ganados · 10 partidas/);
    expect(lines[caro]).toMatch(/^· Caro — 100%/); // no rank number below the line
  });

  it("no divider when everyone qualifies; empty state", () => {
    expect(renderTop([u("Ana", 8, 10)])).not.toMatch(/menos de/);
    expect(renderTop([])).toMatch(/Aún no hay jugadores/);
  });
});
