/**
 * Acompañante session: one real-life table being scored from the host's phone.
 * Pure model — no sockets, no DB. The WS layer (companionWs) calls these
 * methods and persists `toJSON()`; finished games are written from
 * `buildRecord()`.
 *
 * Seats are 4 fixed positions around the table (see scoring.js): 0 bottom
 * (the host by default), 1 right, 2 top, 3 left. Each is null (empty) or
 * { userId | null, name, guest }. Guests are people without the app — the
 * host types their name; they get no stats. The host doesn't have to play:
 * unseated, they just referee (keep score) and get no stats either.
 *
 * Lifecycle: lobby → playing → finished → (rematch) playing | lobby. Reaching
 * the target doesn't finish on its own: it leaves a pending win the host
 * confirms (or undoes — a mis-tap on a Trivilín shouldn't be saved as a
 * result).
 */
const {
  POSITIONS,
  DEFAULT_CONFIG,
  companionError,
  sanitizeCompanionConfig,
  opPoints,
  summarize,
  winningSlot,
  slotOf,
} = require("./scoring");

const MAX_NAME = 32;

/** What the host can do once a game is saved (see rematch). */
const REMATCH_MODES = Object.freeze(["again", "winners", "lobby"]);

function cleanName(name) {
  const s = String(name == null ? "" : name)
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, MAX_NAME);
}

class CompanionSession {
  /**
   * @param {Object} opts
   * @param {String} opts.code - "MESA-XXXX"
   * @param {{userId:(string|number), name:string}} opts.host - creator; sits at
   *   position 0 unless `hostSeated` is false (referee: scores without playing)
   * @param {Object} [opts.config] - partial config (sanitized here)
   * @param {() => number} [opts.now] - clock (tests)
   * @param {Boolean} [opts.hostSeated=true]
   */
  constructor({ code, host, config, now, hostSeated = true } = {}) {
    if (!code) throw new Error("CompanionSession requires a code");
    if (!host || host.userId == null) throw new Error("CompanionSession requires a host");
    this._now = now || Date.now;
    this.code = code;
    this.hostUserId = String(host.userId);
    this.hostName = cleanName(host.name) || "Anfitrión";
    this.status = "lobby";
    this.config = { ...DEFAULT_CONFIG, ...sanitizeCompanionConfig(config) };
    this.seats = new Array(POSITIONS).fill(null);
    if (hostSeated) this.seats[0] = this._hostSeat();
    this.ops = [];
    this.opSeq = 0;
    this.pendingWinSlot = null;
    this.result = null;
    this.gameNo = 1;
    this.createdAt = this._now();
    this.updatedAt = this.createdAt;
    this.startedAt = null;
    this.finishedAt = null;
  }

  // ── lookups ─────────────────────────────────────────────────────────

  isHost(userId) {
    return userId != null && String(userId) === this.hostUserId;
  }

  /** Position of a (non-guest) user, or -1. */
  positionOf(userId) {
    if (userId == null) return -1;
    const id = String(userId);
    return this.seats.findIndex((s) => s && s.userId === id);
  }

  seatedCount() {
    return this.seats.filter(Boolean).length;
  }

  summary() {
    return summarize({ seats: this.seats, ops: this.ops, config: this.config });
  }

  // ── lobby ───────────────────────────────────────────────────────────

  /** Seat a user at the first free position; a seated user just gets theirs. */
  join({ userId, name }) {
    const existing = this.positionOf(userId);
    if (existing >= 0) return existing;
    this._assertLobby();
    const pos = this.seats.findIndex((s) => s === null);
    if (pos < 0) throw companionError("table_full", "La mesa está llena");
    this.seats[pos] = { userId: String(userId), name: cleanName(name) || "Jugador", guest: false };
    this._touch();
    return pos;
  }

  /** Swap two positions (either may be empty) — "ordenarse como están sentados". */
  swap(a, b) {
    this._assertLobby();
    this._assertPosition(a);
    this._assertPosition(b);
    if (a === b) return;
    [this.seats[a], this.seats[b]] = [this.seats[b], this.seats[a]];
    this._touch();
  }

