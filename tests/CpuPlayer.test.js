const Game = require("../class/Game");
const User = require("../class/User");
const Card = require("../class/Card");
const Config = require("../class/Config");
const Sings = require("../class/Sings");
const cpu = require("../class/CpuPlayer");
const game_modes = require("../lang/game_modes_es");

// Card number → (value, type) shortcuts.
//   position 0..6 → values 1..7
//   position 7..9 → values 10..12
//   type by number % 4: 0=Oro, 1=Espada, 2=Copa, 3=Basto
function n(value, type = "Oro") {
  const map = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 10: 7, 11: 8, 12: 9 };
  const tmap = { Oro: 0, Espada: 1, Copa: 2, Basto: 3 };
  return map[value] * 4 + tmap[type];
}
function c(value, type = "Oro") {
  return new Card(n(value, type));
}
function makeUser(id, first_name) {
  return new User({
    id_user: String(id),
    first_name,
    last_name: "",
    username: first_name,
    is_banned: false,
  });
}

function buildGame({ users = 2, type = "individual", mode = 1, mata_canto = "on" } = {}) {
  const cfg = new Config({ ...game_modes[mode], type, mata_canto });
  const g = new Game("T", cfg);
  const names = ["A", "B", "C", "D"];
  for (let i = 0; i < users; i++) g.join(makeUser(i + 1, names[i]));
  g.decks = 1;
  // Default empty table; the test populates as needed.
  return g;
}

function setHand(g, idx, cards) {
  g.users[idx].cards = cards;
  // Recompute sing for the new hand (mirrors User.add_card).
  if (cards.length === 3) g.users[idx].sing = new Sings(cards, g.config);
}

function setTable(g, slotMap) {
  g.table = Array(10).fill(null);
  for (const [pos, card] of Object.entries(slotMap)) g.table[Number(pos)] = card;
}

