const {
  isDefaultScoring,
  computeResult,
  matchFactoryPreset,
  rankedStatus,
} = require("../services/gameStats");
const game_modes = require("../lang/game_modes_es");

function clasico(overrides = {}) {
  return { ...game_modes[1], ...overrides };
}

function grupish(overrides = {}) {
  return { ...game_modes[2], ...overrides };
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

  // Regression: picking The Grupish and switching to todos-contra-todos (or
  // 2v2) left the game as "custom" because only Clásico's numbers counted.
  it("true for The Grupish (a factory mode), in any type", () => {
    expect(isDefaultScoring(grupish())).toBe(true);
    expect(isDefaultScoring(grupish({ type: "individual", game_mode: 0 }))).toBe(true);
    expect(isDefaultScoring(grupish({ type: "parejas", game_mode: 0 }))).toBe(true);
    // game_mode 0 ("Modificado") is set by ANY change, even a toggle — ignored.
    expect(isDefaultScoring(clasico({ game_mode: 0, mata_canto: "on" }))).toBe(true);
  });

  it("false for a Grupish with a tweaked canto value", () => {
    expect(isDefaultScoring(grupish({ chiguire: 3 }))).toBe(false);
  });
});

describe("matchFactoryPreset", () => {
  it("names the factory mode whose numbers match", () => {
    expect(matchFactoryPreset(clasico()).name).toBe("Clásico");
    expect(matchFactoryPreset(grupish({ type: "parejas" })).name).toBe("The Grupish");
  });

  it("null for custom scoring or no config", () => {
    expect(matchFactoryPreset(clasico({ ronda: 2 }))).toBeNull();
    expect(matchFactoryPreset(null)).toBeNull();
  });
});

describe("rankedStatus", () => {
  it("ranked with a factory preset and no bots", () => {
    expect(rankedStatus({ config: grupish(), hasBots: false })).toEqual({
      ranked: true,
      reason: null,
      preset: "The Grupish",
    });
  });

  it("bots take precedence as the reason", () => {
    expect(rankedStatus({ config: clasico({ points: 30 }), hasBots: true })).toMatchObject({
      ranked: false,
      reason: "bots",
    });
  });

  it("custom_scoring when the numbers were changed", () => {
    expect(rankedStatus({ config: clasico({ caida: 2 }), hasBots: false })).toEqual({
      ranked: false,
      reason: "custom_scoring",
      preset: null,
    });
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

  it("Grupish + todos contra todos counts as ranked", () => {
    const g = mkGame(
      [mkUser("A"), mkUser("B"), mkUser("C")],
      grupish({ type: "individual", game_mode: 0 }),
    );
    const r = computeResult(g, 2);
    expect(r.ranked).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.preset).toBe("The Grupish");
    expect(entryFor(r, "C").countWin).toBe(true);
  });

  it("records the reason and each entry's scoring slot", () => {
    const g = mkGame(
      [mkUser("A"), mkUser("B"), mkUser("C"), mkUser("D")],
      clasico({ points: 30 }),
      { parejas: true },
    );
    const r = computeResult(g, 1);
    expect(r.reason).toBe("custom_scoring");
    expect(r.entries.map((e) => e.slot)).toEqual([0, 1, 0, 1]);
    expect(r.entries.map((e) => e.won)).toEqual([false, true, false, true]);
  });

  it("entries carry the player's display name (for Mi cuenta → Últimas partidas)", () => {
    const a = { ...mkUser("A"), first_name: "Ana" };
    const x = { ...mkUser("X", { cpu: "pro" }), first_name: "Bot Pro" };
    const r = computeResult(mkGame([a, x]), 0);
    expect(r.entries.map((e) => e.name)).toEqual(["Ana", "Bot Pro"]);
    // No name → null (never the Telegram id).
    expect(computeResult(mkGame([mkUser("B"), mkUser("C")]), 0).entries[0].name).toBeNull();
  });
});
