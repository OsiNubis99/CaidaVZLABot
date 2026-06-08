import type { Card, Hand as HandType } from "../types";
import { isStartBy } from "../types";
import { t } from "../../lib/i18n";
import { PlayingCard } from "./PlayingCard";

interface Props {
  hand: HandType;
  isYourTurn: boolean;
  /** Position of the last card on the mesa — a hand card matching it is a
   *  caída when played (we hint it subtly). */
  caidaPosition: number | null;
  onPlay: (cardIndex: number) => void;
}

/** The viewer's own hand at the bottom of the table. When it's their turn the
 *  cards lift and become tappable; the startBy hand renders the 1/4 picker. */
export function Hand({ hand, isYourTurn, caidaPosition, onPlay }: Props) {
  if (isStartBy(hand)) {
    return (
      <div className="hand hand-startby">
        <div className="hand-prompt">{t("hand.dealPrompt")}</div>
        <div className="startby-choices">
          {/* On the Start_By hand the play payload is the direction VALUE
              (1 or 4), not a card index — GameSession.play reads it as
              `dir = arg === 4 ? 4 : 1`. */}
          <button
            type="button"
            className="btn btn-primary startby-btn"
            onClick={() => onPlay(1)}
          >
            {t("hand.by1")}
          </button>
          <button
            type="button"
            className="btn btn-primary startby-btn"
            onClick={() => onPlay(4)}
          >
            {t("hand.by4")}
          </button>
        </div>
      </div>
    );
  }

  const cards = hand as Card[];
  if (cards.length === 0) {
    return <div className="hand hand-empty muted">{t("hand.empty")}</div>;
  }

  return (
    <div className="hand">
      <div className="hand-cards">
        {cards.map((card: Card, i) => {
          const isCaida = caidaPosition != null && card.position === caidaPosition;
          return (
            <PlayingCard
              key={`${card.value}-${card.type}-${i}`}
              card={card}
              size="lg"
              playable={isYourTurn}
              highlighted={isYourTurn && isCaida}
              dimmed={!isYourTurn}
              onClick={isYourTurn ? () => onPlay(i) : undefined}
            />
          );
        })}
      </div>
      <div className="hand-hint muted">
        {isYourTurn
          ? caidaPosition != null && cards.some((c) => c.position === caidaPosition)
            ? t("hand.yourTurnCaida")
            : t("hand.yourTurnPlay")
          : t("hand.waitTurn")}
      </div>
    </div>
  );
}
