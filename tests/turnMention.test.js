const Game = require("../class/Game");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

function makeGame() {
  return new Game("T", new Config(game_modes[1]));
}

describe("Game.turnMentionEntity", () => {
  it("mentions a username-less player by id with a correct UTF-16 offset", () => {
    const g = makeGame();
    g.users = [{ id_user: "12345", first_name: "Andrés", username: null }];
    g.player = 0;
    const label = g._lang().ig_next_label; // "👉 Turno: "
    // Emojis before the name → the offset must be in UTF-16 code units, which
    // is exactly what JS string indices give.
    const text = "Mesa: ⭐ 5 🃏\n" + label + "Andrés";
    const ent = g.turnMentionEntity(text);
    expect(ent.type).toBe("text_mention");
    expect(ent.length).toBe("Andrés".length);
    expect(ent.user).toEqual({ id: 12345, first_name: "Andrés" });
    // The offset/length must select exactly the name out of the rendered text.
    expect(text.slice(ent.offset, ent.offset + ent.length)).toBe("Andrés");
  });

  it("returns null when the player has a @username (the @mention already pings)", () => {
    const g = makeGame();
    g.users = [{ id_user: "1", first_name: "A", username: "andres" }];
    g.player = 0;
    expect(g.turnMentionEntity(g._lang().ig_next_label + "@andres")).toBeNull();
  });

  it("returns null for a CPU", () => {
    const g = makeGame();
    g.users = [{ id_user: "cpu_T_1", first_name: "Medio", cpu_difficulty: "medium" }];
    g.player = 0;
    expect(g.turnMentionEntity(g._lang().ig_next_label + "Medio")).toBeNull();
  });

  it("returns null when the id isn't a positive integer", () => {
    const g = makeGame();
    g.users = [{ id_user: "not-a-number", first_name: "X" }];
    g.player = 0;
    expect(g.turnMentionEntity(g._lang().ig_next_label + "X")).toBeNull();
  });

  it("returns null when the turn line isn't present in the text", () => {
    const g = makeGame();
    g.users = [{ id_user: "9", first_name: "Zoe" }];
    g.player = 0;
    expect(g.turnMentionEntity("Mesa: 5")).toBeNull();
  });
});
