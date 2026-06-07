import { useEffect, useRef } from "react";
import type { Card, LastEvent, LastDeal } from "../types";
import { PlayingCard } from "./PlayingCard";

interface Props {
  table: (Card | null)[];
  lastCardPlayed: Card | null;
  lastEvent: LastEvent | null;
  lastDeal?: LastDeal | null;
}

const STAGGER_MS = 150;

function sameCard(a: Card | null, b: Card | null): boolean {
  return !!a && !!b && a.value === b.value && a.type === b.type;
}

/** The central mesa. New cards animate in one-by-one. On a deck-start deal the
 *  stagger follows the real draw order and pegar-en-mesa cards pop a "+N" as
 *  they land (synced to each drop). The last played card is highlighted. */
export function Mesa({ table, lastCardPlayed, lastEvent, lastDeal }: Props) {
  const flash =
    lastEvent && (lastEvent.kind === "caida" || lastEvent.kind === "mata_mesa")
      ? "caida"
      : lastEvent && lastEvent.kind === "mesa_limpia"
        ? "limpia"
        : null;

  // Board-order diff: which positions are newly on the table (for normal plays).
  const prevPositions = useRef<Set<number>>(new Set());
  const filledPositions = table
    .map((c, i) => (c ? i : -1))
    .filter((i) => i >= 0);
  const newlyAdded = filledPositions.filter((p) => !prevPositions.current.has(p));
  useEffect(() => {
    prevPositions.current = new Set(filledPositions);
  });

  // A deck-start deal animates by draw order, with +N pegado popups, once per
  // deal id. position → { order, pegado }.
  const prevDealId = useRef<number | null>(null);
  const isFreshDeal = !!lastDeal && lastDeal.id !== prevDealId.current;
  useEffect(() => {
    if (lastDeal) prevDealId.current = lastDeal.id;
  }, [lastDeal]);

  const dealByPos = new Map<number, { order: number; pegado: number }>();
  if (isFreshDeal && lastDeal) {
    lastDeal.seq.forEach((c, i) =>
      dealByPos.set(c.position, { order: i, pegado: c.pegado }),
    );
  }

  function delayFor(pos: number): number {
    if (isFreshDeal) {
      const d = dealByPos.get(pos);
      return d ? d.order * STAGGER_MS : 0;
    }
    const idx = newlyAdded.indexOf(pos);
    return idx >= 0 ? idx * STAGGER_MS : 0;
  }

  // Fixed 10-position grid (2 rows × 5, like the chat-mode mesa). Each cell is
  // a card or an empty placeholder, kept in position order.
  return (
    <div className="mesa">
      <div className="mesa-felt">
        {flash && (
          <div className={`mesa-flash mesa-flash-${flash}`}>
            {flash === "caida" ? "¡Caída!" : "Mesa limpia"}
          </div>
        )}

        <div className="mesa-grid">
          {table.map((card, pos) => {
            if (!card) {
              return <div className="mesa-cell mesa-cell-empty" key={pos} />;
            }
            const delay = delayFor(pos);
            const pegado = isFreshDeal ? (dealByPos.get(pos)?.pegado ?? 0) : 0;
            return (
              <div
                className="mesa-cell mesa-slot"
                key={`${pos}-${card.value}-${card.type}`}
                style={delay ? { animationDelay: `${delay}ms` } : undefined}
              >
                <PlayingCard
                  card={card}
                  size="md"
                  highlighted={sameCard(card, lastCardPlayed)}
                />
                {pegado > 0 && (
                  <span
                    className="pegado-pop"
                    style={{ animationDelay: `${delay + 110}ms` }}
                  >
                    +{pegado}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