  /** Someone at the real table without the app: name only, no stats. */
  addGuest(name, position) {
    this._assertLobby();
    const clean = cleanName(name);
    if (!clean) throw companionError("bad_name", "Escribe un nombre");
    let pos = position;
    if (pos == null) {
      pos = this.seats.findIndex((s) => s === null);
      if (pos < 0) throw companionError("table_full", "La mesa está llena");
    } else {
      this._assertPosition(pos);
      if (this.seats[pos]) throw companionError("seat_taken", "Ese puesto está ocupado");
    }
    this.seats[pos] = { userId: null, name: clean, guest: true };
    this._touch();
    return pos;
  }

  /** Free a position. On the host's own seat this means "no juego, solo anoto". */
  kick(position) {
    this._assertLobby();
    this._assertPosition(position);
    if (!this.seats[position]) throw companionError("empty_seat", "Ese puesto está vacío");
    this.seats[position] = null;
    this._touch();
  }

  /** The host takes a seat again (stops refereeing). No position → the first
   *  free one, bottom first. @returns {number} the position taken */
  sitHost(position) {
    this._assertLobby();
    if (this.positionOf(this.hostUserId) >= 0) {
      throw companionError("already_seated", "Ya estás sentado");
    }
    let pos = position;
    if (pos == null) {
      pos = this.seats.findIndex((s) => s === null);
      if (pos < 0) throw companionError("table_full", "La mesa está llena");
    } else {
      this._assertPosition(pos);
      if (this.seats[pos]) throw companionError("seat_taken", "Ese puesto está ocupado");
    }
    this.seats[pos] = this._hostSeat();
    this._touch();
    return pos;
  }

  setConfig(partial) {
    this._assertLobby();
    this.config = { ...this.config, ...sanitizeCompanionConfig(partial) };
    this._touch();
  }

  start() {
    this._assertLobby();
    if (this.seatedCount() < 2) {
      throw companionError("not_enough_players", "Faltan jugadores (mínimo 2)");
    }
    this._resetScore();
    this.status = "playing";
    this.startedAt = this._now();
    this._touch();
  }

  // ── scoring ─────────────────────────────────────────────────────────

  /**
   * Record one thing that happened at the table.
   * @param {{kind:string, seat:number, value?:number, canto?:string}} input
   * @returns {Object} the stored record (with id + points)
   */
  record({ kind, seat, value, canto } = {}) {
    this._assertPlaying();
    if (this.pendingWinSlot != null) {
      throw companionError("pending_win", "Alguien ya llegó a la meta: confirma o deshaz");
    }
    this._assertPosition(seat);
    if (!this.seats[seat]) throw companionError("empty_seat", "Ese puesto está vacío");
    const op = { kind, seat };
    if (value != null) op.value = Number(value);
    if (canto != null) op.canto = String(canto);
    op.points = opPoints(op, this.config);
    op.id = ++this.opSeq;
    op.at = this._now();
    this.ops.push(op);
    this._refreshPendingWin();
    this._touch();
    return op;
  }

  /** Remove the last record, or a specific one by id. */
  undo(opId) {
    this._assertPlaying();
    if (this.ops.length === 0) throw companionError("nothing_to_undo", "No hay nada que deshacer");
    if (opId == null) {
      this.ops.pop();
    } else {
      const idx = this.ops.findIndex((o) => o.id === Number(opId));
      if (idx < 0) throw companionError("no_such_op", "Ese registro ya no existe");
      this.ops.splice(idx, 1);
    }
    this._refreshPendingWin();
    this._touch();
  }

  /** The host confirms the win that reaching the target left pending. */
  confirmWin() {
    this._assertPlaying();
    if (this.pendingWinSlot == null)
      throw companionError("no_pending_win", "Nadie ha llegado a la meta");
    this._finish(this.pendingWinSlot, "target");
  }

  /** "Cerrar" by hand: the host picks the winner; the score is what's recorded. */
  closeWithWinner(slot) {
    this._assertPlaying();
    const s = Number(slot);
    if (!this.summary().slots.some((x) => x.slot === s)) {
      throw companionError("bad_slot", "Ganador inválido");
    }
    this._finish(s, "manual");
  }

