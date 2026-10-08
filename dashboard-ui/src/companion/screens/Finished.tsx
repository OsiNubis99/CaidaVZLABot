import type { CompanionState, RematchMode } from "../types";
import { useCompanion } from "../store";
import { t } from "../../lib/i18n";
import { slotName, wonTitle } from "../labels";

/** Saved result: winner, score, what each person contributed — and what's
 *  next: everyone again, winners stay (the rest stand up), or a new game. */
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
  const winnerNames = (res.winners ?? [])
    .map((p) => state.seats[p]?.name)
    .filter((n): n is string => Boolean(n));
  const pairWon = winnerNames.length > 1;
  const names = pairWon
    ? t("real.pair", { a: winnerNames[0], b: winnerNames[1] })
    : (winnerNames[0] ?? "");

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
      sub: pairWon ? t("real.next.winnersSub", { names }) : t("real.next.winnerSub", { names }),
    },
    { mode: "lobby", label: t("real.next.lobby"), sub: t("real.next.lobbySub") },
  ];

  return (
    <div className="endgame real-finished">
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
            <button type="button" className="btn endgame-leave" onClick={c.leave}>
              {t("endgame.leave")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
