// Verify Game.print() actually localises via the group's config.locale
// and that the cleaner team/player layout renders the expected anchors.
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

function mk(locale, modeIdx = 1, overrides = {}) {
  const cfg = new Config({ ...game_modes[modeIdx], locale, ...overrides });
  const g = new Game("T", cfg);
  g.join(new User({ id_user: "1", first_name: "A", username: "a", is_banned: false }));
  g.join(new User({ id_user: "2", first_name: "B", username: "b", is_banned: false }));
  // Parejas needs exactly 4 users to render as parejas (isParejasMode
  // gates on users.length === 4). Add two more for parejas tests so
  // the team-block renderer kicks in.
  if (overrides.type === "parejas") {
    g.join(new User({ id_user: "3", first_name: "C", username: "c", is_banned: false }));
    g.join(new User({ id_user: "4", first_name: "D", username: "d", is_banned: false }));
  }
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
    const g = mk("es", 2, { type: "parejas" }); // force parejas (Grupish now defaults to individual)
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

  it("individual lists players with color emoji and stats", () => {
    const g = mk("es", 1); // Clásico = individual
    const out = g.print(false);
    expect(out).toMatch(/🔴 A \(@a\) · 0 cartas · sin canto · 12 pts · 4 tomadas/);
    expect(out).toMatch(/🔵 B \(@b\) · 0 cartas · sin canto · 8 pts · 2 tomadas/);
  });

  it("kill includes final score for parejas", () => {
    const g = mk("es", 2, { type: "parejas" });
    g.points[0] = 24;
    g.points[1] = 19;
    const r = g.kill(0);
    expect(r.response).toMatch(/^🏆 Ganó A.*24-19/);
  });

  it("kill includes breakdown for individual", () => {
    const g = mk("es", 1);
    g.points = [24, 18];
    const r = g.kill(0);
    expect(r.response).toContain("(A 24, B 18)");
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

  it("individual color marker follows the player across deck rotations", () => {
    // 4 players individual: A=🔴, B=🔵, C=🟢, D=🟡. After a deck-end
    // rotation (users.push(users.shift())) the array becomes [B,C,D,A]
    // but each player must keep their join-order color.
    const cfg = new Config({ ...game_modes[1], locale: "es" }); // Clásico = individual
    const g = new Game("T", cfg);
    g.join(new User({ id_user: "1", first_name: "A", username: "a", is_banned: false }));
    g.join(new User({ id_user: "2", first_name: "B", username: "b", is_banned: false }));
    g.join(new User({ id_user: "3", first_name: "C", username: "c", is_banned: false }));
    g.join(new User({ id_user: "4", first_name: "D", username: "d", is_banned: false }));
    g.decks = 1;
    g.points = [0, 0, 0, 0];
    g.took = [0, 0, 0, 0];
    // Simulate the rotation that handing_out_cards does at end-of-deck.
    g.users.push(g.users.shift());
    g.points.push(g.points.shift());
    const out = g.print(false);
    // A (originally index 0) keeps 🔴 even though it now sits at index 3.
    expect(out).toMatch(/🔴 A \(@a\)/);
    expect(out).toMatch(/🔵 B \(@b\)/);
    expect(out).toMatch(/🟢 C \(@c\)/);
    expect(out).toMatch(/🟡 D \(@d\)/);
  });

  it("between-deck shuffle shows the full /estado-style status", () => {
    const g = mk("es", 2, { type: "parejas" });
    g.points = [12, 9];
    // first shuffle (decks 0 -> 1) has no status — just the legacy
    // combined banner ("Barajando...\nPulsa..."). second (1 -> 2) is
    // the real between-deck moment and uses the new layout: banner +
    // full status block + 1/4 prompt.
    g.shuffle();
    const out2 = g.shuffle();
    expect(out2).toContain("Barajando...");
    // Full status block: team points appear inside the team lines,
    // not as a "X pts | Y pts" one-liner.
    expect(out2).toMatch(/Equipo (Rojo|Azul) · 12 pts/);
    expect(out2).toMatch(/Equipo (Rojo|Azul) · 9 pts/);
    expect(out2).toMatch(/Pulsa el botón para escoger si empezar mesa con 1 o 4/);
  });

  it("mid-deck mano shows the short status with mesa + last card + points + turno", () => {
    const g = mk("es", 1); // individual
    g.points = [12, 9];
    // Seed enough deck so handing_out_cards takes the deck > 0 branch
    // and reaches the renderFull = false path (start_by == 0).
    g.deck = Array(20).fill(0).map((_, i) => i);
    g.users.forEach((u) => (u.cards = []));
    g.decks = 1;
    const out = g.handing_out_cards(0);
    // Short status now carries everything the player needs per-play:
    expect(out).toContain("Mesa:");
    expect(out).toMatch(/🔴 12.*\|.*🔵 9/);
    expect(out).toContain("Turno:");
    // But not the per-player block (cards/canto/took counters).
    expect(out).not.toContain("cartas · sin canto");
  });

  it("renderShortStatus includes mesa + última carta + points + turno", () => {
    // Direct unit test for the new helper. /play_card uses this path
    // on every card played (mid-mano) and at mid-deck mano boundaries.
    const g = mk("es", 1); // individual, 2 users
    g.points = [12, 9];
    g.last_card_played = { value: 11, type: "Copa" };
    g.table[3] = { value: 4, type: "Oro" };
    const out = g.renderShortStatus();
    expect(out).toContain("Mesa:");
    expect(out).toContain("4"); // mesa shows the 4 placed at position 3
    expect(out).toContain("Última carta: 11 de Copa");
    expect(out).toMatch(/🔴 12.*\|.*🔵 9/);
    expect(out).toContain("Turno: A");
    // No per-player block.
    expect(out).not.toContain("cartas · sin canto");
  });

  it("3p individual render shows 3 colored lines, no 🟡", () => {
    // Clásico = individual; 3 players means colors 🔴🔵🟢 only.
    const cfg = new Config({ ...game_modes[1], locale: "es" });
    const g = new Game("T", cfg);
    g.join(new User({ id_user: "1", first_name: "A", username: "a", is_banned: false }));
    g.join(new User({ id_user: "2", first_name: "B", username: "b", is_banned: false }));
    g.join(new User({ id_user: "3", first_name: "C", username: "c", is_banned: false }));
    g.decks = 1;
    g.last_card_played = { value: 7, type: "Copa" };
    g.table[3] = { value: 4, type: "Oro" };
    g.points = [12, 8, 5];
    g.took = [4, 2, 1];
    const out = g.print(false);
    // Each player gets a colored line.
    expect(out).toContain("🔴 A");
    expect(out).toContain("🔵 B");
    expect(out).toContain("🟢 C");
    // 4-player color and parejas-only label must not appear.
    expect(out).not.toContain("🟡");
    expect(out).not.toContain("Equipo");
  });
});
