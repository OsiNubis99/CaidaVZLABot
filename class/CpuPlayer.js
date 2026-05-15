/**
 * CPU player decision engine. Pure functions — no side effects on the
 * game. Returns the action the bot should take when it's its turn.
 *
 * Three difficulties:
 *
 *   - "easy":   random play, always cantos if value > 0. No awareness.
 *   - "medium": follows priorities matar-canto > mesa-limpia > caída >
 *               take-most-cards. Knows table state but NOT opponent
 *               cards. When forced to place, prefers positions that
 *               don't extend an existing chain on the table.
 *   - "pro":    medium + sees other players' hands + tracks
 *               game.played_cards to know what's still out there.
 *               Predicts whether the next opponent can punish each
 *               candidate play and penalizes accordingly.
 *
 * Priority weights are tuned so the canonical priority order from the
 * domain expert is honored: matar-canto (+2000) > mesa-limpia (+500) >
 * caída (card.points × config.caida × 10) > take chain (took × 5) >
 * defensive penalty (variable). The defensive penalty never overcomes
 * mata-canto, mesa-limpia, or caída — that's by design: those are
 * "always do it" moves per the rules.
 */
const Card = require("./Card");

const DIFFICULTIES = ["easy", "medium", "pro"];

function isDifficulty(d) {
  return DIFFICULTIES.indexOf(d) >= 0;
}

/**
 * Compute the chain of takes that playing `card` at the current table
 * state would produce. Returns the number of cards the player would
 * take (including the card itself; 1 = just placed it, no take).
 */
function simulateTake(card, table) {
  if (!card || typeof card.position !== "number") return 1;
  if (table[card.position] == null) return 1; // no match → place, took=1
  let pos = card.position;
  let took = 1;
  while (pos < table.length && table[pos] != null) {
    pos++;
    took++;
  }
  return took;
}

/**
 * After playing `card`, returns what the table will look like.
 * Either the card replaces a chain of takes (slots cleared) or it
 * gets placed at its position.
 */
function tableAfter(card, table) {
  const next = table.slice();
  if (next[card.position] != null) {
    let pos = card.position;
    while (pos < next.length && next[pos] != null) {
      next[pos] = null;
      pos++;
    }
  } else {
    next[card.position] = card;
  }
  return next;
}

function tableIsEmpty(table) {
  return table.every((slot) => slot == null);
}

/**
 * Build the set of card-numbers still unknown to a CPU. Used by pro
 * to scope its "could opponent punish me" check. Medium can't use this.
 *
 *   - Includes all 40 deck cards EXCEPT:
 *     - cards in the bot's own hand
 *     - cards on the table
 *     - cards in this.played_cards (already played and gone)
 *
 * The remainder is what opponents collectively hold + what's still in
 * the deck. Pro further refines by ALSO subtracting opponents' visible
 * hands (it sees them), leaving just the deck.
 */
function unknownCardNumbers(game, botIdx, opts = {}) {
  const known = new Set();
  // Bot's own hand
  for (const c of game.users[botIdx].cards || []) {
    if (c && typeof c.number === "number") known.add(c.number);
  }
  // Table
  for (const c of game.table || []) {
    if (c && typeof c.number === "number") known.add(c.number);
  }
  // Already played
  for (const n of game.played_cards || []) known.add(n);
  // Pro sees opponent hands too
  if (opts.seeOpponents) {
    for (let i = 0; i < game.users.length; i++) {
      if (i === botIdx) continue;
      for (const c of game.users[i].cards || []) {
        if (c && typeof c.number === "number") known.add(c.number);
      }
    }
  }
  const out = [];
  for (let n = 0; n < 40; n++) if (!known.has(n)) out.push(n);
  return out;
}

/**
 * Given a table layout and a set of "opponent-possible" card numbers,
 * return the largest chain length any opponent could take in a single
 * play. Used by both medium (with broad possibilities) and pro (with
 * exact opponent hand).
 */
function maxOpponentChain(table, possibleCardNumbers) {
  let best = 0;
  for (const n of possibleCardNumbers) {
    const c = new Card(n);
    if (table[c.position] != null) {
      const took = simulateTake(c, table);
      if (took > best) best = took;
    }
  }
  return best;
}

function hasLiveOpponentSing(game, botIdx) {
  for (let i = 0; i < game.users.length; i++) {
    if (i === botIdx) continue;
    const u = game.users[i];
    if (
      u &&
      u.sing &&
      u.sing.active &&
      u.sing.name &&
      u.sing.name !== "No cantó"
    ) {
      return true;
    }
  }
  return false;
}

function isCaida(card, game) {
  return (
    !!game.last_card_played &&
    typeof game.last_card_played.position === "number" &&
    game.last_card_played.position === card.position &&
    game.table[card.position] != null // caída requires also taking something
  );
}

/**
 * Score a single play for the given difficulty. Higher = better.
 */
