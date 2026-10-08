const { projectGameRow } = require("../services/gameHistory");

const at = new Date("2026-10-01T20:00:00Z");

describe("projectGameRow (Mi cuenta → Últimas partidas)", () => {
  it("new WebApp payload: slot, won, reason, roster names", () => {
    const row = {
      id_group: "CAIDA-AB12",
      group_name: null,
      created_at: at,
      payload: {
        source: "webapp",
        winner_user_id: "2",
        points: [12, 24],
        result: {
          ranked: false,
          reason: "bots",
          preset: "Clásico",
          winnerSlot: 1,
          entries: [
            { statsId: "1", name: "Andrés", slot: 0, won: false },
            { statsId: "cpu_pro", name: "Bot", isBot: true, slot: 1, won: true },
          ],
        },
      },
    };
    expect(projectGameRow(row, 1)).toEqual({
      at,
      source: "webapp",
      place: null,
      won: false,
      ranked: false,
      reason: "bots",
      preset: "Clásico",
      points: [12, 24],
      winnerSlot: 1,
      mySlot: 0,
      players: [
        { name: "Andrés", slot: 0, bot: false, me: true },
        { name: "Bot", slot: 1, bot: true, me: false },
      ],
    });
  });

  it("group game in parejas: my team's win counts as mine", () => {
    const row = {
      id_group: "-100123",
      group_name: "Los Panas",
      created_at: at,
      payload: {
        points: [25, 10],
        result: {
          ranked: true,
          reason: null,
          preset: "The Grupish",
          winnerSlot: 0,
          entries: [
            { statsId: "1", slot: 0, won: true },
            { statsId: "2", slot: 1, won: false },
            { statsId: "3", slot: 0, won: true },
            { statsId: "4", slot: 1, won: false },
          ],
        },
      },
    };
    const r = projectGameRow(row, "3");
    expect(r).toMatchObject({
      source: "group",
      place: "Los Panas",
      won: true,
      ranked: true,
      mySlot: 0,
    });
    expect(r.players.map((p) => p.name)).toEqual([null, null, null, null]);
  });

  it("old payload (before reason/slot/won): infers what it can", () => {
    const humans = {
      id_group: "-1",
      created_at: at,
      payload: {
        winner_user_id: "7",
        points: [30, 2],
        result: {
          ranked: false,
          winnerSlot: 0,
          entries: [
            { statsId: "7", countWin: false },
            { statsId: "8", countWin: false },
          ],
        },
      },
    };
    expect(projectGameRow(humans, "7")).toMatchObject({
      won: true,
      reason: "custom_scoring",
      mySlot: null,
    });
    expect(projectGameRow(humans, "8")).toMatchObject({ won: false });

    const withBot = JSON.parse(JSON.stringify(humans));
    withBot.payload.result.entries[1] = { statsId: "cpu_easy", isBot: true, countWin: false };
    expect(projectGameRow(withBot, "7").reason).toBe("bots");
  });

  it("no result at all (very old event) → still a row, not ranked, unknown reason", () => {
    const r = projectGameRow(
      { id_group: "-1", created_at: at, payload: { winner_user_id: "5", points: [24, 3] } },
      "5",
    );
    expect(r).toMatchObject({ won: true, ranked: false, reason: null, players: [] });
  });
});
