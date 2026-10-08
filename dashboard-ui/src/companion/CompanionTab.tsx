import { useEffect, useRef } from "react";
import { CompanionProvider, useCompanion } from "./store";
import { PreLobby } from "./screens/PreLobby";
import { Lobby } from "./screens/Lobby";
import { Board } from "./screens/Board";
import { Finished } from "./screens/Finished";
import { ConnBar } from "../game/GameTab";
import { errorText } from "./labels";
import { startParam, isCompanionCode } from "../lib/telegram";
import { t } from "../lib/i18n";
import { useToast } from "../components/Toast";
import "../game/game.css";
import "./companion.css";

/** "🃏 Mesa real" tab: the scorekeeper for games played with real cards. */
export function CompanionTab() {
  return (
    <CompanionProvider>
      <CompanionFlow />
    </CompanionProvider>
  );
}

function CompanionFlow() {
  const c = useCompanion();
  const { conn, state, error, ended, join, resume, clearError, clearEnded, reconnect } = c;
  const toast = useToast();
  const autoJoined = useRef(false);
  const prevConn = useRef(conn);

  // Each transition INTO connected: join the deep-linked MESA- table once;
  // after a blip, go back to the table on screen (works for watchers without
  // a seat too); otherwise re-attach to my table (no-op if I'm not in one).
  useEffect(() => {
    const was = prevConn.current;
    prevConn.current = conn;
    if (conn !== "connected" || was === "connected") return;
    const raw = startParam();
    if (raw && isCompanionCode(raw) && !state && !autoJoined.current) {
      autoJoined.current = true;
      join(raw);
      return;
    }
    if (state) join(state.code, state.you.position == null && !state.you.isHost);
    else resume();
  }, [conn, state, join, resume]);

  useEffect(() => {
    if (!error) return;
    toast(errorText(error), "err");
    clearError();
  }, [error, toast, clearError]);

  useEffect(() => {
    if (!ended) return;
    const key =
      ended === "kicked"
        ? "real.ended.kicked"
        : ended === "expired"
          ? "real.ended.expired"
          : ended === "discarded"
            ? "real.ended.discarded"
            : "real.ended.closed";
    toast(t(key));
    clearEnded();
  }, [ended, toast, clearEnded]);

  return (
    <section className="tab-panel game-panel real-panel">
      <ConnBar conn={conn} onReconnect={reconnect} />
      {!state ? (
        <PreLobby />
      ) : state.status === "lobby" ? (
        <Lobby state={state} />
      ) : state.status === "playing" ? (
        <Board state={state} />
      ) : (
        <Finished state={state} />
      )}
    </section>
  );
}
