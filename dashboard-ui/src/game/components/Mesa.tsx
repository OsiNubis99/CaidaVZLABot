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

/** The central mesa: 10 position slots (one per card position 0..9). The most
 *  recently played card is highlighted; a freshly placed card animates in. */
export function Mesa({ table, lastCardPlayed, lastEvent }: Props) {
  const flash =
    lastEvent && (lastEvent.kind === "caida" || lastEvent.kind === "mata_mesa")
      ? "caida"
      : lastEvent && lastEvent.kind === "mesa_limpia"
        ? "limpia"
        : null;

  const placed = table.filter(Boolean).length;

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
            {table.map((card, pos) =>
              card ? (
                <div className="mesa-slot" key={pos}>
                  <PlayingCard
                    card={card}
                    size="md"
                    highlighted={sameCard(card, lastCardPlayed)}
                  />
                </div>
              ) : null,
            )}
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
