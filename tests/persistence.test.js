// Pure (de)serialization is in services/gameSerialize.js so it has no
// DB side effect at module load.
const { serialize, deserialize } = require("../services/gameSerialize");
const Game = require("../class/Game");
const User = require("../class/User");
const Card = require("../class/Card");
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");

function makeUser(id, first_name) {
  return new User({ id_user: String(id), first_name, last_name: "", username: first_name, is_banned: false });
}

describe("gameSerialize round-trip", () => {
  it("round-trips a freshly created game", () => {
    const g = new Game("test", new Config(game_modes[1]));
    const g2 = deserialize(serialize(g));
    expect(g2.name).toBe(g.name);
    expect(g2.decks).toBe(0);
    expect(g2.users).toEqual([]);
    expect(g2.table).toEqual([null, null, null, null, null, null, null, null, null, null]);
  });

  it("round-trips users and their hand", () => {
    const g = new Game("test", new Config(game_modes[1]));
    const u = makeUser(1, "A");
    u.cards = [new Card(0), new Card(5)];
    g.users.push(u);
    g.decks = 1;
    const g2 = deserialize(serialize(g));
    expect(g2.users.length).toBe(1);
    expect(g2.users[0].id_user).toBe("1");
    expect(g2.users[0].cards.length).toBe(2);
    expect(g2.users[0].cards[0]).toBeInstanceOf(Card);
    expect(g2.users[0].cards[0].number).toBe(0);
  });

  it("round-trips the table state with cards at positions", () => {
    const g = new Game("test", new Config(game_modes[1]));
    g.table[0] = new Card(0);
    g.table[5] = new Card(20);
    const g2 = deserialize(serialize(g));
    expect(g2.table[0]).toBeInstanceOf(Card);
    expect(g2.table[0].number).toBe(0);
    expect(g2.table[5].number).toBe(20);
    expect(g2.table[1]).toBeNull();
  });

  it("preserves Start_By sentinel through the round-trip", () => {
    const g = new Game("test", new Config(game_modes[1]));
    g.users.push(makeUser(1, "A"));
    g.users.push(makeUser(2, "B"));
    g.users[g.users.length - 1].cards = ["Start_By"];
    const g2 = deserialize(serialize(g));
    expect(g2.users[g2.users.length - 1].cards).toEqual(["Start_By"]);
  });
});

describe("_dealerSyncCandidate persistence", () => {
  it("serializes when set (between deck-start and first play)", () => {
    const g = new Game("test", new Config(game_modes[1]));
    g.users.push(makeUser(1, "A"));
    g.users.push(makeUser(2, "B"));
    const syncCard = new Card(20); // position 5
    g.last_card_played = syncCard;
    g._dealerSyncCandidate = {
      dealerIdx: 1,
      syncCard,
      points: 5,
    };
    const data = serialize(g);
    expect(data.dealer_sync_candidate).toEqual({
      dealerIdx: 1,
      syncCardNumber: 20,
      points: 5,
    });
  });

  it("round-trips through serialize/deserialize, reconstructing syncCard as a Card", () => {
    const g = new Game("test", new Config(game_modes[1]));
    g.users.push(makeUser(1, "A"));
    g.users.push(makeUser(2, "B"));
    const syncCard = new Card(28); // position 7
    g.last_card_played = syncCard;
    g._dealerSyncCandidate = {
      dealerIdx: 1,
      syncCard,
      points: 3,
    };
    const g2 = deserialize(serialize(g));
    expect(g2._dealerSyncCandidate).not.toBeNull();
    expect(g2._dealerSyncCandidate.dealerIdx).toBe(1);
    expect(g2._dealerSyncCandidate.points).toBe(3);
    expect(g2._dealerSyncCandidate.syncCard).toBeInstanceOf(Card);
    expect(g2._dealerSyncCandidate.syncCard.number).toBe(28);
  });

  it("serializes/deserializes as null when not set", () => {
    const g = new Game("test", new Config(game_modes[1]));
    expect(g._dealerSyncCandidate).toBeNull();
    const data = serialize(g);
    expect(data.dealer_sync_candidate).toBeNull();
    const g2 = deserialize(data);
    expect(g2._dealerSyncCandidate).toBeNull();
  });
});
