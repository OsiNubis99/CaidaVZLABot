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
    expect(c.type).toBe("individual");
    expect(c.mata_canto).toBe("on");
    expect(c.caida_continua).toBe("on");
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

  it("accepts caida_continua and mata_mesa as on/off", () => {
    const c = new Config(game_modes[1]);
    expect(c.is_not_ok("caida_continua", "on")).toBe(false);
    expect(c.caida_continua).toBe("on");
    expect(c.is_not_ok("mata_mesa", "off")).toBe(false);
    expect(c.mata_mesa).toBe("off");
    expect(c.is_not_ok("caida_continua", "bad")).toBe(resp.config_bool_invalid);
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

// 2v2 / individual (`type`) is a table choice that goes with any preset: it
// must never turn a preset into "Modificado", and picking a preset keeps it.
describe("Config preset vs type (individual / parejas)", () => {
  it("changing the type keeps the preset", () => {
    const c = new Config(game_modes[2]);
    expect(c.is_not_ok("type", "parejas")).toBe(false);
    expect(c.type).toBe("parejas");
    expect(c.game_mode).toBe(2);
    expect(c.get_game_mode()).toContain("The Grupish");
  });

  it("choosing a preset keeps the type", () => {
    const c = new Config(game_modes[1]);
    c.is_not_ok("type", "parejas");
    c.set_game_mode(2);
    expect(c.game_mode).toBe(2);
    expect(c.type).toBe("parejas");
    expect(c.chiguire).toBe(5);
  });

  it("a group saved as Modificado only because of its type loads as its preset", () => {
    // What the old code stored after switching The Grupish to parejas.
    const c = new Config({ ...game_modes[2], game_mode: 0, type: "parejas" });
    expect(c.game_mode).toBe(2);
    expect(c.type).toBe("parejas");
  });

  it("changing a rule or a value still makes it Modificado", () => {
    const toggled = new Config(game_modes[2]);
    toggled.is_not_ok("mata_canto", "off");
    expect(toggled.game_mode).toBe(0);
    const scored = new Config(game_modes[2]);
    scored.is_not_ok("points", 30);
    expect(scored.game_mode).toBe(0);
    expect(new Config({ ...game_modes[2], game_mode: 0, points: 30 }).game_mode).toBe(0);
  });

  it("putting the values back shows the preset again", () => {
    const c = new Config(game_modes[2]);
    c.is_not_ok("points", 30);
    c.is_not_ok("points", 24);
    expect(c.game_mode).toBe(2);
  });
});
