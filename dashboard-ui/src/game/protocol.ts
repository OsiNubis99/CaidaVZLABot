// Mirror of services/realtime/protocol.js — the shared event-name contract
// between the bot backend and this WebApp. Keep the string values byte-for-byte
// identical to the backend so client and server route the same events.

export const C2S = {
  SESSION_CREATE: "session:create",
  SESSION_JOIN: "session:join",
  SESSION_ADD_CPU: "session:addCpu",
  SESSION_REMOVE_CPU: "session:removeCpu",
  SESSION_START: "session:start",
  SESSION_REMATCH: "session:rematch",
  SESSION_CONFIG: "session:config",
  SESSION_RESUME: "session:resume",
  ACTION_PLAY: "action:play",
  ACTION_SING: "action:sing",
  SESSION_LEAVE: "session:leave",
} as const;

export const S2C = {
  SESSION_STATE: "session:state",
  SESSION_ERROR: "session:error",
  SESSION_ENDED: "session:ended",
} as const;

export type C2SEvent = (typeof C2S)[keyof typeof C2S];
export type S2CEvent = (typeof S2C)[keyof typeof S2C];
