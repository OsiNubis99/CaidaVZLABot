// Verify Game.print() actually localises via the group's config.locale.
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

function mk(locale) {
  const cfg = new Config({ ...game_modes[1], locale });
  const g = new Game("T", cfg);
  g.join(new User({ id_user: "1", first_name: "A", username: "a", is_banned: false }));
  g.join(new User({ id_user: "2", first_name: "B", username: "b", is_banned: false }));
  g.decks = 1;
  g.last_card_played = { value: 7, type: "Copa" };
  g.table[3] = { value: 4, type: "Oro" };
  return g;
}

describe("Game.print i18n", () => {
  it("renders Spanish by default", () => {
    const g = mk("es");
    const out = g.print(true);
    expect(out).toContain("Mesa:");
    expect(out).toContain("Ultima carta: 7 de Copa");
    expect(out).toContain("Siguiente:");
  });

  it("renders English when locale=en", () => {
    const g = mk("en");
    const out = g.print(true);
    expect(out).toContain("Table:");
    expect(out).toContain("Last card: 7 of Copa");
    expect(out).toContain("Next:");
  });

  it("renders Portuguese when locale=pt", () => {
    const g = mk("pt");
    const out = g.print(true);
    expect(out).toContain("Mesa:");
    expect(out).toContain("Última carta: 7 de Copa");
    expect(out).toContain("Próximo:");
  });

  it("falls back to es for unknown locale", () => {
    const g = mk("zz");
    const out = g.print(true);
    expect(out).toContain("Mesa:");
    expect(out).toContain("Ultima carta");
  });

  it("localises the 'won' message in kill", () => {
    const gES = mk("es");
    const gEN = mk("en");
    // simulate increase_points reaching threshold then kill(0)
    gES.points[0] = gES.config.points;
    gEN.points[0] = gEN.config.points;
    const rES = gES.kill(0);
    const rEN = gEN.kill(0);
    expect(rES.response).toMatch(/^Gano A/);
    expect(rEN.response).toMatch(/^Won A/);
  });
});
