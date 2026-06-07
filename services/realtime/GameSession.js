const Game = require("../../class/Game");
const User = require("../../class/User");
const Config = require("../../class/Config");

const MAX_SEATS = 4;
const STARTBY_SENTINEL = "Start_By";
const CPU_LABELS = { easy: "🤖 Fácil", medium: "🤖 Medio", pro: "🤖 Pro" };

/**
 * A WebApp game session: a `Game` engine instance wrapped in the uniform
 * seat model from the SP1 spec. A seat is human (bound to a userId / live
 * socket) or cpu (the server auto-plays it). The engine already treats
 * both identically — a CPU is just a User with `cpu_difficulty` set.
 *
 * This class owns the session lifecycle and delegates every game mutation
 * to the engine; it does NOT run the WS server, turn-loop timers, or CPU
 * auto-stepping (T3/T4). The WS layer drives those by calling play()/sing()
 * and broadcasting serializeForClient() after each call.
 */
class GameSession {
  /**
   * @param {Object} opts
   * @param {String} opts.code - Session code (e.g. "CAIDA-7K2P").
   * @param {Object} opts.host - { userId, name } of the creator (seat 0).
   * @param {Config} [opts.config] - Engine config; defaults to Clásico.
   */
  constructor({ code, host, config } = {}) {
    if (!code) throw new Error("GameSession requires a code");
    if (!host || host.userId == null) throw new Error("GameSession requires a host { userId, name }");
    this.code = code;
    this.status = "lobby";
    this.config = config || new Config(require("../../lang/game_modes_es")[1]);
    this.game = new Game(code, this.config);
    this.seats = [];
    this.hostUserId = String(host.userId);
    // Transient hint for serializeForClient → lastEvent, refreshed on every
    // play. null between plays.
    this.lastEvent = null;
    // Set on a deck-start deal: the draw-order sequence + per-card pegado, so
    // the client can animate the "pegar en mesa" card by card with +N popups.
    // Cleared on the next play. `id` lets the client animate each deal once.
    this.lastDeal = null;
    this._dealSeq = 0;
    // Final standings, set when the engine reports a win (status finished).
    this.winner = null;

    this.addHuman({ userId: host.userId, name: host.name });
  }

  /** @returns {Boolean} */
  isLobby() {
    return this.status === "lobby";
  }

  /** Seat lookup by userId (human or synthetic cpu id). */
  seatOf(userId) {
    const id = String(userId);
    return this.seats.find((s) => String(s.userId) === id) || null;
  }

  /**
   * Seat a human at the next free index and join them to the engine.
   * Lobby-only. Returns the new seat.
   */
  addHuman({ userId, name }) {
    this._assertLobby();
    if (this.seats.length >= MAX_SEATS) throw sessionError("session_full", "La mesa está llena");
    if (this.seatOf(userId)) throw sessionError("already_joined", "Ya estás en la mesa");
    const index = this.seats.length;
    const user = new User({
      id_user: String(userId),
      first_name: name || "Jugador",
      last_name: "",
      username: null,
      is_banned: false,
    });
    this.game.join(user);
    const seat = {
      index,
      kind: "human",
      userId: String(userId),
      name: user.first_name,
      connected: true,
    };
    this.seats.push(seat);
    return seat;
  }

  /**
   * Fill the next free seat with a CPU. Host + lobby only (caller enforces
   * host; we enforce lobby + capacity). The synthetic id mirrors the bot's
   * scheme (`cpu_<code>_<slot>`) so several sessions can host their own
   * Pro/Medio/Fácil without aliasing, and stats fold into the shared
   * cpu_<difficulty> rows via User.statsId().
   */
  addCpu(difficulty) {
    this._assertLobby();
    if (this.seats.length >= MAX_SEATS) throw sessionError("session_full", "La mesa está llena");
    if (!["easy", "medium", "pro"].includes(difficulty)) {
      throw sessionError("bad_difficulty", "Dificultad inválida");
    }
    // Slot id unique within the session even after removeCpu shrinks the
    // array — derive from the max existing cpu slot, not seats.length.
    const existing = this.seats
      .filter((s) => s.kind === "cpu")
      .map((s) => {
        const m = /^cpu_.+_(\d+)$/.exec(s.userId || "");
        return m ? Number(m[1]) : 0;
      });
    const nextSlot = existing.length ? Math.max(...existing) + 1 : 1;
    const cpuId = `cpu_${this.code}_${nextSlot}`;
    const index = this.seats.length;
    const cpu = new User({
      id_user: cpuId,
      first_name: CPU_LABELS[difficulty] || "🤖 CPU",
      last_name: "",
      username: null,
      is_banned: false,
      cpu_difficulty: difficulty,
    });
    this.game.join(cpu);
    const seat = {
      index,
      kind: "cpu",
      userId: cpuId,
      name: cpu.first_name,
      difficulty,
      connected: true,
    };
    this.seats.push(seat);
    return seat;
  }

