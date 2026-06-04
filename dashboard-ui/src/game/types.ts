// TypeScript mirror of the per-viewer state shape produced by
// services/realtime/serializeForClient.js (SP1 spec "Estado por-viewer").
// The serializer is the source of truth; these types track it field-for-field.

export type Suit = "Oro" | "Espada" | "Copa" | "Basto";

/** Minimal client card. `position` (0..9) drives the mesa slot layout. */
export interface Card {
  value: number;
  type: Suit;
  position: number;
}

export type SessionStatus = "lobby" | "playing" | "finished";

export type CpuDifficulty = "easy" | "medium" | "pro";

/** Engine config projected verbatim (`{ ...game.config }`). Only the fields the
 *  UI reads are typed; the rest is allowed via the index signature. */
export interface GameConfig {
  points?: number;
  game_mode?: number;
  mata_mesa?: string;
  type?: "individual" | "parejas";
  [key: string]: unknown;
}

/** A seat as every viewer sees it: rivals expose only `cardCount`. */
export interface Seat {
  index: number;
  kind: "human" | "cpu";
  name: string;
  connected: boolean;
  difficulty?: CpuDifficulty;
  cardCount: number;
  points: number;
  took: number;
  sang: string | null;
  color: string;
}

/** The startBy picker sentinel — the dealer must choose deal direction 1/4. */
export interface StartByHand {
  type: "startBy";
}

export type Hand = Card[] | StartByHand;

export interface Canto {
  name: string;
  value: number;
}

/** The viewer's private view: their own full hand plus declarable canto. */
export interface You {
  seat: number | null;
  hand: Hand;
  canSing: Canto | null;
}

export type LastEventKind =
  | "caida"
  | "mesa_limpia"
  | "canto"
  | "mata_mesa"
  | "play";

export interface LastEvent {
  kind: LastEventKind | null;
  seat: number;
  card: Card | null;
}

export interface StandingEntry {
  seat: number;
  name: string;
  points: number;
}

export interface Winner {
  seat: number | null;
  standings: StandingEntry[];
}

/** The full per-viewer snapshot delivered on `session:state`. */
export interface GameState {
  code: string;
  status: SessionStatus;
  config: GameConfig;
  seats: Seat[];
  table: (Card | null)[];
  lastCardPlayed: Card | null;
  turnSeat: number | null;
  dealerSeat: number | null;
  lastHand: boolean;
  you: You;
  lastEvent: LastEvent | null;
  winner?: Winner | null;
}

// ─── S2C payloads ────────────────────────────────────────────────────────
export interface SessionStatePayload {
  state: GameState;
}

export interface SessionErrorPayload {
  code: string;
  message: string;
}

export interface SessionEndedPayload {
  winner: Winner | null;
  standings?: StandingEntry[];
}

// ─── C2S payloads ────────────────────────────────────────────────────────
export interface CreatePayload {
  config?: GameConfig;
}
export interface JoinPayload {
  code: string;
}
export interface AddCpuPayload {
  difficulty: CpuDifficulty;
}
export interface RemoveCpuPayload {
  seatIndex: number;
}
export interface PlayPayload {
  cardIndex: number;
}

/** Helper: narrow a Hand to the startBy sentinel. */
export function isStartBy(hand: Hand): hand is StartByHand {
  return !Array.isArray(hand) && (hand as StartByHand).type === "startBy";
}
