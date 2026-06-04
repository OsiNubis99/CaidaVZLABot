import { useState } from "react";
import type { GameState, CpuDifficulty } from "../types";
import { useGame } from "../store";
import { openTelegramLink } from "../../lib/telegram";

const BOT = "CaidaVZLABot";
const DIFFS: { id: CpuDifficulty; label: string }[] = [
  { id: "easy", label: "Fácil" },
  { id: "medium", label: "Medio" },
  { id: "pro", label: "Pro" },
];

interface Props {
  /** Null until the viewer has created/joined a session. */
  state: GameState | null;
  youId: number | null;
}

/** Lobby: create or join a session, fill seats with CPUs, start. Once a session
 *  exists (`state` non-null), shows the seat roster + host controls. */
export function Lobby({ state, youId }: Props) {
  const game = useGame();

  if (!state) return <PreLobby />;

  // Host is seat 0 (per spec). We can't see rivals' userIds, but the viewer is
  // the host iff they occupy seat 0.
  const isHost = youId != null && state.you.seat === 0;

  const filled = state.seats.length;
  const canStart = isHost && filled >= 2;
  const shareLink = `https://t.me/${BOT}/app?startapp=${state.code}`;

  return (
    <div className="lobby">
      <div className="lobby-head">
        <div>
          <div className="muted">Código de mesa</div>
          <div className="lobby-code">{state.code}</div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => openTelegramLink(shareLink)}
        >
          🔗 Invitar
        </button>
      </div>

      <div className="lobby-seats">
        {state.seats.map((seat) => (
          <div className="lobby-seat" key={seat.index}>
            <span className="lobby-seat-idx">{seat.index + 1}</span>
            <span className="lobby-seat-name">
              {seat.name}
              {seat.kind === "cpu" && <span className="badge cpu">CPU</span>}
              {seat.index === 0 && <span className="muted"> · host</span>}
            </span>
            {isHost && seat.kind === "cpu" && (
              <button
                type="button"
                className="btn btn-danger lobby-seat-x"
                onClick={() => game.removeCpu(seat.index)}
                title="Quitar CPU"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - filled) }).map((_, i) => (
          <div className="lobby-seat lobby-seat-empty" key={`e${i}`}>
            <span className="lobby-seat-idx">{filled + i + 1}</span>
            <span className="muted">Libre</span>
          </div>
        ))}
      </div>

      {isHost && filled < 4 && (
        <div className="lobby-cpu">
          <span className="muted">Agregar CPU:</span>
          {DIFFS.map((d) => (
            <button
              key={d.id}
              type="button"
              className="btn"
              onClick={() => game.addCpu(d.id)}
            >
              + {d.label}
            </button>
          ))}
        </div>
      )}

      <div className="lobby-actions">
        {isHost ? (
          <button
            type="button"
            className="btn btn-primary lobby-start"
            disabled={!canStart}
            onClick={game.start}
          >
            ▶ Empezar
          </button>
        ) : (
          <span className="muted">Esperando a que el host empiece…</span>
        )}
        <button type="button" className="btn" onClick={game.leave}>
          Salir
        </button>
      </div>

      {!canStart && isHost && (
        <p className="muted lobby-hint">Necesitás al menos 2 jugadores para empezar.</p>
      )}
    </div>
  );
}

/** No session yet: create one or join by code. */
function PreLobby() {
  const game = useGame();
  const [code, setCode] = useState("");

  return (
    <div className="lobby lobby-pre">
      <div className="prelobby-card">
        <h3>Jugar Caída</h3>
        <p className="muted">
          Creá una mesa e invitá amigos (o llená con CPUs), o unite a una mesa
          con su código.
        </p>
        <button
          type="button"
          className="btn btn-primary prelobby-create"
          onClick={() => game.createSession()}
        >
          Crear mesa
        </button>

        <div className="prelobby-sep">
          <span>o</span>
        </div>

        <form
          className="prelobby-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) game.joinSession(code);
          }}
        >
          <input
            className="input"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            placeholder="CAIDA-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!code.trim()}>
            Unirme
          </button>
        </form>
      </div>
    </div>
  );
}
