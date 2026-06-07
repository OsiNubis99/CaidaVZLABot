// T7 — React state for the realtime game. Single source of truth: the latest
// per-viewer GameState pushed on session:state, plus connection status and the
// last error. Actions are thin emitters over ws.ts.
//
// Context + useReducer. The store subscribes to the socket once (on mount of
// the provider) and tears down on unmount.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { gameSocket, type ConnState } from "./ws";
import { C2S, S2C } from "./protocol";
import type {
  GameState,
  SessionErrorPayload,
  CpuDifficulty,
  GameConfig,
} from "./types";

interface StoreState {
  conn: ConnState;
  state: GameState | null;
  error: SessionErrorPayload | null;
}

type Action =
  | { type: "conn"; conn: ConnState }
  | { type: "state"; state: GameState }
  | { type: "error"; error: SessionErrorPayload }
  | { type: "clearError" }
  | { type: "reset" };

const initialState: StoreState = { conn: "idle", state: null, error: null };

function reducer(s: StoreState, a: Action): StoreState {
  switch (a.type) {
    case "conn":
      return { ...s, conn: a.conn };
    case "state":
      // A fresh state supersedes any stale error from a prior action.
      return { ...s, state: a.state, error: null };
    case "error":
      return { ...s, error: a.error };
    case "clearError":
      return { ...s, error: null };
    case "reset":
      return { ...s, state: null, error: null };
  }
}

export interface GameStore extends StoreState {
  // Lobby actions
  createSession: (config?: GameConfig) => void;
  joinSession: (code: string) => void;
  addCpu: (difficulty: CpuDifficulty) => void;
  removeCpu: (seatIndex: number) => void;
  start: () => void;
  rematch: () => void;
  resume: () => void;
  leave: () => void;
  // Game actions
  play: (cardIndex: number) => void;
  sing: () => void;
  // Misc
  clearError: () => void;
  reconnect: () => void;
}

const Ctx = createContext<GameStore | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Keep a live dispatch in a ref so the socket subscription (set up once)
  // never goes stale.
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  // Mirror current state into a ref so the mount-once ended-handler can read
  // the latest snapshot without re-subscribing.
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state.state;

  useEffect(() => {
    const offConn = gameSocket.onConn((c) =>
      dispatchRef.current({ type: "conn", conn: c }),
    );
    gameSocket.connect();

    const offState = gameSocket.on(S2C.SESSION_STATE, (p) => {
      if (p?.state) dispatchRef.current({ type: "state", state: p.state });
    });
    const offError = gameSocket.on(S2C.SESSION_ERROR, (p) => {
      if (p) dispatchRef.current({ type: "error", error: p });
    });
    const offEnded = gameSocket.on(S2C.SESSION_ENDED, (p) => {
      // session:ended is the authoritative end signal. The final session:state
      // (status "finished" + winner) usually precedes it, but if it didn't,
      // synthesize a finished state from the ended payload so EndGame mounts.
      const winner = p?.winner ?? null;
      const standings = p?.standings ?? winner?.standings ?? [];
      const cur = stateRef.current;
      if (cur && cur.status !== "finished") {
        dispatchRef.current({
          type: "state",
          state: {
            ...cur,
            status: "finished",
            winner: { seat: winner?.seat ?? null, standings },
          },
        });
      }
    });

    return () => {
      offConn();
      offState();
      offError();
      offEnded();
      gameSocket.disconnect();
    };
    // Mount-once: the socket lifecycle is owned here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const store = useMemo<GameStore>(
    () => ({
      ...state,
      createSession: (config) =>
        gameSocket.send(C2S.SESSION_CREATE, config ? { config } : {}),
      joinSession: (code) =>
        gameSocket.send(C2S.SESSION_JOIN, { code: normalizeCode(code) }),
      addCpu: (difficulty) => gameSocket.send(C2S.SESSION_ADD_CPU, { difficulty }),
      removeCpu: (seatIndex) =>
        gameSocket.send(C2S.SESSION_REMOVE_CPU, { seatIndex }),
      start: () => gameSocket.send(C2S.SESSION_START, {}),
      rematch: () => gameSocket.send(C2S.SESSION_REMATCH, {}),
      resume: () => gameSocket.send(C2S.SESSION_RESUME, {}),
      leave: () => {
        gameSocket.send(C2S.SESSION_LEAVE, {});
        dispatchRef.current({ type: "reset" });
      },
      play: (cardIndex) => gameSocket.send(C2S.ACTION_PLAY, { cardIndex }),
      sing: () => gameSocket.send(C2S.ACTION_SING, {}),
      clearError: () => dispatchRef.current({ type: "clearError" }),
      reconnect: () => gameSocket.connect(),
    }),
    [state],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useGame(): GameStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGame must be used within <GameProvider>");
  return ctx;
}

/** Normalize a typed code: uppercase, strip spaces, and prefix CAIDA- if the
 *  user typed just the 4-char suffix. */
export function normalizeCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return "";
  if (s.startsWith("CAIDA-")) return s;
  // Bare suffix → add the canonical prefix.
  return "CAIDA-" + s.replace(/^CAIDA/, "");
}
