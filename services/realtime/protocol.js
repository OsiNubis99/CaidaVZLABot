/**
 * Realtime WS protocol — the shared event-name contract between the bot
 * backend (services/realtime/*) and the WebApp frontend
 * (dashboard-ui/src/game/protocol.ts mirrors this verbatim). Frozen so a
 * typo surfaces as an immediate throw instead of an `undefined` event name
 * silently routed nowhere.
 */
const C2S = Object.freeze({
  SESSION_CREATE: "session:create",
  SESSION_JOIN: "session:join",
  SESSION_ADD_CPU: "session:addCpu",
  SESSION_REMOVE_CPU: "session:removeCpu",
  SESSION_START: "session:start",
  ACTION_PLAY: "action:play",
  ACTION_SING: "action:sing",
  SESSION_LEAVE: "session:leave",
});

const S2C = Object.freeze({
  SESSION_STATE: "session:state",
  SESSION_ERROR: "session:error",
  SESSION_ENDED: "session:ended",
});

module.exports = Object.freeze({ C2S, S2C });
