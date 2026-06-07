import type { Winner } from "../types";

interface Props {
  winner: Winner | null;
  youSeat: number | null;
  isHost: boolean;
  onRematch: () => void;
  onLeave: () => void;
}

/** Final standings screen shown when status === "finished". */
export function EndGame({ winner, youSeat, isHost, onRematch, onLeave }: Props) {
  const standings = winner?.standings ?? [];
  const youWon = winner?.seat != null && winner.seat === youSeat;
  const winnerName =
    standings.find((s) => s.seat === winner?.seat)?.name ?? "—";

  return (
    <div className="endgame">
      <div className={`endgame-banner ${youWon ? "won" : "lost"}`}>
        <div className="endgame-emoji">{youWon ? "🏆" : "🎲"}</div>
        <h2>{youWon ? "¡Ganaste!" : "Fin de la partida"}</h2>
        {!youWon && winner?.seat != null && (
          <p className="muted">Ganó {winnerName}</p>
        )}
      </div>

      <ol className="endgame-standings">
        {standings.map((s, i) => (
          <li
            key={s.seat}
            className={[
              "endgame-row",
              s.seat === winner?.seat ? "is-winner" : "",
              s.seat === youSeat ? "is-you" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="endgame-pos">{i + 1}</span>
            <span className="endgame-name">
              {s.name}
              {s.seat === youSeat && <span className="muted"> (tú)</span>}
            </span>
            <span className="endgame-pts">{s.points} pts</span>
          </li>
        ))}
      </ol>

      <div className="endgame-actions">
        {isHost ? (
          <button type="button" className="btn btn-primary endgame-rematch" onClick={onRematch}>
            🔄 Revancha
          </button>
        ) : (
          <span className="muted">Esperando al host para la revancha…</span>
        )}
        <button type="button" className="btn endgame-leave" onClick={onLeave}>
          Salir
        </button>
      </div>
    </div>
  );
}
