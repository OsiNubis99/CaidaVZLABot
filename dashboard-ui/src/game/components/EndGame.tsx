import type { FinishHow, MesaCard, RankedStatus, Winner } from "../types";
import { t } from "../../lib/i18n";
import { RankedLine } from "../screens/Lobby";

interface Props {
  winner: Winner | null;
  youSeat: number | null;
  isHost: boolean;
  /** Did this game count for "ganados"? (absent on older servers) */
  ranked?: RankedStatus;
  onRematch: () => void;
  onLeave: () => void;
}

/** Final standings screen shown when status === "finished". */
export function EndGame({ winner, youSeat, isHost, ranked, onRematch, onLeave }: Props) {
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

      {ranked && <RankedLine ranked={ranked} />}

      {winner?.how && <HowItEnded how={winner.how} />}

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

/** "4 → 3✓ → 7 → 12" — the mesa as it was laid, ✓ on the cards that stuck. */
const mesaCards = (table: MesaCard[]) =>
  table.map((c) => `${c.value}${c.hit ? "✓" : ""}`).join(" → ");

/** The same lines the group chat gets: how the mesa went and why it ended —
 *  for wins no card play explains (the last play is already on the table). */
function HowItEnded({ how }: { how: FinishHow }) {
  const and = t("endgame.and");
  const lines =
    how.kind === "cartas"
      ? [
          t(how.who.length > 1 ? "endgame.how.cartasTeam" : "endgame.how.cartas", {
            who: how.who.join(and),
            n: how.took,
            pts: how.points,
          }),
        ]
      : [
          t("endgame.how.mesa", { dealer: how.dealer, start: how.start, cards: mesaCards(how.table) }),
          how.kind === "mala_echada"
            ? t("endgame.how.malaEchada", { dealer: how.dealer, to: how.to.join(and) })
            : t("endgame.how.pegado", { dealer: how.dealer, n: how.points }),
        ];
  return (
    <div className="endgame-how">
      {lines.map((l) => (
        <p key={l}>{l}</p>
      ))}
    </div>
  );
}