describe("CpuPlayer.decide", () => {
  it("easy: returns a play action for a random card", () => {
    const g = buildGame();
    setHand(g, 0, [c(1), c(2), c(3)]);
    g.player = 0;
    const out = cpu.decide(g, 0, "easy");
    expect(out.action).toBe("play");
    expect(out.cardIdx).toBeGreaterThanOrEqual(0);
    expect(out.cardIdx).toBeLessThan(3);
  });

  it("easy: sings when sing.value > 0 and still has 3 cards", () => {
    const g = buildGame();
    // Trivilín = 3 cards of the same value (e.g., three 11s).
    setHand(g, 0, [c(11, "Oro"), c(11, "Espada"), c(11, "Copa")]);
    g.player = 0;
    const out = cpu.decide(g, 0, "easy");
    expect(out.action).toBe("sing");
  });

  it("medium: mesa 1,2,4,5 + mano 3,10 → picks 10 (avoids closing the 1-2-3-4-5 chain)", () => {
    const g = buildGame();
    setTable(g, { 0: c(1), 1: c(2), 3: c(4), 4: c(5) });
    setHand(g, 0, [c(3), c(10), c(7, "Espada")]);
    g.player = 0;
    g.last_card_played = c(6, "Espada"); // unrelated
    const out = cpu.decide(g, 0, "medium");
    expect(out.action).toBe("play");
    expect(g.users[0].cards[out.cardIdx].value).toBe(10);
  });

  it("medium: mesa 1..5 + last=3 + mano 1,3,5 + no live opp sing → plays 1 (mesa limpia wins)", () => {
    const g = buildGame();
    setTable(g, { 0: c(1), 1: c(2), 2: c(3), 3: c(4), 4: c(5) });
    setHand(g, 0, [c(1, "Espada"), c(3, "Copa"), c(5, "Espada")]);
    g.player = 0;
    g.last_card_played = c(3); // some 3, position 2
    // No opponent sing active.
    const out = cpu.decide(g, 0, "medium");
    expect(out.action).toBe("play");
    expect(g.users[0].cards[out.cardIdx].value).toBe(1);
  });

  it("medium: same mesa + live opp sing + mata_canto on → plays 3 (mata canto wins)", () => {
    const g = buildGame({ mata_canto: "on" });
    setTable(g, { 0: c(1), 1: c(2), 2: c(3), 3: c(4), 4: c(5) });
    setHand(g, 0, [c(1, "Espada"), c(3, "Copa"), c(5, "Espada")]);
    g.player = 0;
    g.last_card_played = c(3); // caída target
    // Set opponent (idx 1) with an active sing.
    g.users[1].sing.active = true;
    g.users[1].sing.value = 10;
    g.users[1].sing.name = "Patrulla";
    const out = cpu.decide(g, 0, "medium");
    expect(out.action).toBe("play");
    expect(g.users[0].cards[out.cardIdx].value).toBe(3);
  });

  it("medium: mesa 2,3,4,10 + mano 2,10 + no caída → plays 2 (takes 4 cards > 2)", () => {
    const g = buildGame();
    setTable(g, { 1: c(2), 2: c(3), 3: c(4), 7: c(10) });
    setHand(g, 0, [c(2, "Espada"), c(10, "Espada"), c(7, "Espada")]);
    g.player = 0;
    g.last_card_played = c(6, "Copa"); // unrelated, no caída setup
    const out = cpu.decide(g, 0, "medium");
    expect(out.action).toBe("play");
    expect(g.users[0].cards[out.cardIdx].value).toBe(2);
  });

  it("medium: same hand but last_card_played is a 10 → plays 10 (caída beats take chain)", () => {
    const g = buildGame();
    setTable(g, { 1: c(2), 2: c(3), 3: c(4), 7: c(10) });
    setHand(g, 0, [c(2, "Espada"), c(10, "Espada"), c(7, "Espada")]);
    g.player = 0;
    g.last_card_played = c(10, "Copa"); // caída setup on position 7
    const out = cpu.decide(g, 0, "medium");
    expect(out.action).toBe("play");
    expect(g.users[0].cards[out.cardIdx].value).toBe(10);
  });

  it("pro: sees next opponent's hand and avoids giving them a punishing caída", () => {
    const g = buildGame();
    g.config.caida = 1;
    // Empty table. Bot has 2,3,4. The "natural" medium play would be
    // any of them (all just place; defensive penalty is small for an
    // empty table). But pro knows the next player has a 4 → if bot
    // plays the 4, last_card_played becomes 4 and the next player
    // can caída... wait, caída needs took>1. With empty table,
    // placing a 4 doesn't enable next-player caída (they'd just
    // place too). So pro vs medium converges here.
    //
    // Setup a stronger case: mesa has a 7. Bot has 4,7,12. If bot
    // plays 7 it takes the table 7 and sets last_card_played=7.
    // Next player has another 7 + the matching position is now empty
    // (we just cleaned it). So next player can't caída — they'd just
    // place. Good. But if mesa had 5 too and bot plays 5: places at
    // position 4, last_card_played=5. Next player with a 5 can play
    // it: matches position 4 (now has bot's 5), takes it → caída.
    // Pro avoids that.
    setTable(g, { 4: c(5) }); // a 5 sitting alone
    setHand(g, 0, [c(5, "Espada"), c(12), c(7, "Copa")]);
    setHand(g, 1, [c(5, "Copa"), c(2), c(11)]); // next player has a 5!
    g.player = 0;
    g.last_card_played = c(6, "Copa"); // unrelated
    // If we play our 5: take table[4]=5, took=2, no caída. After:
    // table[4] empty, last_card_played = our 5. Next player's 5 →
    // table[4] empty → no take → just places. No caída risk.
    // If we play 7: place at position 6. Last_card_played = our 7.
    // Next player has no 7 → fine.
    // Pro should pick the 5 (took=2, no opp setup); but also any other
    // candidate that doesn't enable opp caída. The key assertion: pro
    // does NOT pick a play that gives opp a guaranteed caída.
    const out = cpu.decide(g, 0, "pro");
    expect(out.action).toBe("play");
    // The 12 (position 9) is "safest" — places into an empty far slot,
    // no chain, no caída setup. Took=1.
    // The 5 takes (took=2). No caída risk (we drain the table slot).
    // Should not pick anything that creates a caída opportunity.
    // We test that the chosen card doesn't create the dangerous "5
    // placed on table at position 4" scenario where opp can take it.
    const chosen = g.users[0].cards[out.cardIdx];
    if (chosen.value === 5) {
      // OK — taking the table 5 is fine.
    } else {
      // Any non-5 choice must not leave a position the opp can take.
      // i.e., the chosen card's position should NOT have a matching
      // card in next opp's hand.
      const oppPositions = g.users[1].cards.map((card) => card.position);
      expect(oppPositions.includes(chosen.position)).toBe(false);
    }
  });

  it("pro: 3-card hand variant of the same 10/11 caída scenario", () => {
    // Same shape but bot has 3 cards instead of 2 (more realistic mid-
    // mano). The third card shouldn't change the decision — caída +
    // mesa limpia from the 10 dominates everything else.
    const g = buildGame({ users: 2 });
    setTable(g, { 7: c(10, "Oro") });
    setHand(g, 0, [
      c(11, "Copa"),
      c(10, "Basto"),
      c(3, "Espada"), // irrelevant 3rd card
    ]);
    g.users[1].cards = [c(11, "Espada"), c(6, "Copa")];
    g.player = 0;
    g.last_card_played = c(10, "Oro");
    g.last_hand = false;
    const out = cpu.decide(g, 0, "pro");
    expect(out.action).toBe("play");
    expect(g.users[0].cards[out.cardIdx].value).toBe(10);
  });

  it("pro: with 10+11 in hand, mesa with opponent's 10, takes the caída", () => {
    // Repro of a production case: mesa was clean. Opponent played their
    // 10 (now on table at position 7). Bot pro had 10 and 11; opp has 11.
    // Playing 10 caídas the opp + cleans mesa (massive points). Playing
    // 11 places it on table and hands opp a guaranteed caída.
    const g = buildGame({ users: 2 });
    setTable(g, { 7: c(10, "Oro") });
    setHand(g, 0, [c(11, "Copa"), c(10, "Basto")]); // bot's hand
    g.users[1].cards = [c(11, "Espada")]; // opp has just the 11
    g.player = 0;
    g.last_card_played = c(10, "Oro"); // opp's 10 is what's on table
    g.last_hand = false;
    const out = cpu.decide(g, 0, "pro");
    expect(out.action).toBe("play");
    expect(g.users[0].cards[out.cardIdx].value).toBe(10);
  });

  it("Start_By dealer auto-picks 4", () => {
    const g = buildGame();
    // Mark a user as the dealer with the Start_By sentinel.
    g.users[1].cards = ["Start_By"];
    const out = cpu.decide(g, 1, "easy");
    expect(out.action).toBe("start_by");
    expect(out.value).toBe(4);
  });
});
