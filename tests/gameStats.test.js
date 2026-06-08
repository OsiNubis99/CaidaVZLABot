const { isDefaultScoring, computeResult } = require("../services/gameStats");
const game_modes = require("../lang/game_modes_es");

function clasico(overrides = {}) {
  return { ...game_modes[1], ...overrides };
}

function mkUser(id, { cpu = null, caida = 0, caido = 0 } = {}) {
  return {
    id_user: id,
    cpu_difficulty: cpu,
    caida,
    caido,
    statsId() {
      return this.cpu_difficulty ? "cpu_" + this.cpu_difficulty : this.id_user;
    },
  };
}

function mkGame(users, config = clasico(), { parejas = false } = {}) {
  return {
    users,
    config,
    scoringSlot(i) {
      return parejas ? i % 2 : i;
    },
  };
}

const entryFor = (summary, statsId) =>
  summary.entries.find((e) => e.statsId === statsId);

describe("isDefaultScoring", () => {
  it("true for the Clásico preset", () => {
    expect(isDefaultScoring(clasico())).toBe(true);
  });

  it("false when a numeric scoring value changes", () => {
    expect(isDefaultScoring(clasico({ points: 30 }))).toBe(false);
    expect(isDefaultScoring(clasico({ trivilin: 20 }))).toBe(false);
    expect(isDefaultScoring(clasico({ caida: 2 }))).toBe(false);
    expect(isDefaultScoring(clasico({ mesa: 5 }))).toBe(false);
  });

  it("ignores on/off toggles and type", () => {
    expect(
      isDefaultScoring(
        clasico({ mata_canto: "on", caida_continua: "on", mata_mesa: "on", type: "parejas" }),
      ),
    ).toBe(true);
  });
});

describe("computeResult", () => {
  it("ranked: two humans, default scoring → only the winner's win counts", () => {
    const g = mkGame([mkUser("A"), mkUser("B")]);
    const r = computeResult(g, 0);
    expect(r.ranked).toBe(true);
    expect(entryFor(r, "A").countWin).toBe(true);
    expect(entryFor(r, "B").countWin).toBe(false);
    expect(r.beatProUserId).toBe(null);
  });

  it("not ranked when scoring is non-default → human win does not count", () => {
    const g = mkGame([mkUser("A"), mkUser("B")], clasico({ points: 30 }));
    const r = computeResult(g, 0);
    expect(r.ranked).toBe(false);
    expect(entryFor(r, "A").countWin).toBe(false);
  });

  it("not ranked when a bot is present → human win does not count", () => {
    const g = mkGame([mkUser("A"), mkUser("X", { cpu: "medium" })]);
    const r = computeResult(g, 0); // human A wins
    expect(r.ranked).toBe(false);
    expect(entryFor(r, "A").countWin).toBe(false);
  });

  it("a bot's win always counts (for win rate), even vs a human", () => {
    const g = mkGame([mkUser("A"), mkUser("X", { cpu: "easy" })]);
    const r = computeResult(g, 1); // the bot wins
    expect(entryFor(r, "cpu_easy").countWin).toBe(true);
    expect(entryFor(r, "A").countWin).toBe(false);
  });

  it("1v1 vs cpu_pro: human wins → beat_pro for that human", () => {
    const g = mkGame([mkUser("A"), mkUser("X", { cpu: "pro" })]);
    const r = computeResult(g, 0); // human wins
    expect(r.beatProUserId).toBe("A");
    // not ranked (bot present), so the human's win does NOT count
    expect(entryFor(r, "A").countWin).toBe(false);
  });

  it("1v1 vs cpu_pro: the PRO wins → no achievement, bot win counts", () => {
    const g = mkGame([mkUser("A"), mkUser("X", { cpu: "pro" })]);
    const r = computeResult(g, 1); // pro wins
    expect(r.beatProUserId).toBe(null);
    expect(entryFor(r, "cpu_pro").countWin).toBe(true);
  });

  it("beating a non-pro bot in 1v1 is not the PRO achievement", () => {
    const g = mkGame([mkUser("A"), mkUser("X", { cpu: "medium" })]);
    expect(computeResult(g, 0).beatProUserId).toBe(null);
  });

  it("beating a PRO in a 3-player game is not the achievement (only 1v1)", () => {
    const g = mkGame([mkUser("A"), mkUser("B"), mkUser("X", { cpu: "pro" })]);
    expect(computeResult(g, 0).beatProUserId).toBe(null);
  });

  it("always increments finished (every entry present)", () => {
    const g = mkGame([mkUser("A"), mkUser("X", { cpu: "pro" })]);
    const r = computeResult(g, 0);
    expect(r.entries.length).toBe(2);
  });
});
