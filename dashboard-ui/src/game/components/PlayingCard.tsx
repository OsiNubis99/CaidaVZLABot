import { useState } from "react";
import type { Card } from "../types";
import { suitMeta, rankLabel, cardLabel, cardImgUrl, cardBackUrl } from "../cards";

type Size = "sm" | "md" | "lg";

interface Props {
  card: Card;
  size?: Size;
  highlighted?: boolean;
  playable?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
}

/** A single face-up card. Primary render is the real Spanish-deck image the bot
 *  serves; if it fails to load we fall back to a styled DOM face (rank corners
 *  + suit glyph) so a missing asset never breaks the table. */
export function PlayingCard({
  card,
  size = "md",
  highlighted = false,
  playable = false,
  dimmed = false,
  onClick,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const meta = suitMeta(card.type);
  const rank = rankLabel(card.value);
  const label = cardLabel(card.value, card.type);
  const useImg = !imgError;

  const cls = [
    "pcard",
    `pcard-${size}`,
    useImg ? "has-img" : meta.cls,
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
      title={label}
      aria-label={label}
      {...(onClick ? { type: "button" as const } : {})}
    >
      {useImg ? (
        <img
          className="pcard-img"
          src={cardImgUrl(card.value, card.type)}
          alt={label}
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <>
          <span className="pcard-corner pcard-corner-tl">
            <span className="pcard-rank">{rank}</span>
            <span className="pcard-pip">{meta.glyph}</span>
          </span>
          <span className="pcard-center">{meta.glyph}</span>
          <span className="pcard-corner pcard-corner-br">
            <span className="pcard-rank">{rank}</span>
            <span className="pcard-pip">{meta.glyph}</span>
          </span>
        </>
      )}
    </Tag>
  );
}

/** A face-down card back: the real back.png, falling back to a dashed panel. */
export function CardBack({ size = "sm" }: { size?: Size }) {
  const [imgError, setImgError] = useState(false);
  if (imgError) {
    return <div className={`pcard pcard-${size} pcard-back`} aria-hidden="true" />;
  }
  return (
    <div className={`pcard pcard-${size} has-img`} aria-hidden="true">
      <img
        className="pcard-img"
        src={cardBackUrl}
        alt=""
        draggable={false}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
