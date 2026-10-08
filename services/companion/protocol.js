/**
 * Acompañante WS protocol — event names shared with the WebApp
 * (dashboard-ui/src/companion/protocol.ts mirrors this verbatim). Lives on its
 * own socket.io namespace so it never collides with the game's handlers.
 */
const NAMESPACE = "/companion";

const C2S = Object.freeze({
  CREATE: "companion:create", // { config?, referee? } → ack { code }
  JOIN: "companion:join", // { code, watch? } — watch: re-attach without taking a seat
  RESUME: "companion:resume", // {} → re-attach to my table (no-op if none)
  SWAP: "companion:swap", // { a, b } host, lobby
  GUEST: "companion:guest", // { name, position? } host, lobby
  KICK: "companion:kick", // { position } host, lobby (own seat = become referee)
  SIT: "companion:sit", // { position? } host, lobby (referee takes a seat)
  CONFIG: "companion:config", // { config } host, lobby
  START: "companion:start", // host, lobby
  RECORD: "companion:record", // { kind, seat, value?, canto? } host, playing
  UNDO: "companion:undo", // { opId? } host, playing
  CONFIRM: "companion:confirm", // host: save the pending win
  CLOSE: "companion:close", // { winnerSlot } host: finish by hand + save
  DISCARD: "companion:discard", // host: close the table without saving
  REMATCH: "companion:rematch", // { mode: "again" | "winners" | "lobby" } host, finished
  LEAVE: "companion:leave", // non-host stops following the table
});

const S2C = Object.freeze({
  STATE: "companion:state", // { state }
  ERROR: "companion:error", // { code, message }
  ENDED: "companion:ended", // { reason: "discarded" | "kicked" | "expired" | "closed" }
});

module.exports = Object.freeze({ NAMESPACE, C2S, S2C });