function scorePlay(game, botIdx, cardIdx, difficulty) {
  const u = game.users[botIdx];
  const card = u.cards[cardIdx];
  if (!card || typeof card.position !== "number") return -Infinity;

  const cfg = game.config;
  const took = simulateTake(card, game.table);
  const isC = isCaida(card, game);
  const tableNext = tableAfter(card, game.table);
  const cleansTable = isC || took > 1
    ? tableIsEmpty(tableNext)
    : false;

  let score = 0;

  // Priority 1: matar canto (caída + rival has live sing + mata_canto on).
  if (isC && cfg.mata_canto === "on" && hasLiveOpponentSing(game, botIdx)) {
    score += 2000;
  }

  // Priority 2: mesa limpia (only counts if NOT last hand of deck).
  if (cleansTable && !game.last_hand) {
    score += 500;
  }

  // Priority 3: caída — value the actual points it would score.
  if (isC) {
    score += card.points * (cfg.caida || 1) * 10;
  }

  // Priority 4: take chain — more cards is better. This is the
  // tie-breaker when none of the higher priorities apply.
  score += took * 5;

  // Priority 5: defensive penalty — avoid leaving the table in a state
  // an opponent can exploit. Skip for easy entirely; medium uses a
  // probabilistic guess; pro uses exact opponent hands.
  if (difficulty === "medium" || difficulty === "pro") {
    const possible = unknownCardNumbers(game, botIdx, {
      seeOpponents: difficulty === "pro",
    });
    // Pro uses ONLY opponents' real hands (not deck) for the check —
    // we want to know what the NEXT player can do, not what someone
    // might pull from the deck.
    let probeSet;
    if (difficulty === "pro") {
      probeSet = [];
      // Concretely use the next player's actual hand.
      const nextIdx = (botIdx + 1) % game.users.length;
      const nextHand = game.users[nextIdx].cards || [];
      for (const c of nextHand) {
        if (c && typeof c.number === "number") probeSet.push(c.number);
      }
    } else {
      probeSet = possible;
    }
    const worstChain = maxOpponentChain(tableNext, probeSet);
    // Medium: scale by 3 (broad probe, less confident). Pro: by 10
    // (exact info, high confidence).
    const weight = difficulty === "pro" ? 10 : 3;
    score -= worstChain * weight;
    // Pro extra: penalize leaving last_card_played that the next
    // player can caída us on. We can detect this exactly because we
    // know their hand. The setup is: after our play, last_card_played
    // is our card; if the next player has a same-value card AND a
    // matching-position table slot, they caída us → opponent gains
    // card.points × caida × 10.
    if (difficulty === "pro") {
      const nextIdx = (botIdx + 1) % game.users.length;
      const nextHand = game.users[nextIdx].cards || [];
      for (const c of nextHand) {
        if (
          c &&
          typeof c.position === "number" &&
          c.position === card.position &&
          tableNext[c.position] != null
        ) {
          score -= card.points * (cfg.caida || 1) * 10;
          break;
        }
      }
    }
  }

  return score;
}

/**
 * Pick the best play for a CPU. Returns { action: "play", cardIdx }.
 * The canto decision is handled separately by shouldSing().
 */
function pickBestPlay(game, botIdx, difficulty) {
  const cards = game.users[botIdx].cards;
  if (!cards || cards.length === 0) {
    return { action: "play", cardIdx: 0 };
  }
  if (difficulty === "easy") {
    return { action: "play", cardIdx: Math.floor(Math.random() * cards.length) };
  }
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    // Skip the Start_By sentinel and the canto pseudo-card if present.
    if (!c || c === "Start_By" || typeof c.position !== "number") continue;
    const s = scorePlay(game, botIdx, i, difficulty);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return { action: "play", cardIdx: bestIdx };
}

/**
 * Should the CPU canto this mano? Easy/medium always canto if value > 0.
 * Pro skips canto in the very specific 22-22 endgame edge case where
 * revealing the hand could hurt — defer to v2 for now and behave like
 * the other tiers.
 */
function shouldSing(game, botIdx, difficulty) {
  const u = game.users[botIdx];
  if (!u || !u.sing) return false;
  if (u.sing.active) return false; // already cantoed
  if (!(u.sing.value > 0)) return false;
  // Only at the start of a mano (still have 3 cards).
  if (!u.cards || u.cards.length !== 3) return false;
  // All difficulties canto when there's value. The 22-22 edge case
  // for pro is intentionally omitted in v1.
  return true;
}

/**
 * Top-level decision function. Returns:
 *   - { action: "sing" }  to canto first, then the caller calls again to play
 *   - { action: "play", cardIdx } to play the chosen card
 *   - { action: "start_by", value: 1 | 4 } when the dealer must pick the
 *     starting direction (cards[0] === "Start_By"). CPU picks 4 always
 *     for now (slight bias toward seeing the descending sequence first;
 *     not meaningfully different from 1 for a random deck).
 */
function decide(game, botIdx, difficulty) {
  if (!isDifficulty(difficulty)) difficulty = "easy";
  const u = game.users[botIdx];
  const cards = u && u.cards;
  // Dealer's "Iniciar por 1 / 4" picker.
  if (cards && cards[0] === "Start_By") {
    return { action: "start_by", value: 4 };
  }
  if (shouldSing(game, botIdx, difficulty)) {
    return { action: "sing" };
  }
  return pickBestPlay(game, botIdx, difficulty);
}

module.exports = {
  decide,
  DIFFICULTIES,
  // Exported for tests / debugging only.
  _internal: {
    scorePlay,
    pickBestPlay,
    shouldSing,
    simulateTake,
    tableAfter,
    isCaida,
    hasLiveOpponentSing,
    maxOpponentChain,
    unknownCardNumbers,
  },
};
