// Visual-dev mock state. NOT wired into the default flow — import it manually in
// a scratch render (or temporarily in GameTab) when iterating on the table UI
// without a live backend. Kept out of the shipping path so production never
// renders a fake game.

import type { GameState } from "./types";
import type { Suit } from "./types";

function c(value: number, type: Suit, position?: number): { value: number; type: Suit; position: number } {
  return { value, type, position: position ?? value - 1 };
}

export const mockPlaying: GameState = {
  code: "CAIDA-7K2P",
  status: "playing",
  config: { points: 24, game_mode: 1, mata_mesa: "on", type: "individual" },
  seats: [
    { index: 0, kind: "human", name: "Tú", connected: true, cardCount: 3, points: 12, took: 4, sang: null, color: "🔴" },
    { index: 1, kind: "cpu", name: "🤖 Medio", connected: true, difficulty: "medium", cardCount: 3, points: 8, took: 2, sang: "Patrulla", color: "🔵" },
    { index: 2, kind: "cpu", name: "🤖 Pro", connected: true, difficulty: "pro", cardCount: 2, points: 15, took: 6, sang: null, color: "🟢" },
    { index: 3, kind: "human", name: "Andrés", connected: false, cardCount: 3, points: 5, took: 1, sang: null, color: "🟡" },
  ],
  table: [c(4, "Oro", 0), null, c(7, "Copa", 6), null, c(11, "Espada", 8), null, null, null, null, null],
  lastCardPlayed: c(7, "Copa", 6),
  turnSeat: 0,
  dealerSeat: 3,
  lastHand: false,
  you: {
    seat: 0,
    hand: [c(7, "Espada", 6), c(3, "Basto", 2), c(12, "Oro", 9)],
    canSing: { name: "Ronda", value: 5 },
  },
  lastEvent: { kind: "play", seat: 2, card: c(7, "Copa", 6) },
};

export const mockLobby: GameState = {
  code: "CAIDA-7K2P",
  status: "lobby",
  config: { points: 24, game_mode: 1, type: "individual" },
  seats: [
    { index: 0, kind: "human", name: "Tú", connected: true, cardCount: 0, points: 0, took: 0, sang: null, color: "" },
    { index: 1, kind: "cpu", name: "🤖 Fácil", connected: true, difficulty: "easy", cardCount: 0, points: 0, took: 0, sang: null, color: "" },
  ],
  table: Array(10).fill(null),
  lastCardPlayed: null,
  turnSeat: null,
  dealerSeat: null,
  lastHand: false,
  you: { seat: 0, hand: [], canSing: null },
  lastEvent: null,
};

export const mockFinished: GameState = {
  ...mockPlaying,
  status: "finished",
  winner: {
    seat: 2,
    standings: [
      { seat: 2, name: "🤖 Pro", points: 24 },
      { seat: 0, name: "Tú", points: 18 },
      { seat: 1, name: "🤖 Medio", points: 12 },
      { seat: 3, name: "Andrés", points: 7 },
    ],
  },
};
