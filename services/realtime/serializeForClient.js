/**
 * Pure projection Game → per-viewer JSON state (SP1 spec, "Estado
 * por-viewer"). No I/O, no mutation: given a GameSession and the viewer's
 * userId it returns the snapshot that viewer is allowed to see.
 *
 * Information-hiding invariant: rivals expose only `cardCount`; the real
 * hand goes solely to the seat's owner in `you.hand`. This function runs
 * once per viewer at every broadcast, so the hiding is enforced here, not
 * at the transport.
 */

const STARTBY_SENTINEL = "Start_By";

/** Minimal client card shape. Drops `number`; keeps `position` for the
 *  mesa layout (10 slots indexed by position) and table rendering. */
function cardToClient(card) {
  if (card == null) return null;
  return { value: card.value, type: card.type, position: card.position };
}

/**
 * Locate the engine User backing a seat. Seats are keyed by userId
 * (human) / synthetic id (cpu) because the engine rotates `game.users[]`
 * every deck (push(shift())) — so the seat's index is NOT the user's
 * current index into game.users.
 */
function userForSeat(game, seat) {
  const idx = game.get_user_index(seat.userId);
  if (idx < 0) return { user: null, index: -1 };
  return { user: game.users[idx], index: idx };
}

/**
 * Whether the dealer currently holds the Start_By sentinel (the deck just
 * shuffled and someone must pick direction 1/4). In that state the actor
 * up is the dealer, not game.users[game.player].
 */
function isStartByState(game) {
  const last = game.users[game.users.length - 1];
  return !!(last && Array.isArray(last.cards) && last.cards[0] === STARTBY_SENTINEL);
}

/** The engine index of whoever is up to act right now. */
function actorIndex(game) {
  if (isStartByState(game)) return game.users.length - 1;
  return game.player;
}

/** Map an engine user index back to a seat index by matching userId. */
function seatIndexForUserId(session, userId) {
  for (const seat of session.seats) {
    if (seat && String(seat.userId) === String(userId)) return seat.index;
  }
  return -1;
}

function serializeForClient(session, viewerUserId) {
  const game = session.game;
  const playing = session.status === "playing" || session.status === "finished";
  const startBy = playing ? isStartByState(game) : false;

  const seats = session.seats.map((seat) => {
    const base = {
      index: seat.index,
      kind: seat.kind,
      name: seat.name,
      connected: seat.connected,
    };
    if (seat.kind === "cpu") base.difficulty = seat.difficulty;

    if (!playing) {
      // Lobby: no per-deck state yet.
      base.cardCount = 0;
      base.points = 0;
      base.took = 0;
      base.sang = null;
      base.color = "";
      return base;
    }

    const { user, index } = userForSeat(game, seat);
    if (!user) {
      base.cardCount = 0;
      base.points = 0;
      base.took = 0;
      base.sang = null;
      base.color = "";
      return base;
    }
    const slot = game.scoringSlot(index);
    // The dealer's Start_By sentinel must not render as "1 card".
    const handIsStartBy =
      Array.isArray(user.cards) && user.cards[0] === STARTBY_SENTINEL;
    base.cardCount = handIsStartBy ? 0 : (user.cards ? user.cards.length : 0);
    base.points = game.points[slot] || 0;
    base.took = game.took[slot] || 0;
    base.sang =
      user.sing && user.sing.active && user.sing.name && user.sing.name !== "No cantó"
        ? user.sing.name
        : null;
    // A declared canto killed by a caída (mata_canto) — shown struck/dead.
    base.sangDead =
      user.sing && user.sing.killed && user.sing.name && user.sing.name !== "No cantó"
        ? user.sing.name
        : null;
    // color only meaningful in individual mode; parejas leaves it "".
    base.color = game.isParejasMode() ? "" : user.color || "";
    return base;
  });

  const state = {
    code: session.code,
    status: session.status,
    config: { ...game.config },
    seats,
  };

  if (!playing) {
    state.table = [null, null, null, null, null, null, null, null, null, null];
    state.lastCardPlayed = null;
    state.turnSeat = null;
    state.dealerSeat = null;
    state.lastHand = false;
    state.you = viewerSeatStub(session, viewerUserId);
    state.lastEvent = session.lastEvent || null;
    return state;
  }

  state.table = game.table.map(cardToClient);
  state.lastCardPlayed = cardToClient(game.last_card_played);

  const dealerUser = game.users[game.dealerIdx()];
  state.dealerSeat = dealerUser ? seatIndexForUserId(session, dealerUser.id_user) : null;

  const actorUser = game.users[actorIndex(game)];
  state.turnSeat = actorUser ? seatIndexForUserId(session, actorUser.id_user) : null;

  state.lastHand = !!game.last_hand;
  state.you = buildYou(session, game, viewerUserId, startBy);
  state.lastEvent = session.lastEvent || null;
  // Deck-start deal sequence (draw order + per-card pegado) for the client's
  // "pegar en mesa" animation. Null except on the broadcast right after a deal.
  state.lastDeal = session.lastDeal || null;

  if (session.status === "finished") {
    state.winner = session.winner || null;
  }

  return state;
}

/** `you` for the lobby (no hand yet) or for a viewer who isn't seated. */
function viewerSeatStub(session, viewerUserId) {
  const seatIdx = seatIndexForUserId(session, viewerUserId);
  return { seat: seatIdx >= 0 ? seatIdx : null, hand: [], canSing: null };
}

/**
 * The viewer's private view: their full hand (or the startBy picker) plus
 * their declarable canto. A spectator (not seated) gets an empty hand.
 */
function buildYou(session, game, viewerUserId, startBy) {
  const seatIdx = seatIndexForUserId(session, viewerUserId);
  if (seatIdx < 0) return { seat: null, hand: [], canSing: null };

  const idx = game.get_user_index(viewerUserId);
  if (idx < 0) return { seat: seatIdx, hand: [], canSing: null };
  const user = game.users[idx];

  // get_player_cards returns ["Start_By"] when this user must choose the
  // deal direction; otherwise it returns the hand, with the user's
  // declarable Sings object appended as a trailing element when present.
  const raw = game.get_player_cards(viewerUserId);
  if (raw.length === 1 && raw[0] === STARTBY_SENTINEL) {
    return { seat: seatIdx, hand: { type: "startBy" }, canSing: cantoOf(user) };
  }

  const hand = raw
    .filter((c) => c && typeof c === "object" && c.type !== undefined && c.position !== undefined)
    .map(cardToClient);

  return { seat: seatIdx, hand, canSing: cantoOf(user) };
}

/** The viewer's declarable canto, or null. A canto is declarable when it
 *  has a value and hasn't been declared yet (sing.active === false). */
function cantoOf(user) {
  if (!user || !user.sing) return null;
  if (user.sing.value > 0 && !user.sing.active) {
    return { name: user.sing.name, value: user.sing.value };
  }
  return null;
}

module.exports = serializeForClient;
module.exports.serializeForClient = serializeForClient;
