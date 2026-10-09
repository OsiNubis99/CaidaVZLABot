import { useEffect, useState } from "react";
import type { CompanionState } from "../types";
import { useCompanion } from "../store";
import { t } from "../../lib/i18n";
import { Modal } from "../../components/Modal";
import { Sheet } from "./Sheet";

/** Everyone around the table: referee (if not seated), players, line, watchers. */
export function peopleCount(state: CompanionState): number {
  const seated = state.seats.filter(Boolean).length;
  const referee = state.hostPosition == null ? 1 : 0;
  return seated + referee + state.queue.length + state.spectators.length;
}

/** ms left (ticking locally) from a server value received with the last state. */
function useRemaining(ms: number | null): number | null {
  const [base, setBase] = useState({ at: Date.now(), ms });
  const [, tick] = useState(0);
  useEffect(() => setBase({ at: Date.now(), ms }), [ms]);
  useEffect(() => {
    if (base.ms == null || base.ms <= 0) return;
    const h = window.setInterval(() => tick((x) => x + 1), 5000);
    return () => window.clearInterval(h);
  }, [base]);
  if (base.ms == null) return null;
  return Math.max(0, base.ms - (Date.now() - base.at));
}

/** "👥 7 · 🙋 2" — opens the list of who's at the table. */
export function PeopleChip({ state }: { state: CompanionState }) {
  const [open, setOpen] = useState(false);
  const waiting = state.queue.length;
  return (
    <>
      <button
        type="button"
        className="real-chip"
        aria-label={t("real.people.title")}
        onClick={() => setOpen(true)}
      >
        👥 {peopleCount(state)}
        {waiting > 0 ? ` · 🙋 ${waiting}` : ""}
      </button>
      {open && <PeopleSheet state={state} onClose={() => setOpen(false)} />}
    </>
  );
}

/** The referee is offline: say so, and let others take over once allowed. */
export function ClaimBanner({ state }: { state: CompanionState }) {
  const c = useCompanion();
  const left = useRemaining(state.you.claimInMs);
  if (state.you.isHost || state.hostOnline || left == null) return null;
  return (
    <div className="real-referee is-away">
      <span>
        🧑‍⚖️ {t("real.role.away", { name: state.hostName })}
        {left > 0 && (
          <small className="muted">
            {" "}
            {t("real.role.claimIn", { n: Math.max(1, Math.ceil(left / 60000)) })}
          </small>
        )}
      </span>
      {left === 0 && (
        <button type="button" className="btn btn-primary" onClick={c.claim}>
          {t("real.role.claim")}
        </button>
      )}
    </div>
  );
}

/** Someone watching (not seated, not the referee): get in line / leave it. */
export function QueueCta({ state }: { state: CompanionState }) {
  const c = useCompanion();
  if (state.you.isHost || state.you.position != null) return null;
  if (state.you.queued != null) {
    return (
      <div className="real-referee">
        <span>🙋 {t("real.queue.youAre", { n: state.you.queued })}</span>
        <button type="button" className="btn" onClick={c.queueLeave}>
          {t("real.queue.leave")}
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-primary real-wide real-queue-join"
      onClick={c.queueJoin}
    >
      🙋 {t("real.queue.join")}
    </button>
  );
}

type Pass = { pid: string; name: string } | null;

function Tags({ guest, you, offline }: { guest?: boolean; you?: boolean; offline?: boolean }) {
  return (
    <>
      {guest && <small className="real-tag">{t("real.guestTag")}</small>}
      {you && <small className="real-tag">{t("real.youTag")}</small>}
      {offline && <small className="real-tag is-off">{t("real.offline")}</small>}
    </>
  );
}

/** Referee, players, the line and who's watching — with the referee's tools. */
function PeopleSheet({ state, onClose }: { state: CompanionState; onClose: () => void }) {
  const c = useCompanion();
  const host = state.you.isHost;
  const [guest, setGuest] = useState("");
  const [pass, setPass] = useState<Pass>(null);
  const seated = state.seats.filter((s) => s != null);

  const passBtn = (pid: string | undefined, name: string, online: boolean) =>
    host && pid && online ? (
      <button type="button" className="btn real-mini-btn" onClick={() => setPass({ pid, name })}>
        🧑‍⚖️ {t("real.role.pass")}
      </button>
    ) : null;

  return (
    <Sheet
      title={`👥 ${t("real.people.title")}`}
      sub={` · ${peopleCount(state)}`}
      onClose={onClose}
    >
      <div className="real-lbl">🧑‍⚖️ {t("real.people.referee")}</div>
      <ul className="real-people">
        <li>
          <span className="real-people-name">
            {state.hostName}
            {state.hostPosition != null && (
              <small className="muted"> · {t("real.people.alsoPlays")}</small>
            )}
            <Tags you={host} offline={!state.hostOnline} />
          </span>
        </li>
      </ul>
      <ClaimBanner state={state} />

      <div className="real-lbl">🃏 {t("real.people.players")}</div>
      <ul className="real-people">
        {seated.map((s) => (
          <li key={s.position}>
            <span className="real-people-name">
              <i className={`real-dot c${s.position}`} />
              {s.name}
              <Tags
                guest={s.guest}
                you={state.you.position === s.position}
                offline={!s.guest && !s.online}
              />
            </span>
            {!s.isHost && passBtn(s.pid, s.name, s.online)}
          </li>
        ))}
      </ul>

      <div className="real-lbl">
        🙋 {t("real.people.queue")}
        {state.queue.length > 0 ? ` · ${state.queue.length}` : ""}
      </div>
      {state.queue.length === 0 ? (
        <p className="muted real-people-empty">{t("real.people.emptyQueue")}</p>
      ) : (
        <ol className="real-people is-queue">
          {state.queue.map((e) => (
            <li key={e.qid}>
              <span className="real-people-name">
                {e.name}
                <Tags guest={e.guest} you={e.you} offline={!e.guest && !e.online} />
              </span>
              {passBtn(e.pid, e.name, e.online)}
              {host && (
                <button
                  type="button"
                  className="btn real-x"
                  title={t("real.people.remove")}
                  onClick={() => c.queueRemove(e.qid)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {host && (
        <form
          className="prelobby-join real-people-add"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!guest.trim()) return;
            c.queueAdd(guest.trim());
            setGuest("");
          }}
        >
          <input
            className="input"
            maxLength={32}
            placeholder={t("real.people.addPlaceholder")}
            value={guest}
            onChange={(ev) => setGuest(ev.target.value)}
          />
          <button type="submit" className="btn" disabled={!guest.trim()}>
            {t("real.people.add")}
          </button>
        </form>
      )}

      {state.spectators.length > 0 && (
        <>
          <div className="real-lbl">
            👀 {t("real.people.watching")} · {state.spectators.length}
          </div>
          <ul className="real-people">
            {state.spectators.map((x) => (
              <li key={x.pid}>
                <span className="real-people-name">
                  {x.name}
                  <Tags you={x.you} />
                </span>
                {passBtn(x.pid, x.name, true)}
              </li>
            ))}
          </ul>
        </>
      )}

      <QueueCta state={state} />

      {pass && (
        <Modal
          title={t("real.role.passTitle", { name: pass.name })}
          confirmLabel={t("real.role.passConfirm")}
          cancelLabel={t("cfg.cancel")}
          onCancel={() => setPass(null)}
          onConfirm={() => {
            c.transfer(pass.pid);
            setPass(null);
            onClose();
          }}
        >
          <p className="muted">{t("real.role.passBody")}</p>
        </Modal>
      )}
    </Sheet>
  );
}