  /**
   * Remove the CPU at a given seat index. Host + lobby only. Re-indexes the
   * surviving seats so indices stay contiguous (0..n-1) and keep matching
   * game.users[] order (the engine relies on join order for play order).
   */
  removeCpu(seatIndex) {
    this._assertLobby();
    const seat = this.seats[seatIndex];
    if (!seat || seat.kind !== "cpu") throw sessionError("no_such_cpu", "Ese asiento no es un CPU");
    const gi = this.game.get_user_index(seat.userId);
    if (gi >= 0) this.game.users.splice(gi, 1);
    this.seats.splice(seatIndex, 1);
    this._reindexSeats();
  }

  /**
   * Deal the first deck. Host + lobby + ≥2 seats only. Calls game.shuffle()
   * which leaves the dealer holding the Start_By sentinel; whoever sits at
   * the dealer seat then picks direction via play() (the protocol models
   * the 1/4 choice as a play on the startBy hand).
   *
   * @param {1|4} [startBy] - Optional eager direction: when given, the deck
   *   is dealt immediately instead of waiting for the dealer's pick. Useful
   *   for solo-vs-CPU flows / tests.
   */
  start(startBy) {
    this._assertLobby();
    if (this.seats.length < 2) throw sessionError("not_enough_players", "Faltan jugadores (mínimo 2)");
    this.game.shuffle();
    this.status = "playing";
    this.lastEvent = null;
    if (startBy === 1 || startBy === 4) {
      return this._deal(startBy);
    }
    return null;
  }

  /**
   * Apply a play for `viewerUserId`. Two cases:
   *   - startBy state: the dealer's "hand" is the sentinel → `arg` is the
   *     direction (1 or 4) and we deal the deck.
   *   - normal: `arg` is the card index into the player's hand.
   * Only the user who is up may act; otherwise a not_your_turn error.
   */
  play(viewerUserId, arg) {
    this._assertPlaying();
    const game = this.game;
    const id = String(viewerUserId);

    if (this._isStartByState()) {
      const dealer = game.users[game.users.length - 1];
      if (!dealer || String(dealer.id_user) !== id) {
        throw sessionError("not_your_turn", "No es tu turno de elegir dirección");
      }
      const dir = arg === 4 ? 4 : 1;
      return this._deal(dir);
    }

    const current = game.users[game.player];
    if (!current || String(current.id_user) !== id) {
      throw sessionError("not_your_turn", "No es tu turno");
    }
    // The pegar-en-mesa animation belongs only to the deal broadcast.
    this.lastDeal = null;
    const result = game.play_card(id, arg);
    return this._afterEngineResult(result, game.player, "play");
  }

  /**
   * Declare the viewer's canto. The engine validates ownership and that a
   * canto exists; a no-op declaration just returns its message string.
   */
  sing(viewerUserId) {
    this._assertPlaying();
    this.lastDeal = null;
    const id = String(viewerUserId);
    const seat = this.seatOf(id);
    if (!seat) throw sessionError("not_seated", "No estás en la mesa");
    const idx = this.game.get_user_index(id);
    const card = idx >= 0 ? this.game.users[idx] : null;
    const response = this.game.sing(id);
    if (card && card.sing && card.sing.active) {
      this.lastEvent = { kind: "canto", seat: seat.index, card: null };
    }
    return response;
  }

  /**
   * A participant leaves. Behaviour depends on status (SP1 minimum):
   *   - Lobby, host leaves → the session is closed (caller should remove it
   *     from the store and emit session:ended). We flag it via status.
   *   - Lobby, non-host leaves → free their seat.
   *   - Mid-game → the seat goes connected:false (auto-skip on their turn is
   *     T4); the seat is NOT removed because per-index engine state would
   *     misalign. Reconnect with the same userId resumes the seat.
   * @returns {{ closed: boolean, reason?: string }}
   */
  leave(viewerUserId) {
    const id = String(viewerUserId);
    const seat = this.seatOf(id);
    if (!seat) return { closed: false };

    if (this.status === "lobby") {
      if (id === this.hostUserId) {
        this.status = "finished";
        this.winner = null;
        return { closed: true, reason: "host_left" };
      }
      const gi = this.game.get_user_index(id);
      if (gi >= 0) this.game.users.splice(gi, 1);
      const si = this.seats.findIndex((s) => String(s.userId) === id);
      if (si >= 0) this.seats.splice(si, 1);
      this._reindexSeats();
      return { closed: false };
    }

    // Mid-game (or finished): mark disconnected, keep the seat.
    if (seat.kind === "human") seat.connected = false;
    return { closed: false };
  }

  // ── internals ───────────────────────────────────────────────────────

  _isStartByState() {
    const last = this.game.users[this.game.users.length - 1];
    return !!(last && Array.isArray(last.cards) && last.cards[0] === STARTBY_SENTINEL);
  }

