import type { Seat } from "../types";
import { t } from "../../lib/i18n";
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
        {cpu && <span className="badge cpu">{t("opp.cpu")}</span>}
        {isDealer && <span className="opp-dealer" title={t("opp.dealer")}>🃏</span>}
        {offline && (
          <span className="opp-status" title={t("opp.offline")}>
            🔌
          </span>
        )}
      </div>

      <div className="opp-cards" aria-label={t("opp.cardCount", { n: seat.cardCount })}>
        {Array.from({ length: Math.min(seat.cardCount, 3) }).map((_, i) => (
          <CardBack key={i} size="sm" />
        ))}
        {seat.cardCount === 0 && <span className="opp-nocards muted">—</span>}
      </div>

      <div className="opp-meta">
        <span className="opp-stat" title={t("opp.points")}>
          ⭐ {seat.points}
        </span>
        <span className="opp-stat" title={t("opp.took")}>
          🂠 {seat.took}
        </span>
        {seat.sang && (
          <span className="opp-canto" title={t("opp.sang")}>
            🎵 {seat.sang}
          </span>
        )}
        {seat.sangDead && (
          <span className="canto-dead" title={t("opp.deadCanto")}>
            💀 <s>{seat.sangDead}</s>
          </span>
        )}
      </div>

      {isTurn && <div className="opp-turnbar" />}
    </div>
  );
}
