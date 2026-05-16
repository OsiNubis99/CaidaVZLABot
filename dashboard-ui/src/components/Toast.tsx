import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { haptic } from "../lib/telegram";

type Kind = "ok" | "err";
type Show = (msg: string, kind?: Kind) => void;

const ToastCtx = createContext<Show>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ msg: string; kind: Kind } | null>(null);
  const timer = useRef<number | null>(null);

  const show = useCallback<Show>((msg, kind = "ok") => {
    setState({ msg, kind });
    haptic(kind);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState(null), 2500);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {state && <div className={`toast ${state.kind}`}>{state.msg}</div>}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
