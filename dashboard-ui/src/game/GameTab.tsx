import { useEffect, useRef } from "react";
import { GameProvider, useGame } from "./store";
import { Lobby } from "./screens/Lobby";
import { Table } from "./screens/Table";
import { startParam } from "../lib/telegram";
import { useToast } from "../components/Toast";
import "./game.css";

interface Props {
  youId: number | null;
}

/** The "🎮 Jugar" tab. Wraps the flow in <GameProvider> (owns the socket) and
 *  routes Lobby → Table → EndGame by session status. */
export function GameTab({ youId }: Props) {
  return (
    <GameProvider>
      <GameFlow youId={youId} />
    </GameProvider>
  );
}

function GameFlow({ youId }: Props) {
  const { state, conn, error, clearError, joinSession, reconnect } = useGame();
  const toast = useToast();
  const autoJoined = useRef(false);

  // Auto-join a deep-linked session (t.me/<bot>/app?startapp=<code>) exactly
  // once, after the socket is connected.
  useEffect(() => {
    if (autoJoined.current) return;
    if (conn !== "connected") return;
    const code = startParam();
    if (code && !state) {
      autoJoined.current = true;
      joinSession(code);
    }
  }, [conn, state, joinSession]);

  // Surface server errors as toasts, then clear so they don't re-fire.
  useEffect(() => {
    if (!error) return;
    toast(error.message || error.code, "err");
    clearError();
  }, [error, toast, clearError]);

  return (
    <section className="tab-panel game-panel">
      <ConnBar conn={conn} onReconnect={reconnect} />
      {state && state.status !== "lobby" ? (
        <Table state={state} />
      ) : (
        <Lobby state={state} youId={youId} />
      )}
    </section>
  );
}

function ConnBar({
  conn,
  onReconnect,
}: {
  conn: ReturnType<typeof useGame>["conn"];
  onReconnect: () => void;
}) {
  if (conn === "connected") return null;
  const label =
    conn === "connecting"
      ? "Conectando…"
      : conn === "disconnected"
        ? "Sin conexión"
        : "Desconectado";
  return (
    <div className={`conn-bar conn-${conn}`}>
      <span>{label}</span>
      {conn === "disconnected" && (
        <button type="button" className="btn" onClick={onReconnect}>
          Reintentar
        </button>
      )}
    </div>
  );
}
