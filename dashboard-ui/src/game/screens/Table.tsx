import { useMemo } from "react";
import type { GameState, Seat, LastEvent } from "../types";
import { isStartBy } from "../types";
import { rankName } from "../cards";
import { useGame } from "../store";
import { Mesa } from "../components/Mesa";
import { Hand } from "../components/Hand";
import { Opponent } from "../components/Opponent";
import { CantoPicker } from "../components/CantoPicker";
import { EndGame } from "../components/EndGame";

interface Props {
  state: GameState;
}

/** Human-readable line for the latest game event (jugó / cantó / caída / …). */
function eventMessage(ev: LastEvent | null, seats: Seat[]): string | null {
  if (!ev) return null;
  const seat = seats.find((s) => s.index === ev.seat);
  const who = seat?.name ?? "Alguien";
  const card = ev.card ? `${rankName(ev.card.value)} de ${ev.card.type}` : null;
  switch (ev.kind) {
    case "caida":
      return `⚡ ¡Caída de ${who}!`;
    case "mata_mesa":
      return `🔄 ${who} mató la mesa`;
    case "mesa_limpia":
      return `✨ ${who} hizo mesa limpia`;
    case "canto":
      return `🎵 ${who} cantó${seat?.sang ? ` ${seat.sang}` : ""}`;
    case "play":
      return card ? `${who} jugó ${card}` : null;
    default:
      return null;
  }
}

/** The card table: rivals across the top, mesa in the center, your hand at the
 *  bottom. Reads the per-viewer GameState; emits actions via the store. */
export function Table({ state }: Props) {
  const { play, sing, leave } = useGame();

  const yourSeat = state.you.seat;
  const isYourTurn = yourSeat != null && state.turnSeat === yourSeat;
  const caidaPosition = state.lastCardPlayed?.position ?? null;

  // Rivals = every seat that isn't the viewer's, kept in table order so the
  // layout matches the real seating rotation.
  const opponents = useMemo(
    () => state.seats.filter((s) => s.index !== yourSeat),
    [state.seats, yourSeat],
  );

  const you = useMemo(
    () => state.seats.find((s) => s.index === yourSeat) ?? null,
    [state.seats, yourSeat],
  );

  if (state.status === "finished") {
    return (
      <EndGame winner={state.winner ?? null} youSeat={yourSeat} onLeave={leave} />
    );
  }

  const turnSeatName =
    state.turnSeat != null
      ? state.seats.find((s) => s.index === state.turnSeat)?.name
      : null;

  const eventMsg = eventMessage(state.lastEvent, state.seats);

  return (
    <div className="table-screen">
      <div className="table-topbar">
        <span className="table-code">Mesa {state.code}</span>
        <span className={`turn-pill ${isYourTurn ? "is-you" : ""}`}>
          {isYourTurn ? "Tu turno" : turnSeatName ? `Turno: ${turnSeatName}` : "—"}
        </span>
        {state.lastHand && <span className="table-lasthand">Última mano</span>}
      </div>

      <div className="opp-row">
        {opponents.map((seat) => (
          <Opponent
            key={seat.index}
            seat={seat}
            isTurn={state.turnSeat === seat.index}
            isDealer={state.dealerSeat === seat.index}
          />
        ))}
      </div>

      {/* Notification line: re-keyed on the message so it re-animates on change. */}
      <div className="event-line" key={eventMsg ?? "none"}>
        {eventMsg ?? " "}
      </div>

      <Mesa
        table={state.table}
        lastCardPlayed={state.lastCardPlayed}
        lastEvent={state.lastEvent}
        lastDeal={state.lastDeal ?? null}
      />

      <div className="table-bottom">
        {/* Your own status: points, cards taken this hand, turn, canto. */}
        {you && (
          <div className={`you-bar ${isYourTurn ? "is-turn" : ""}`}>
            <span className="you-id">
              {you.color && <span className="you-color">{you.color}</span>}
              {you.name}
            </span>
            <span className="you-stat" title="Tus puntos">⭐ {you.points} pts</span>
            <span className="you-stat" title="Tomaste esta mano">🂠 {you.took}</span>
            <span className="you-stat" title="Cartas en mano">🖐 {you.cardCount}</span>
            {you.sang && <span className="you-canto">🎵 {you.sang}</span>}
            {isYourTurn && <span className="you-turn">Tu turno</span>}
          </div>
        )}
        <CantoPicker canSing={state.you.canSing} onSing={sing} />
        <Hand
          hand={state.you.hand}
          isYourTurn={isYourTurn || isStartBy(state.you.hand)}
          caidaPosition={caidaPosition}
          onPlay={play}
        />
      </div>
    </div>
  );
}
