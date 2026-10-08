import type { CompanionSeat, CompanionState, RematchMode } from "../types";
import { useCompanion } from "../store";
import { t } from "../../lib/i18n";
import { slotName, wonTitle } from "../labels";
import { ClaimBanner, PeopleChip, QueueCta } from "../components/People";

/** Saved result: winner, score, what each person contributed — and what's
 *  next: everyone again, winners stay (the line takes the losers' seats), or
 *  a new game from the lobby. */
export function Finished({ state }: { state: CompanionState }) {
  const c = useCompanion();
  const res = state.result;
  if (!res) return null;
  const host = state.you.isHost;
  const mySlot =
    state.you.position != null ? (state.seats[state.you.position]?.slot ?? null) : null;
  const youWon = mySlot != null && mySlot === res.winnerSlot;
  const slots = [...state.slots].sort(
    (a, b) => (res.totals[b.slot] ?? b.total) - (res.totals[a.slot] ?? a.total),
  );
  const score = slots.map((s) => res.totals[s.slot] ?? s.total).join(" – ");
  const hasGuests = state.seats.some((s) => s?.guest);
  const seated = state.seats.filter(Boolean).length;
  const winners = new Set(res.winners ?? []);
  const winnerNames = (res.winners ?? [])
    .map((p) => state.seats[p]?.name)
    .filter((n): n is string => Boolean(n));
  const pairWon = winnerNames.length > 1;
  // Preview of "siguen los ganadores": the losers go to the end of the line,
  // every free seat is taken from the front of it.
  const losers = state.seats.filter((s): s is CompanionSeat => !!s && !winners.has(s.position));
  const freeSeats = state.seats.filter((s) => !s || !winners.has(s.position)).length;
  const entering = [...state.queue.map((e) => e.name), ...losers.map((s) => s.name)].slice(
    0,
    freeSeats,
  );

  const options: { mode: RematchMode; label: string; sub: string; primary?: boolean }[] = [
    {
      mode: "again",
      label: t("real.next.again"),
      sub: t("real.next.againSub"),
      primary: true,
    },
    {
      mode: "winners",
      label: pairWon ? t("real.next.winners") : t("real.next.winner"),
      sub:
        state.queue.length === 0
          ? t("real.next.winnersNoQueue")
          : t("real.next.winnersIn", { names: entering.join(" · ") }),
    },
    { mode: "lobby", label: t("real.next.lobby"), sub: t("real.next.lobbySub") },
  ];

  return (
    <div className="endgame real-finished">
      <div className="real-fin-top">
        <PeopleChip state={state} />
      </div>
      <div className={`endgame-banner ${youWon ? "won" : ""}`}>
        <div className="endgame-emoji">🏆</div>
        <h2>{youWon ? t("real.youWon") : wonTitle(state, res.winnerSlot)}</h2>
        <p className="muted">
          {score}
          {res.endedBy === "manual" ? ` · ${t("real.endedManual")}` : ""}
        </p>
      </div>

      <div className="real-result">
        {slots.map((s) => (
          <div
            key={s.slot}
            className={`real-result-slot ${s.slot === res.winnerSlot ? "is-winner" : ""}`}
          >
            <div className="real-result-head">
              <span>{slotName(state, s.slot)}</span>
              <b>{res.totals[s.slot] ?? s.total}</b>
            </div>
            {s.positions.map((p) => {
              const seat = state.seats[p];
              if (!seat) return null;
              return (
                <div key={p} className="real-result-row">
                  <span>
                    <i className={`real-dot c${p}`} />
                    {seat.name}
                    {seat.guest && <small className="muted"> {t("real.guestTag")}</small>}
                  </span>
                  <span className="muted">
                    {t("real.contrib", {
                      pts: seat.points,
                      caidas: seat.caidas,
                      cantos: seat.cantos,
                      mesas: seat.mesas,
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="muted real-saved">
        ✓ {t("real.saved")}
        {hasGuests ? ` ${t("real.savedGuests")}` : ""}
      </p>

      <div className="endgame-actions">
        {host ? (
          <>
            <div className="real-next">
              {options.map((o) => (
                <button
                  key={o.mode}
                  type="button"
                  className={`btn ${o.primary ? "btn-primary" : ""}`}
                  disabled={
                    (o.mode === "again" && seated < 2) ||
                    (o.mode === "winners" && winnerNames.length === 0)
                  }
                  onClick={() => c.rematch(o.mode)}
                >
                  {o.label}
                  <small>{o.sub}</small>
                </button>
              ))}
            </div>
            <button type="button" className="btn endgame-leave" onClick={c.discard}>
              {t("real.closeTable")}
            </button>
          </>
        ) : (
          <>
            <span className="muted">{t("real.waitingRematch", { name: state.hostName })}</span>
            <ClaimBanner state={state} />
            <QueueCta state={state} />
            <button type="button" className="btn endgame-leave" onClick={c.leave}>
              {t("endgame.leave")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
