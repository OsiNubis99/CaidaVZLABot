# 3-player support + mata_mesa rule + scoring helpers

Status: draft for review
Date: 2026-05-14

## Goals

1. Add full 3-player support (individual format only — parejas needs 4).
2. Wire `mata_mesa`: today the flag exists in config and presets but no code reads it.
3. Fix a latent bug in the 3-player took-bonus threshold: today the threshold of 14 is assigned to `player 0` (first to play); it should be assigned to the dealer (`users[length-1]`).
4. Consolidate the scattered `config.type === "parejas" ? player % 2 : player` pattern into 3 helper methods on `Game` so future changes touch one place instead of ~5.
5. Tests cover all four points above.

## Non-goals

- Strategy/State pattern, mode subclasses, per-mode files. The codebase has only 2 game modes (individual / parejas) plus the 2p/3p/4p axis on top of individual — class hierarchy is overkill.
- New `/configurar` UI. The `mata_mesa` toggle already exists, it just had no consumer.
- Modo torneo. Tournament is metadata around finished games, not a game variant.
- Moving logic out of `class/Game.js`. Helpers live on the existing class.

## No-regression contract

- 2P and 4P (both individual and parejas) behave exactly as today.
- Persistence (`gameSerialize.js`) keeps working — the new helpers are derived at call time from `config.type` + `users.length`. The one new piece of state we add (`_dealerSyncCandidate`) is round-tripped explicitly.
- The 60 tests passing today keep passing. ~14 new tests added.

## Architecture: 3 helper methods on `Game`

```js
/**
 * Returns true only when the game is actually being played in parejas
 * format. A group can have `config.type === "parejas"` stored, but if
 * the active game has fewer than 4 users it plays as individual —
 * parejas needs exactly 4 to make sense.
 */
isParejasMode() {
  return this.config.type === "parejas" && this.users.length === 4;
}

/**
 * Map a user index to the scoring slot in this.points / this.took.
 * Parejas-4 collapses partners into 2 slots ([0,2] -> 0, [1,3] -> 1);
 * everything else (2p, 3p, individual-4) is a 1:1 mapping.
 */
scoringSlot(playerIdx) {
  return this.isParejasMode() ? playerIdx % 2 : playerIdx;
}

/**
 * The dealer is always the last user — they receive the Start_By
 * sentinel and earn the table-pegar sync points. Per-deck rotation
 * (handing_out_cards.deck-empty branch) shifts the dealer every deck.
 */
dealerIdx() {
  return this.users.length - 1;
}
```

### Callsite refactor

| Existing line | Becomes |
|---|---|
| `increase_points` (line 167): `position = type == "parejas" ? player % 2 : player` | `position = this.scoringSlot(player)` |
| `play_card` took accumulation (line 331) | `this.took[this.scoringSlot(this.player)] += took` |
| `kill` stat attribution (line 401): `comparate = type == "parejas" ? i % 2 : i` | `comparate = this.scoringSlot(i)` |
| `_selectTookBonusRules` (line 222): `users.length == 4 && type != parejas` | `users.length == 4 && !this.isParejasMode()` |
| Renderers selection (lines 426, 466, 552, 584): `type === "parejas"` | `this.isParejasMode()` |
| Color stamping in `join` (line 80): gates on `type === "individual"` | gates on `!this.isParejasMode()` so 3p+type=parejas still gets per-player colors |

`dealerIdx()` replaces ~6 `this.users.length - 1` occurrences for readability — that change is cosmetic and not blocking.

## 3-player specifics

| Concern | Today | Change |
|---|---|---|
| Took-bonus thresholds | `[{p:0,t:14}, {p:1,t:13}, {p:2,t:13}]` | `[{p:0,t:13}, {p:1,t:13}, {p:2,t:14}]` — dealer (idx 2) gets 14 |
| Validation in `/inicia_ya` | accepts 2/3/4 | unchanged |
| `print_before_game` type display | gated on `players==4` | unchanged |
| Color marker | `User.color = INDIVIDUAL_COLORS[joinIdx]` only if `type === "individual"` | stamped when `!isParejasMode()` — covers 3p+type=parejas too |
| Renderers | branch on `type === "parejas"` directly | branch on `isParejasMode()` |

