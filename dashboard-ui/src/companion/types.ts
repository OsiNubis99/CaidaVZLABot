// TypeScript mirror of CompanionSession#toClient (services/companion/
// CompanionSession.js). The server is the source of truth.

export type CompanionStatus = "lobby" | "playing" | "finished";
export type CompanionMode = "parejas" | "individual";

export const CANTO_KEYS = [
  "chiguire",
  "patrulla",
  "vigia",
  "registro",
  "maguaro",
  "registrico",
  "casa_chica",
  "casa_grande",
  "trivilin",
] as const;
export type CantoKey = (typeof CANTO_KEYS)[number];

// A type alias (not an interface) so it's assignable to the game form's
// index-signature GameConfig (interfaces get no implicit index signature).
export type CompanionConfig = {
  points: number;
  type: "parejas" | "individual";
  mesa: number;
  caida: number;
  ronda: number;
  chiguire: number;
  patrulla: number;
  vigia: number;
  registro: number;
  maguaro: number;
  registrico: number;
  casa_chica: number;
  casa_grande: number;
  trivilin: number;
};

/** Positions around the real table: 0 bottom, 1 right, 2 top, 3 left. */
export interface CompanionSeat {
  position: number;
  name: string;
  guest: boolean;
  /** Opaque per-table id (people with the app) — to pass them the referee role. */
  pid?: string;
  isHost: boolean;
  online: boolean;
  /** Scoring slot: team (0 = positions 0+2, 1 = 1+3) in parejas, else the position. */
  slot: number;
  /** This person's own contribution (stats). */
  points: number;
  caidas: number;
  cantos: number;
  mesas: number;
}

export interface CompanionSlot {
  slot: number;
  positions: number[];
  total: number;
}

export type OpKind = "caida" | "canto" | "mesa" | "puntos";

export interface CompanionOp {
  id: number;
  kind: OpKind;
  seat: number;
  value?: number;
  canto?: CantoKey | "ronda";
  points: number;
  at: number;
}

export interface CompanionResult {
  winnerSlot: number;
  endedBy: "target" | "manual";
  totals: Record<string, number>;
  mode?: CompanionMode;
  /** Seat positions of the winner(s). */
  winners?: number[];
}

/** After a saved game: everyone again (starts now), winners stay (the rest
 *  stand up), or back to the lobby to reorganize. */
export type RematchMode = "again" | "winners" | "lobby";

/** Someone waiting to play the next game (FIFO). */
export interface QueueEntry {
  qid: number;
  name: string;
  /** Lined up by the referee: no app. */
  guest: boolean;
  pid?: string;
  online: boolean;
  you: boolean;
}

/** Connected, not seated, not the referee, not in line. */
export interface Spectator {
  pid: string;
  name: string;
  you: boolean;
}

export interface CompanionState {
  code: string;
  status: CompanionStatus;
  gameNo: number;
  config: CompanionConfig;
  target: number;
  mode: CompanionMode;
  seats: (CompanionSeat | null)[];
  slots: CompanionSlot[];
  ops: CompanionOp[];
  pendingWin: { slot: number } | null;
  result: CompanionResult | null;
  /** The referee (árbitro): the one who scores. */
  hostName: string;
  hostPosition: number | null;
  hostOnline: boolean;
  queue: QueueEntry[];
  spectators: Spectator[];
  you: {
    position: number | null;
    isHost: boolean;
    /** 1-based place in line, or null. */
    queued: number | null;
    /** ms until you may take the referee role over (0 = now); null = can't. */
    claimInMs: number | null;
  };
}

/** A record the scorer adds (server computes the points). */
export interface RecordInput {
  kind: OpKind;
  seat: number;
  value?: number;
  canto?: CantoKey | "ronda";
}

export interface CompanionErrorPayload {
  code: string;
  message: string;
}

export type EndedReason = "discarded" | "kicked" | "expired" | "closed";