  /**
   * Next game at the same table, once the result is saved:
   *  - "again"   (todos otra vez): same seats, starts right away.
   *  - "winners" (siguen los ganadores): the winners keep their seats and
   *    everyone else stands up; back to the lobby to seat the challengers.
   *  - "lobby"   (nueva partida): back to the lobby with everyone seated, to
   *    change seats, people or rules.
   * @param {("again"|"winners"|"lobby")} [mode="lobby"]
   */
  rematch(mode = "lobby") {
    if (this.status !== "finished") throw companionError("not_finished", "La partida no terminó");
    if (!REMATCH_MODES.includes(mode)) throw companionError("bad_mode", "Opción inválida");
    if (mode === "again" && this.seatedCount() < 2) {
      throw companionError("not_enough_players", "Faltan jugadores (mínimo 2)");
    }
    // Who won is taken from the saved result, not recomputed: someone may
    // have left since, which can change parejas ↔ individual.
    const winners = (this.result && this.result.winners) || [];
    if (mode === "winners") {
      this.seats = this.seats.map((s, p) => (s && winners.includes(p) ? s : null));
    }
    this._resetScore();
    this.gameNo += 1;
    if (mode === "again") {
      this.status = "playing";
      this.startedAt = this._now();
    } else {
      this.status = "lobby";
      this.startedAt = null;
    }
    this._touch();
  }

  /**
   * A non-host leaves. In the lobby or after the game their seat frees up; in
   * the middle of a game they stay seated (the scorer keeps scoring them) and
   * only stop watching. The host closes the table instead (discard).
   * @returns {{left:boolean}}
   */
  leave(userId) {
    if (this.isHost(userId)) {
      throw companionError("host_cannot_leave", "El anfitrión cierra la mesa en vez de salir");
    }
    const pos = this.positionOf(userId);
    if (pos < 0 || this.status === "playing") return { left: false };
    this.seats[pos] = null;
    this._touch();
    return { left: true };
  }

  // ── results ─────────────────────────────────────────────────────────

  /** What gets saved for a finished game: the table result + one row per seated person. */
  buildRecord() {
    if (this.status !== "finished" || !this.result) {
      throw companionError("not_finished", "La partida no terminó");
    }
    const sum = this.summary();
    const players = [];
    this.seats.forEach((seat, position) => {
      if (!seat) return;
      const tally = sum.perSeat[position];
      const slot = slotOf(position, sum.mode);
      players.push({
        position,
        userId: seat.guest ? null : seat.userId,
        name: seat.name,
        guest: !!seat.guest,
        slot,
        won: slot === this.result.winnerSlot,
        points: tally.points,
        caidas: tally.caidas,
        cantos: tally.cantos,
        mesas: tally.mesas,
        manual: tally.manual,
      });
    });
    return {
      code: this.code,
      gameNo: this.gameNo,
      hostUserId: this.hostUserId,
      mode: sum.mode,
      target: this.config.points,
      config: { ...this.config },
      ops: this.ops.map((o) => ({ ...o })),
      totals: { ...this.result.totals },
      winnerSlot: this.result.winnerSlot,
      endedBy: this.result.endedBy,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      players,
    };
  }

  // ── projections ─────────────────────────────────────────────────────

