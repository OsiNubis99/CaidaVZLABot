import type { Card } from "../types";
import { suitMeta, rankLabel, cardLabel } from "../cards";

type Size = "sm" | "md" | "lg";

interface Props {
  card: Card;
  size?: Size;
  highlighted?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

/** A single styled face-up card. Self-contained DOM: rank corners + a big suit
 *  glyph. Suit color comes from a per-suit CSS class (see game.css). */
export function PlayingCard({
  card,
  size = "md",
  highlighted = false,
  playable = false,
  dimmed = false,
  onClick,
}: Props) {
  const meta = suitMeta(card.type);
  const rank = rankLabel(card.value);
  const cls = [
    "pcard",
    `pcard-${size}`,
    meta.cls,
    highlighted ? "is-highlighted" : "",
    playable ? "is-playable" : "",
    dimmed ? "is-dimmed" : "",
    onClick ? "is-clickable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      className={cls}
      onClick={onClick}
      title={cardLabel(card.value, card.type)}
      aria-label={cardLabel(card.value, card.type)}
      {...(onClick ? { type: "button" as const } : {})}
    >
      <span className="pcard-corner pcard-corner-tl">
        <span className="pcard-rank">{rank}</span>
        <span className="pcard-pip">{meta.glyph}</span>
      </span>
      <span className="pcard-center">{meta.glyph}</span>
      <span className="pcard-corner pcard-corner-br">
        <span className="pcard-rank">{rank}</span>
        <span className="pcard-pip">{meta.glyph}</span>
      </span>
    </Tag>
  );
}

/** A face-down card back. Used to render rivals' hidden hands as stacked backs. */
export function CardBack({ size = "sm" }: { size?: Size }) {
  return <div className={`pcard pcard-${size} pcard-back`} aria-hidden="true" />;
}
