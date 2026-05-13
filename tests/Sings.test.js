const Card = require("../class/Card");
const Sings = require("../class/Sings");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

// Use the "The Grupish" mode (index 2) which has non-zero values for all cantos.
const config = new Config(game_modes[2]);

function cardOf(value, type) {
  const valueToIndex = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 10: 7, 11: 8, 12: 9 };
  const typeToIndex = { Oro: 0, Espada: 1, Copa: 2, Basto: 3 };
  const number = valueToIndex[value] * 4 + typeToIndex[type];
  return new Card(number);
}

describe("Sings", () => {
  it("detects Trivilin: three of the same value", () => {
    const cards = [cardOf(7, "Oro"), cardOf(7, "Espada"), cardOf(7, "Copa")];
    const s = new Sings(cards, config);
    expect(s.name).toBe("Trivilin");
    expect(s.value).toBe(config.trivilin);
  });

  it("detects Casa Grande: 12-12-1", () => {
    const cards = [cardOf(12, "Oro"), cardOf(12, "Espada"), cardOf(1, "Copa")];
    const s = new Sings(cards, config);
    expect(s.name).toBe("Casa Grande");
  });

  it("detects Casa Chica: 11-11-1", () => {
    const cards = [cardOf(11, "Oro"), cardOf(11, "Espada"), cardOf(1, "Copa")];
    const s = new Sings(cards, config);
    expect(s.name).toBe("Casa Chica");
  });

  it("detects Registrico: 11-10-1", () => {
    const cards = [cardOf(11, "Oro"), cardOf(10, "Espada"), cardOf(1, "Copa")];
    const s = new Sings(cards, config);
    expect(s.name).toBe("Registrico");
  });

  it("detects Maguaro: 12-10-1", () => {
    const cards = [cardOf(12, "Oro"), cardOf(10, "Espada"), cardOf(1, "Copa")];
    const s = new Sings(cards, config);
    expect(s.name).toBe("Maguaro");
  });

  it("detects Registro: 12-11-1", () => {
    const cards = [cardOf(12, "Oro"), cardOf(11, "Espada"), cardOf(1, "Copa")];
    const s = new Sings(cards, config);
    expect(s.name).toBe("Registro");
  });

  it("returns 'No cantó' when nothing matches", () => {
    const cards = [cardOf(1, "Oro"), cardOf(2, "Espada"), cardOf(5, "Copa")];
    const s = new Sings(cards, config);
    expect(s.name).toBe("No cantó");
    expect(s.value).toBe(0);
  });

  it("starts inactive", () => {
    const cards = [cardOf(7, "Oro"), cardOf(7, "Espada"), cardOf(7, "Copa")];
    const s = new Sings(cards, config);
    expect(s.active).toBe(false);
  });
});