  /** Deal a brand-new deck in the chosen direction and fold the result. */
  _deal(startBy) {
    const dealerIdx = this.game.users.length - 1;
    const result = this.game.handing_out_cards(startBy);
    this.lastEvent = null;
    this.lastDeal = this._computeLastDeal(startBy);
    return this._afterEngineResult(result, dealerIdx, "play");
  }

  /**
   * Reconstruct the deck-start deal for client animation. The engine doesn't
   * change — we read what it already produced: `game.table_order` is the
   * draw-order values (e.g. "5 -> 3 -> 2 -> 6"), and a card "pega" when its
   * value matches the predicted sequence step (4→3→2→1 for startBy 4, else
   * 1→2→3→4). Suits come from the mesa (a dealt value V sits at position V-1).
   * Purely additive: no behavior change, just exposing the order + pegado.
   */
  _computeLastDeal(startBy) {
    const game = this.game;
    const drawValues = String(game.table_order || "")
      .split(/[^0-9]+/)
      .filter((s) => s.length)
      .map(Number);
    if (drawValues.length === 0) return null;
    const desc = startBy === 4;
    const seq = drawValues.map((value, i) => {
      const predicted = desc ? startBy - i : startBy + i;
      const onTable = game.table[value - 1];
      return {
        value,
        type: onTable ? onTable.type : null,
        position: value - 1,
        pegado: value === predicted ? predicted : 0,
      };
    });
    this._dealSeq += 1;
    return { id: this._dealSeq, direction: startBy, seq };
  }

  /**
   * Normalise an engine return into a session-level result and update
   * status + lastEvent. The engine returns a `{finished, response}` object
   * on a win and a plain string otherwise.
   */
  _afterEngineResult(result, actorIndex, defaultKind) {
    const game = this.game;
    const seat = this._seatIndexForGameIndex(actorIndex);
    const card = game.last_card_played
      ? { value: game.last_card_played.value, type: game.last_card_played.type, position: game.last_card_played.position }
      : null;

    let kind = defaultKind;
    if (game._lastCaida) kind = "caida";
    else if (game._lastCleanTable) kind = "mesa_limpia";
    this.lastEvent = { kind, seat, card };

    if (result && typeof result === "object" && result.finished) {
      this.status = "finished";
      // Capture standings now: kill() does NOT record the winner on the
      // Game (it leaves game.player untouched and zeroes game.decks), so
      // we derive the winner from which scoring slot crossed the
      // threshold while game.points is still intact.
      this.winner = this._buildWinner();
      return { finished: true, response: result.response };
    }
    return { finished: false, response: result };
  }

  /**
   * Standings snapshot for a finished game. The winning slot is the one
   * whose points reached config.points; winner.seat is the (first) seat
   * mapped to that slot (parejas folds two seats into one slot).
   */
  _buildWinner() {
    const game = this.game;
    const threshold = game.config.points;
    let winnerSlot = -1;
    for (let i = 0; i < game.points.length; i++) {
      if ((game.points[i] || 0) >= threshold) {
        winnerSlot = i;
        break;
      }
    }
    const standings = this.seats.map((seat) => {
      const gi = game.get_user_index(seat.userId);
      const slot = gi >= 0 ? game.scoringSlot(gi) : seat.index;
      return {
        seat: seat.index,
        name: seat.name,
        slot,
        points: game.points[slot] || 0,
      };
    });
    let winnerSeat = null;
    const winnerEntry = standings.find((s) => s.slot === winnerSlot);
    if (winnerEntry) winnerSeat = winnerEntry.seat;
    // Drop the internal slot field from the public standings shape.
    const publicStandings = standings
      .map((s) => ({ seat: s.seat, name: s.name, points: s.points }))
      .sort((a, b) => b.points - a.points);
    return { seat: winnerSeat, standings: publicStandings };
  }

  /** Seat index for an engine users[] index, matched by userId (the engine
   *  rotates users[] every deck so positions are not stable). */
  _seatIndexForGameIndex(gameIndex) {
    const u = this.game.users[gameIndex];
    if (!u) return null;
    const seat = this.seatOf(u.id_user);
    return seat ? seat.index : null;
  }

  _reindexSeats() {
    this.seats.forEach((s, i) => (s.index = i));
  }

  _assertLobby() {
    if (this.status !== "lobby") throw sessionError("not_in_lobby", "La partida ya empezó");
  }

  _assertPlaying() {
    if (this.status !== "playing") {
      throw sessionError("not_playing", "La partida no está en curso");
    }
  }
}

/** Build an Error carrying a machine-readable `code` so the WS layer can
 *  emit session:error { code, message } without string-matching. */
function sessionError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

module.exports = GameSession;
module.exports.MAX_SEATS = MAX_SEATS;
module.exports.sessionError = sessionError;
