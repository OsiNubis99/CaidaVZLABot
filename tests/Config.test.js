const { describe, it, expect } = require("vitest");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");
const resp = require("../lang/es");

describe("Config", () => {
  it("loads classic mode (game_mode=1)", () => {
    const c = new Config(game_modes[1]);
    expect(c.points).toBe(24);
    expect(c.type).toBe("individual");
    expect(c.mata_canto).toBe("off");
  });

  it("loads The Grupish mode (game_mode=2)", () => {
    const c = new Config(game_modes[2]);
    expect(c.type).toBe("parejas");
    expect(c.mata_canto).toBe("on");
    expect(c.chiguire).toBe(5);
  });

  it("defaults visual flags to true when row omits them", () => {
    const c = new Config(game_modes[1]);
    expect(c.visual_cards).toBe(true);
    expect(c.visual_table).toBe(true);
  });

  it("respects visual_cards=false from a group row", () => {
    const c = new Config({ ...game_modes[1], visual_cards: false });
    expect(c.visual_cards).toBe(false);
  });

  it("rejects caida_continua and mata_mesa as not implemented", () => {
    const c = new Config(game_modes[1]);
    expect(c.is_not_ok("caida_continua", "on")).toBe(resp.config_not_implemented);
    expect(c.is_not_ok("mata_mesa", "on")).toBe(resp.config_not_implemented);
  });

  it("accepts visual_cards on/off", () => {
    const c = new Config(game_modes[1]);
    expect(c.is_not_ok("visual_cards", "on")).toBe(false);
    expect(c.visual_cards).toBe(true);
    expect(c.is_not_ok("visual_cards", "off")).toBe(false);
    expect(c.visual_cards).toBe(false);
  });

  it("accepts numeric points within range", () => {
    const c = new Config(game_modes[1]);
    expect(c.is_not_ok("points", 50)).toBe(false);
    expect(c.points).toBe(50);
  });

  it("rejects out-of-range points", () => {
    const c = new Config(game_modes[1]);
    expect(c.is_not_ok("points", 999)).toBe(resp.config_number_invalid);
  });

  it("rejects unknown config key", () => {
    const c = new Config(game_modes[1]);
    expect(c.is_not_ok("nonexistent", 1)).toBe(resp.config_undefined);
  });
});
