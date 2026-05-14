// Verify Game.print() actually localises via the group's config.locale
// and that the cleaner team/player layout renders the expected anchors.
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

function mk(locale, modeIdx = 1) {
  const cfg = new Config({ ...game_modes[modeIdx], locale });
  const g = new Game("T", cfg);
  g.join(new User({ id_user: "1", first_name: "A", username: "a", is_banned: false }));
  g.join(new User({ id_user: "2", first_name: "B", username: "b", is_banned: false }));
  g.decks = 1;
  g.last_card_played = { value: 7, type: "Copa" };
  g.table[3] = { value: 4, type: "Oro" };
  g.points = [12, 8];
  g.took = [4, 2];
  return g;
}

describe("Game.print i18n + clean layout", () => {
  it("Spanish header has Última carta and Turno labels", () => {
    const g = mk("es");
    const out = g.print(true);
    expect(out).toContain("Última carta: 7 de Copa");
    expect(out).toContain("Turno: A");
  });

  it("English header has Last card and Turn", () => {
    const g = mk("en");
    const out = g.print(true);
    expect(out).toContain("Last card: 7 of Copa");
    expect(out).toContain("Turn: A");
  });

  it("Portuguese header has Última carta and Vez", () => {
    const g = mk("pt");
    const out = g.print(true);
    expect(out).toContain("Última carta: 7 de Copa");
    expect(out).toContain("Vez: A");
  });

  it("falls back to es for unknown locale", () => {
    const g = mk("zz");
    const out = g.print(true);
    expect(out).toContain("Última carta");
  });

  it("parejas team blocks include points, taken, and player on one line", () => {
    const g = mk("es", 2); // The Grupish = parejas
    const out = g.print(false);
    // One block per team with emoji + label + Equipo
    expect(out).toMatch(/[🔴🔵] Equipo (Rojo|Azul) · 12 pts · 4 tomadas/);
    expect(out).toMatch(/[🔴🔵] Equipo (Rojo|Azul) · 8 pts · 2 tomadas/);
    // Players appear as bullets, name + handle + cards + sang on one line
    expect(out).toMatch(/   • A \(@a\) · 0 cartas · sin canto/);
    expect(out).toMatch(/   • B \(@b\) · 0 cartas · sin canto/);
    // No "Vacío" placeholder
    expect(out).not.toContain("Vacío");
  });

  it("individual lists numbered players with stats", () => {
    const g = mk("es", 1); // Clásico = individual
    const out = g.print(false);
    expect(out).toContain("Jugadores:");
    expect(out).toMatch(/1\. A \(@a\) · 0 cartas · sin canto · 12 pts · 4 tomadas/);
    expect(out).toMatch(/2\. B \(@b\) · 0 cartas · sin canto · 8 pts · 2 tomadas/);
  });

  it("localises the 'won' message in kill", () => {
    const gES = mk("es");
    const gEN = mk("en");
    gES.points[0] = gES.config.points;
    gEN.points[0] = gEN.config.points;
    const rES = gES.kill(0);
    const rEN = gEN.kill(0);
    expect(rES.response).toMatch(/^🏆 Ganó A/);
    expect(rEN.response).toMatch(/^🏆 Won A/);
  });
});