A group with `config.type = "parejas"` saved that plays a game with 3 users gets: scoring as individual, render as individual, colors stamped per player. The saved config is **not mutated** — the next 4-player game in the same group is parejas again.

## mata_mesa rule

### Game definition (per user)

- Dealer just dealt a new deck via "Iniciar por 1/4"
- During the deal, dealer earned N sync points by placing cards that matched the descending/ascending sequence
- The last placed table card becomes `last_card_played` (set in `push_cards` with `save=true`)
- First player of the new deck plays a card that takes from the table AND matches `last_card_played.position` → caída
- **mata_mesa=on:** dealer loses their N sync points (clamped to 0). Caída-player still gets caída points as usual.
- **mata_mesa=off:** dealer keeps the N sync points. Caída-player still gets caída points. (= today's behavior, regardless of flag.)

### Implementation

**Set the candidate** — in `handing_out_cards`, inside the `if (this.deck.length > 0)` branch, after the `points = new_cards(...)` line:

```js
if (start_by !== 0 && points > 0) {
  this._dealerSyncCandidate = {
    dealerIdx: this.dealerIdx(),
    syncCard: this.last_card_played, // 4th dealt card, save=true
    points: points,
  };
} else if (start_by === 0) {
  // mid-deck deal — mata_mesa does not apply here
  this._dealerSyncCandidate = null;
}
```

**Apply the candidate** — in `play_card`, inside the caída block (after `increase_points(this.player, ...)`):

```js
if (
  this._dealerSyncCandidate &&
  this._dealerSyncCandidate.syncCard === this.last_card_played
) {
  if (this.config.mata_mesa === "on") {
    const slot = this.scoringSlot(this._dealerSyncCandidate.dealerIdx);
    const lost = Math.min(this.points[slot] || 0, this._dealerSyncCandidate.points);
    this.points[slot] = (this.points[slot] || 0) - lost;
    response += L.mata_mesa_msg.replace("{n}", lost);
  }
  this._dealerSyncCandidate = null; // consumed even if mata_mesa is off
}
```

**Clear the candidate** — at the end of `play_card`, after the caída block but before returning. Any play (whether or not it was caída) consumes the candidate, so only the first card of the deck can trigger mata_mesa:

```js
// Only the first play of the deck can trigger mata_mesa.
this._dealerSyncCandidate = null;
```

### Trigger condition (summary)

| Event | mata_mesa fires? |
|---|---|
| First play of new deck + caída on dealer's last-dealt card + flag on | ✅ |
| First play of new deck + no caída + flag on | ❌ (candidate cleared, no effect) |
| Second play of deck + caída on dealer's last card + flag on | ❌ (candidate already cleared) |
| Mid-deck mano boundary (caida_continua=on) + caída + flag on | ❌ (no candidate set mid-deck) |
| Any scenario with flag off | ❌ |

### Edge cases

- Dealer earned 0 sync points → candidate not set → mata_mesa cannot fire (nothing to subtract).
- Dealer/team has fewer points than the sync amount → clamp to 0, never negative.
- Parejas-4 with mata_mesa → subtract from the team slot (via `scoringSlot(dealerIdx)`), so partner is also penalized. Matches the game rule that scoring is at team level.
- 3p with mata_mesa → subtract from the dealer's individual slot.

### i18n

`lang/{es,en,pt}.js` get a new key `mata_mesa_msg`:

- es: `"🔄 Mata mesa: -{n} pts al dealer\n"`
- en: `"🔄 Mata mesa: dealer loses {n} pts\n"`
- pt: `"🔄 Mata mesa: -{n} pts ao dealer\n"`

### Persistence

`_dealerSyncCandidate` is transient but spans across messages (deck-start → first play). If the bot restarts between those two events, F5 reload must restore the candidate.

In `services/gameSerialize.js`:
- `serialize()`: emit `dealer_sync_candidate: { dealerIdx, syncCardNumber, points }` or null
- `deserialize()`: restore the field, reconstructing `syncCard` from `numberToCard(syncCardNumber)`

Use the existing `cardToNumber` / `numberToCard` helpers.

## Testing strategy

New test groups in existing files (no new test files):

### `tests/Game.test.js`

```
describe("3-player support", () => {
  it("scoringSlot maps each player 1:1 in 3p")
  it("scoringSlot ignores parejas flag in 3p (config.type=parejas + 3 users)")
  it("isParejasMode returns false for 3p even with type=parejas")
  it("threshold rule for 3p assigns 14 to dealer (idx 2), 13 to others")
  it("3p color assignment: dealer (idx 2) gets 🟢 not 🟡")
})

describe("mata_mesa", () => {
  // Helper: setup state after a new-deck deal with sync points.
  it("on + first-play caída → subtracts sync points from dealer")
  it("off + first-play caída → dealer keeps points, player still gets caída")
  it("on + no caída on first play → candidate cleared, sync points stay")
  it("on + caída on second play of deck → no mata_mesa")
  it("on + mid-deck deal → no candidate set, no mata_mesa")
  it("clamps to 0 when dealer has fewer points than sync amount")
  it("subtracts from team slot in parejas (partner is penalized too)")
  it("subtracts from individual slot in 3p")
})

describe("scoringSlot consolidation", () => {
  it("increase_points uses scoringSlot in all modes")
  it("took accumulation uses scoringSlot in all modes")
  it("kill stat attribution uses scoringSlot in all modes")
})
```

### `tests/i18n_game.test.js`

Add a 3-player render test asserting:
- 3 player lines render in individual block
- Colors are 🔴🔵🟢, no 🟡
- Dealer (last in users[]) gets 🟢

### `tests/persistence.test.js`

```
describe("_dealerSyncCandidate persistence", () => {
  it("serializes when set (between deck-start and first play)")
  it("round-trips through serialize/deserialize")
  it("deserializes as null when absent")
})
```

Target total: ~74 tests passing after the change (60 today + ~14 new).

### Manual smoke test post-deploy

1. Create a 3p game in a test group.
2. Verify `/estado` shows 🔴🔵🟢, no 🟡.
3. End-of-deck with dealer near threshold 14 → confirm no kill until 14, not 13.
4. Activate `mata_mesa=on` in a 4p game, have first player caída the dealer at deck start → see `🔄 Mata mesa: -X pts al dealer`.
5. Repeat with `mata_mesa=off` → dealer keeps points, no mata_mesa message.

## Risks

- Groups that today have `config.type=parejas` but play 2p/3p games get a behavior change: rendering switches from the (broken) parejas renderer to the individual renderer, and `scoringSlot` no longer collapses indices. **Both changes are bug fixes**, not regressions — the old behavior produced incorrect points and renders for those configs.
- `_dealerSyncCandidate` adds one new piece of state to serialize. A bot restart while a deck just started but no card has been played would otherwise lose the candidate. Test covers that.

## File touch list

```
class/Game.js            (helpers, callsites, mata_mesa block, 3p threshold fix)
services/gameSerialize.js (_dealerSyncCandidate round-trip)
lang/es.js               (mata_mesa_msg)
lang/en.js               (mata_mesa_msg)
lang/pt.js               (mata_mesa_msg)
tests/Game.test.js       (new test groups: 3p, mata_mesa, scoring consolidation)
tests/i18n_game.test.js  (3p render test)
tests/persistence.test.js (candidate round-trip)
```

No new files. No deletions. No Dockerfile changes. No DB migrations.
