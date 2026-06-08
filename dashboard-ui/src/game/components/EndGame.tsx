import type { Winner } from "../types";
import { t } from "../../lib/i18n";

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
    standings.find((s) => s.seat === winner?.seat)?.name ?? t("table.none");

  return (
    <div className="endgame">
      <div className={`endgame-banner ${youWon ? "won" : "lost"}`}>
        <div className="endgame-emoji">{youWon ? "🏆" : "🎲"}</div>
        <h2>{youWon ? t("endgame.youWon") : t("endgame.over")}</h2>
        {!youWon && winner?.seat != null && (
          <p className="muted">{t("endgame.won", { name: winnerName })}</p>
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
              {s.seat === youSeat && <span className="muted">{t("endgame.you")}</span>}
            </span>
            <span className="endgame-pts">{t("endgame.pts", { points: s.points })}</span>
          </li>
        ))}
      </ol>

      <div className="endgame-actions">
        {isHost ? (
          <button type="button" className="btn btn-primary endgame-rematch" onClick={onRematch}>
            {t("endgame.rematch")}
          </button>
        ) : (
          <span className="muted">{t("endgame.waitingRematch")}</span>
        )}
        <button type="button" className="btn endgame-leave" onClick={onLeave}>
          {t("endgame.leave")}
        </button>
      </div>
    </div>
  );
}
