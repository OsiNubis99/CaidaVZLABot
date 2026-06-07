import { useEffect, useRef } from "react";
import type { Card, LastEvent } from "../types";
import { PlayingCard } from "./PlayingCard";

interface Props {
  table: (Card | null)[];
  lastCardPlayed: Card | null;
  lastEvent: LastEvent | null;
}

function sameCard(a: Card | null, b: Card | null): boolean {
  return !!a && !!b && a.value === b.value && a.type === b.type;
}

/** The central mesa: shows the placed cards. Cards that are newly on the table
 *  this render animate in one-by-one (staggered) so a deck deal "drops" card by
 *  card instead of all at once. The last played card is highlighted. */
export function Mesa({ table, lastCardPlayed, lastEvent }: Props) {
  const flash =
    lastEvent && (lastEvent.kind === "caida" || lastEvent.kind === "mata_mesa")
      ? "caida"
      : lastEvent && lastEvent.kind === "mesa_limpia"
        ? "limpia"
        : null;

  // Track which positions were already on the table last render so only the
  // freshly-dealt ones animate, and they stagger in board order.
  const prevPositions = useRef<Set<number>>(new Set());
  const filledPositions = table
    .map((c, i) => (c ? i : -1))
    .filter((i) => i >= 0);
  const newlyAdded = filledPositions.filter((p) => !prevPositions.current.has(p));
  useEffect(() => {
    prevPositions.current = new Set(filledPositions);
  });

  const placed = filledPositions.length;
  const STAGGER_MS = 130;

  return (
    <div className="mesa">
      <div className="mesa-felt">
        {flash && (
          <div className={`mesa-flash mesa-flash-${flash}`}>
            {flash === "caida" ? "¡Caída!" : "Mesa limpia"}
          </div>
        )}

        {placed === 0 ? (
          <div className="mesa-empty">Mesa vacía</div>
        ) : (
          <div className="mesa-cards">
            {table.map((card, pos) => {
              if (!card) return null;
              const dealOrder = newlyAdded.indexOf(pos);
              const delay = dealOrder >= 0 ? dealOrder * STAGGER_MS : 0;
              return (
                <div
                  className="mesa-slot"
                  key={`${pos}-${card.value}-${card.type}`}
                  style={delay ? { animationDelay: `${delay}ms` } : undefined}
                >
                  <PlayingCard
                    card={card}
                    size="md"
                    highlighted={sameCard(card, lastCardPlayed)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      {lastCardPlayed && (
        <div className="mesa-caption muted">
          Última: {lastCardPlayed.value} de {lastCardPlayed.type}
        </div>
      )}
    </div>
  );
}
