// React state for the Acompañante: the latest per-viewer CompanionState pushed
// on companion:state, connection status, last error and the "table closed"
// reason. Actions are thin emitters over ws.ts (the server validates all).

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type { ConnState } from "../game/ws";
import { companionSocket } from "./ws";
import { C2S, S2C } from "./protocol";
import type {
  CompanionConfig,
  CompanionErrorPayload,
  CompanionState,
  EndedReason,
  RecordInput,
  RematchMode,
} from "./types";

interface StoreState {
  conn: ConnState;
  state: CompanionState | null;
  error: CompanionErrorPayload | null;
  ended: EndedReason | null;
}

type Action =
  | { type: "conn"; conn: ConnState }
  | { type: "state"; state: CompanionState }
  | { type: "error"; error: CompanionErrorPayload }
  | { type: "ended"; reason: EndedReason }
  | { type: "clearError" }
  | { type: "clearEnded" }
  | { type: "reset" };

const initial: StoreState = { conn: "idle", state: null, error: null, ended: null };

function reducer(s: StoreState, a: Action): StoreState {
  switch (a.type) {
    case "conn":
      return { ...s, conn: a.conn };
    case "state":
      return { ...s, state: a.state, error: null };
    case "error":
      // The table on screen is gone (closed/expired while we were away).
      if (a.error.code === "table_not_found") return { ...s, state: null, error: a.error };
      return { ...s, error: a.error };
    case "ended":
      return { ...s, state: null, ended: a.reason };
    case "clearError":
      return { ...s, error: null };
    case "clearEnded":
      return { ...s, ended: null };
    case "reset":
      return { ...s, state: null, error: null };
  }
}

export interface CompanionStore extends StoreState {
  /** `referee`: the creator keeps score without a seat (no stats). */
  create: (config?: Partial<CompanionConfig>, referee?: boolean) => void;
  /** `watch`: re-attach without taking a seat (reconnecting watchers). */
  join: (code: string, watch?: boolean) => void;
  resume: () => void;
  swap: (a: number, b: number) => void;
  addGuest: (name: string, position?: number) => void;
  kick: (position: number) => void;
  /** Host takes a seat (no position → first free one). */
  sit: (position?: number) => void;
  setConfig: (config: Partial<CompanionConfig>) => void;
  start: () => void;
  record: (input: RecordInput) => void;
  undo: (opId?: number) => void;
  confirmWin: () => void;
  closeWithWinner: (winnerSlot: number) => void;
  discard: () => void;
  rematch: (mode: RematchMode) => void;
  leave: () => void;
  clearError: () => void;
  clearEnded: () => void;
  reconnect: () => void;
}

const Ctx = createContext<CompanionStore | null>(null);

export function CompanionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const offConn = companionSocket.onConn((c) => dispatchRef.current({ type: "conn", conn: c }));
    companionSocket.connect();
    const offState = companionSocket.on(S2C.STATE, (p) => {
      if (p?.state) dispatchRef.current({ type: "state", state: p.state });
    });
    const offError = companionSocket.on(S2C.ERROR, (p) => {
      if (p) dispatchRef.current({ type: "error", error: p });
    });
    const offEnded = companionSocket.on(S2C.ENDED, (p) => {
      dispatchRef.current({ type: "ended", reason: p?.reason ?? "closed" });
    });
    return () => {
      offConn();
      offState();
      offError();
      offEnded();
      companionSocket.disconnect();
    };
  }, []);

  const store = useMemo<CompanionStore>(
    () => ({
      ...state,
      create: (config, referee) =>
        companionSocket.send(C2S.CREATE, {
          ...(config ? { config } : {}),
          ...(referee ? { referee: true } : {}),
        }),
      join: (code, watch) =>
        companionSocket.send(C2S.JOIN, {
          code: normalizeMesaCode(code),
          ...(watch ? { watch: true } : {}),
        }),
      resume: () => companionSocket.send(C2S.RESUME, {}),
      swap: (a, b) => companionSocket.send(C2S.SWAP, { a, b }),
      addGuest: (name, position) => companionSocket.send(C2S.GUEST, { name, position }),
      kick: (position) => companionSocket.send(C2S.KICK, { position }),
      sit: (position) => companionSocket.send(C2S.SIT, position != null ? { position } : {}),
      setConfig: (config) => companionSocket.send(C2S.CONFIG, { config }),
      start: () => companionSocket.send(C2S.START, {}),
      record: (input) => companionSocket.send(C2S.RECORD, input),
      undo: (opId) => companionSocket.send(C2S.UNDO, opId != null ? { opId } : {}),
      confirmWin: () => companionSocket.send(C2S.CONFIRM, {}),
      closeWithWinner: (winnerSlot) => companionSocket.send(C2S.CLOSE, { winnerSlot }),
      discard: () => companionSocket.send(C2S.DISCARD, {}),
      rematch: (mode) => companionSocket.send(C2S.REMATCH, { mode }),
      leave: () => {
        companionSocket.send(C2S.LEAVE, {});
        dispatchRef.current({ type: "reset" });
      },
      clearError: () => dispatchRef.current({ type: "clearError" }),
      clearEnded: () => dispatchRef.current({ type: "clearEnded" }),
      reconnect: () => companionSocket.connect(),
    }),
    [state],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useCompanion(): CompanionStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompanion must be used within <CompanionProvider>");
  return ctx;
}

/** Uppercase, strip spaces, add the MESA- prefix to a bare 4-char suffix. */
export function normalizeMesaCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  if (s.startsWith("MESA-")) return s;
  return "MESA-" + s.replace(/^MESA/, "");
}
