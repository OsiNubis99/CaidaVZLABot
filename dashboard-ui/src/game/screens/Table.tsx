import { useMemo } from "react";
import type { GameState } from "../types";
import { isStartBy } from "../types";
import { useGame } from "../store";
import { Mesa } from "../components/Mesa";
import { Hand } from "../components/Hand";
import { Opponent } from "../components/Opponent";
import { CantoPicker } from "../components/CantoPicker";
import { EndGame } from "../components/EndGame";
import { PlayingCard } from "../components/PlayingCard";

interface Props {
  state: GameState;
}

/** The card table: rivals across the top, mesa in the center, your hand at the
 *  bottom. Reads the per-viewer GameState; emits actions via the store. */
export function Table({ state }: Props) {
  const { play, sing, leave, rematch } = useGame();

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
      <EndGame
        winner={state.winner ?? null}
        youSeat={yourSeat}
        isHost={yourSeat === 0}
        onRematch={rematch}
        onLeave={leave}
      />
    );
  }

  const turnSeatName =
    state.turnSeat != null
      ? state.seats.find((s) => s.index === state.turnSeat)?.name
      : null;

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

      <Mesa
        table={state.table}
        lastCardPlayed={state.lastCardPlayed}
        lastEvent={state.lastEvent}
        lastDeal={state.lastDeal ?? null}
      />

      {/* Last played card — always visible between the mesa and your hand. */}
      <div className="lastcard-strip">
        <span className="muted">Última</span>
        {state.lastCardPlayed ? (
          <>
            <PlayingCard card={state.lastCardPlayed} size="sm" />
            <span className="muted">
              {state.lastCardPlayed.value} de {state.lastCardPlayed.type}
            </span>
          </>
        ) : (
          <span className="muted">—</span>
        )}
      </div>

      <div className="table-bottom">
        <CantoPicker canSing={state.you.canSing} onSing={sing} />
        {/* Status rail (left) + your hand (right). Turn is shown by the row glow
            + the top pill, so the rail carries no name/turn — just your stats. */}
        <div className={`play-row ${isYourTurn ? "is-turn" : ""}`}>
          {you && (
            <div className="you-rail">
              {you.color && <span className="rail-color">{you.color}</span>}
              <span className="rail-stat" title="Tus puntos">
                ⭐ {you.points}
                <small> pts</small>
              </span>
              <span className="rail-stat" title="Tomaste esta mano">🂠 {you.took}</span>
              {you.sangDead ? (
                <span className="canto-dead" title="Canto muerto (lo mató una caída)">
                  🎵 <s>{you.sangDead}</s> 💀
                </span>
              ) : (
                <span className="rail-canto" title="Tu canto">🎵 {you.sang || "—"}</span>
              )}
            </div>
          )}
          <div className="hand-area">
            <Hand
              hand={state.you.hand}
              isYourTurn={isYourTurn || isStartBy(state.you.hand)}
              caidaPosition={caidaPosition}
              onPlay={play}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
