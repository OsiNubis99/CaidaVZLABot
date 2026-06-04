import type { Seat } from "../types";
import { CardBack } from "./PlayingCard";

interface Props {
  seat: Seat;
  isTurn: boolean;
  isDealer: boolean;
}

/** A rival seat: name, face-down card backs (count only — hidden info), points,
 *  cards taken this hand, declared canto, turn + connection indicators. */
export function Opponent({ seat, isTurn, isDealer }: Props) {
  const cpu = seat.kind === "cpu";
  const offline = !seat.connected;

  return (
    <div
      className={[
        "opp",
        isTurn ? "opp-turn" : "",
        offline ? "opp-offline" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="opp-head">
        {seat.color && <span className="opp-color">{seat.color}</span>}
        <span className="opp-name">{seat.name}</span>
        {cpu && <span className="badge cpu">CPU</span>}
        {isDealer && <span className="opp-dealer" title="Reparte">🃏</span>}
        {offline && (
          <span className="opp-status" title="Desconectado">
            🔌
          </span>
        )}
      </div>

      <div className="opp-cards" aria-label={`${seat.cardCount} cartas`}>
        {Array.from({ length: Math.min(seat.cardCount, 3) }).map((_, i) => (
          <CardBack key={i} size="sm" />
        ))}
        {seat.cardCount === 0 && <span className="opp-nocards muted">—</span>}
      </div>

      <div className="opp-meta">
        <span className="opp-stat" title="Puntos">
          ⭐ {seat.points}
        </span>
        <span className="opp-stat" title="Tomó esta mano">
          🂠 {seat.took}
        </span>
        {seat.sang && (
          <span className="opp-canto" title="Cantó">
            🎵 {seat.sang}
          </span>
        )}
      </div>

      {isTurn && <div className="opp-turnbar" />}
    </div>
  );
}