  /**
   * Per-viewer state. Everyone sees the same board (nothing is hidden at a
   * real table); `you` says who's looking. Telegram ids never leave the server.
   * @param {(string|number|null)} viewerUserId
   * @param {Set<string>} [online] - user ids with a live socket on this table
   */
  toClient(viewerUserId, online = new Set()) {
    const sum = this.summary();
    const seats = this.seats.map((seat, position) => {
      if (!seat) return null;
      const t = sum.perSeat[position];
      return {
        position,
        name: seat.name,
        guest: !!seat.guest,
        isHost: !seat.guest && seat.userId === this.hostUserId,
        online: !seat.guest && online.has(seat.userId),
        slot: slotOf(position, sum.mode),
        points: t.points,
        caidas: t.caidas,
        cantos: Object.values(t.cantos).reduce((a, b) => a + b, 0),
        mesas: t.mesas,
      };
    });
    const pos = this.positionOf(viewerUserId);
    const hostPos = this.positionOf(this.hostUserId);
    return {
      code: this.code,
      status: this.status,
      gameNo: this.gameNo,
      config: { ...this.config },
      target: this.config.points,
      mode: sum.mode,
      seats,
      slots: sum.slots,
      ops: this.ops.map((o) => ({ ...o })),
      pendingWin: this.pendingWinSlot != null ? { slot: this.pendingWinSlot } : null,
      result: this.result ? { ...this.result, totals: { ...this.result.totals } } : null,
      hostName: this.hostName,
      hostPosition: hostPos >= 0 ? hostPos : null,
      you: { position: pos >= 0 ? pos : null, isHost: this.isHost(viewerUserId) },
    };
  }

  toJSON() {
    return {
      v: 1,
      code: this.code,
      hostUserId: this.hostUserId,
      hostName: this.hostName,
      status: this.status,
      config: this.config,
      seats: this.seats,
      ops: this.ops,
      opSeq: this.opSeq,
      pendingWinSlot: this.pendingWinSlot,
      result: this.result,
      gameNo: this.gameNo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
    };
  }

  /** Rebuild a session persisted with toJSON(). */
  static fromJSON(data, { now } = {}) {
    const s = new CompanionSession({
      code: data.code,
      host: { userId: data.hostUserId, name: data.hostName },
      config: data.config,
      now,
    });
    s.status = data.status;
    s.config = { ...DEFAULT_CONFIG, ...(data.config || {}) };
    s.seats = Array.from({ length: POSITIONS }, (_, i) => (data.seats && data.seats[i]) || null);
    s.ops = Array.isArray(data.ops) ? data.ops : [];
    s.opSeq = Number(data.opSeq) || s.ops.reduce((m, o) => Math.max(m, o.id || 0), 0);
    s.pendingWinSlot = data.pendingWinSlot != null ? data.pendingWinSlot : null;
    s.result = data.result || null;
    s.gameNo = Number(data.gameNo) || 1;
    s.createdAt = data.createdAt || s.createdAt;
    s.updatedAt = data.updatedAt || s.createdAt;
    s.startedAt = data.startedAt || null;
    s.finishedAt = data.finishedAt || null;
    return s;
  }

  // ── internals ───────────────────────────────────────────────────────

  _finish(winnerSlot, endedBy) {
    const sum = this.summary();
    const totals = {};
    for (const s of sum.slots) totals[s.slot] = s.total;
    const won = sum.slots.find((s) => s.slot === winnerSlot);
    this.status = "finished";
    this.pendingWinSlot = null;
    this.finishedAt = this._now();
    this.result = {
      winnerSlot,
      endedBy,
      totals,
      mode: sum.mode,
      // Seat positions of the winner(s) — what "siguen los ganadores" keeps.
      winners: won ? [...won.positions] : [],
    };
    this._touch();
  }

  _resetScore() {
    this.ops = [];
    this.opSeq = 0;
    this.pendingWinSlot = null;
    this.result = null;
    this.finishedAt = null;
  }

  _hostSeat() {
    return { userId: this.hostUserId, name: this.hostName, guest: false };
  }

  _refreshPendingWin() {
    this.pendingWinSlot = winningSlot(this.summary().slots, Number(this.config.points));
  }

  _touch() {
    this.updatedAt = this._now();
  }

  _assertPosition(p) {
    if (!Number.isInteger(p) || p < 0 || p >= POSITIONS) {
      throw companionError("bad_position", "Puesto inválido");
    }
  }

  _assertLobby() {
    if (this.status !== "lobby") throw companionError("not_in_lobby", "La partida ya empezó");
  }

  _assertPlaying() {
    if (this.status !== "playing")
      throw companionError("not_playing", "La partida no está en curso");
  }
}

module.exports = CompanionSession;
module.exports.REMATCH_MODES = REMATCH_MODES;
