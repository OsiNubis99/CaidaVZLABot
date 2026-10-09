const partners = require("../services/partners");
const { summarizePartners, gameMode, appGameRecord, MIN_PARTNER_GAMES } = partners;

const row = (key, name, played, won, extra = {}) => ({
  key,
  name,
  guest: false,
  played,
  won,
  ...extra,
});

describe("gameMode", () => {
  it("parejas when two players share a scoring slot, individual otherwise", () => {
    expect(gameMode([{ slot: 0 }, { slot: 1 }, { slot: 0 }, { slot: 1 }])).toBe("parejas");
    expect(gameMode([{ slot: 0 }, { slot: 1 }, { slot: 2 }])).toBe("individual");
    expect(gameMode([])).toBe("individual");
  });
});

describe("appGameRecord (what the app keeps per finished game)", () => {
  const summary = {
    ranked: true,
    preset: "Clásico",
    winnerSlot: 1,
    entries: [
      { statsId: "10", name: "Ana", isBot: false, slot: 0, won: false },
      { statsId: "20", name: "Beto", isBot: false, slot: 1, won: true },
      { statsId: "30", name: "Caro", isBot: false, slot: 0, won: false },
      { statsId: "40", name: "Dani", isBot: false, slot: 1, won: true },
    ],
  };

  it("one row per seat, in seat order, with the game's mode", () => {
    const rec = appGameRecord(summary);
    expect(rec).toMatchObject({ ranked: true, preset: "Clásico", mode: "parejas", winnerSlot: 1 });
    expect(rec.players).toEqual([
      { seat: 0, userId: "10", name: "Ana", bot: false, slot: 0, won: false },
      { seat: 1, userId: "20", name: "Beto", bot: false, slot: 1, won: true },
      { seat: 2, userId: "30", name: "Caro", bot: false, slot: 0, won: false },
      { seat: 3, userId: "40", name: "Dani", bot: false, slot: 1, won: true },
    ]);
  });

  it("keeps bots flagged; nothing to store without a roster or slots", () => {
    const vsBot = appGameRecord({
      ranked: false,
      winnerSlot: 0,
      entries: [
        { statsId: "10", name: "Ana", isBot: false, slot: 0, won: true },
        { statsId: "cpu_pro", name: null, isBot: true, slot: 1, won: false },
      ],
    });
    expect(vsBot.mode).toBe("individual");
    expect(vsBot.players[1]).toMatchObject({ userId: "cpu_pro", bot: true, name: null });
    expect(appGameRecord(null)).toBeNull();
    expect(appGameRecord({ ranked: true, entries: [] })).toBeNull();
    // payloads from before `slot` existed can't tell partners apart
    expect(appGameRecord({ ranked: true, entries: [{ statsId: "10", won: true }] })).toBeNull();
  });
});

describe("summarizePartners (🤝 Mis parejas)", () => {
  it("your 2v2 average is over every game with a partner; ± only with enough games", () => {
    const s = summarizePartners([row("b", "B", 20, 14), row("c", "C", 5, 1), row("d", "D", 2, 2)]);
    expect(s).toMatchObject({ minGames: MIN_PARTNER_GAMES, played: 27, won: 17, rate: 63 });
    expect(MIN_PARTNER_GAMES).toBe(5);
    const by = (k) => s.rows.find((r) => r.key === k);
    // 70% with B vs 62.96% overall → +7; 20% with C → −43
    expect(by("b")).toMatchObject({
      played: 20,
      won: 14,
      lost: 6,
      rate: 70,
      delta: 7,
      enough: true,
    });
    expect(by("c")).toMatchObject({ rate: 20, delta: -43, enough: true });
    // 2 of 2 is not "100% with D": too few games for a verdict
    expect(by("d")).toMatchObject({ rate: 100, delta: null, enough: false });
  });

  it("most played (ties → more wins) and the best partner (≥ minimum, best rate, ties → more games)", () => {
    const s = summarizePartners([
      row("e", "E", 10, 7),
      row("f", "F", 20, 14),
      row("g", "G", 3, 3),
      row("h", "H", 20, 15),
    ]);
    expect(s.mostPlayed.key).toBe("h"); // 20 games each with F and H; more wins with H
    expect(s.best.key).toBe("h"); // 75% beats 70%; G's 3/3 doesn't count
    const tie = summarizePartners([row("e", "E", 10, 7), row("f", "F", 20, 14)]);
    expect(tie.best.key).toBe("f"); // same 70%: the longer partnership wins
  });

  it("rows by games together, then wins, then name", () => {
    const s = summarizePartners([
      row("x", "Zoe", 5, 1),
      row("y", "Ana", 5, 1),
      row("z", "Bea", 9, 2),
    ]);
    expect(s.rows.map((r) => r.name)).toEqual(["Bea", "Ana", "Zoe"]);
  });

  it("no best partner until someone reaches the minimum; empty list", () => {
    const few = summarizePartners([row("a", "A", 4, 4)]);
    expect(few.best).toBeNull();
    expect(few.mostPlayed.key).toBe("a");
    expect(summarizePartners([])).toMatchObject({
      played: 0,
      won: 0,
      rate: null,
      rows: [],
      mostPlayed: null,
      best: null,
    });
  });
});
