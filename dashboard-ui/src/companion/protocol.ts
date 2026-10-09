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
  QUEUE_JOIN: "companion:queueJoin",
  QUEUE_LEAVE: "companion:queueLeave",
  QUEUE_ADD: "companion:queueAdd",
  QUEUE_REMOVE: "companion:queueRemove",
  SEAT_QUEUED: "companion:seatQueued",
  TRANSFER: "companion:transfer",
  CLAIM: "companion:claim",
} as const;

export const S2C = {
  STATE: "companion:state",
  ERROR: "companion:error",
  ENDED: "companion:ended",
} as const;
