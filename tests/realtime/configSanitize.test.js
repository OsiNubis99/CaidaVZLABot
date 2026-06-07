const { sanitizeConfig } = require("../../services/realtime/configSanitize");
const GameSession = require("../../services/realtime/GameSession");

describe("sanitizeConfig", () => {
  it("returns an empty object for garbage input", () => {
    expect(sanitizeConfig(null)).toEqual({});
    expect(sanitizeConfig(undefined)).toEqual({});
    expect(sanitizeConfig("nope")).toEqual({});
    expect(sanitizeConfig(42)).toEqual({});
  });

  it("keeps valid in-range fields and rounds numbers", () => {
    const out = sanitizeConfig({
      points: 30,
      mesa: 5,
      type: "parejas",
      mata_canto: "on",
      caida: 2.7,
    });
    expect(out.points).toBe(30);
    expect(out.mesa).toBe(5);
    expect(out.type).toBe("parejas");
    expect(out.mata_canto).toBe("on");
    expect(out.caida).toBe(3); // rounded
  });

  it("clamps out-of-range numbers to the allowed bounds", () => {
    const out = sanitizeConfig({ points: 9999, mesa: -3, caida: 50, trivilin: 1000 });
    expect(out.points).toBe(100);
    expect(out.mesa).toBe(0);
    expect(out.caida).toBe(10);
    expect(out.trivilin).toBe(100);
  });

  it("drops unknown keys and invalid enums", () => {
    const out = sanitizeConfig({
      type: "solo", // invalid
      mata_canto: "maybe", // invalid
      hack: "rm -rf", // unknown
      points: 20,
    });
    expect(out).toEqual({ points: 20 });
  });

  it("ignores non-numeric values", () => {
    expect(sanitizeConfig({ points: "abc" })).toEqual({});
  });
});

describe("GameSession config normalization", () => {
  it("merges a partial config over Clásico defaults", () => {
    const s = new GameSession({
      code: "T1",
      host: { userId: 1, name: "h" },
      config: { points: 30, mata_canto: "on" },
    });
    expect(s.config.points).toBe(30); // overridden
    expect(s.config.mata_canto).toBe("on"); // overridden
    expect(s.config.mesa).toBe(4); // Clásico default preserved
    expect(s.config.trivilin).toBe(24); // Clásico default preserved
    expect(s.config.game_mode).toBe(1);
  });

  it("falls back to Clásico when no config is given", () => {
    const s = new GameSession({ code: "T2", host: { userId: 1, name: "h" } });
    expect(s.config.points).toBe(24);
    expect(s.config.type).toBe("individual");
  });
});
