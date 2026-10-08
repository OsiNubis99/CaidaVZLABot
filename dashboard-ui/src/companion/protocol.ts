// Mirror of services/companion/protocol.js — keep byte-for-byte identical.

export const NAMESPACE = "/companion";

export const C2S = {
  CREATE: "companion:create",
  JOIN: "companion:join",
  RESUME: "companion:resume",
  SWAP: "companion:swap",
  GUEST: "companion:guest",
  KICK: "companion:kick",
  SIT: "companion:sit",
  CONFIG: "companion:config",
  START: "companion:start",
  RECORD: "companion:record",
  UNDO: "companion:undo",
  CONFIRM: "companion:confirm",
  CLOSE: "companion:close",
  DISCARD: "companion:discard",
  REMATCH: "companion:rematch",
  LEAVE: "companion:leave",
} as const;

export const S2C = {
  STATE: "companion:state",
  ERROR: "companion:error",
  ENDED: "companion:ended",
} as const;
