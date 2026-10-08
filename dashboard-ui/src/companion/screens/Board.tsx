import { useState } from "react";
import type { CompanionState, RecordInput } from "../types";
import { CANTO_KEYS } from "../types";
import { useCompanion } from "../store";
import { t } from "../../lib/i18n";
import { haptic } from "../../lib/telegram";
import { Modal } from "../../components/Modal";
import { Sheet } from "../components/Sheet";
import {
  CANTO_LABEL,
  POS_CLASS,
  cardLabel,
  opLabel,
  seatName,
  slotName,
  slotTotal,
  wonTitle,
} from "../labels";

type SheetState =
  | { kind: "player"; position: number }
  | { kind: "mesa" }
  | { kind: "close" }
  | { kind: "history" }
  | null;

/** One-tap manual amounts; bigger ones go through the stepper (server cap 99). */
const QUICK_POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAX_MANUAL = 99;

/** In-game scoreboard: one button per player on each edge + "Mesa limpia" in
 *  the middle. Only the scorer (host) can tap; everyone else watches live. */
export function Board({ state }: { state: CompanionState }) {
  const c = useCompanion();
  const host = state.you.isHost;
  const [sheet, setSheet] = useState<SheetState>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const last = state.ops.length ? state.ops[state.ops.length - 1] : null;
  const blocked = state.pendingWin != null;

  const record = (input: RecordInput) => {
    c.record(input);
    haptic("ok");
    setSheet(null);
  };

  return (
    <div className="real-board">
      <div className="real-top">
        <div className="real-title">
          <b>{state.code}</b>
          <span className="muted">
            {" "}
            · {t("real.target", { n: state.target })} ·{" "}
            {state.mode === "parejas" ? t("cfg.parejas") : t("cfg.individual")}
          </span>
        </div>
        {host ? (
          <div className="real-chips">
            <button
              type="button"
              className="real-chip"
              disabled={!state.ops.length}
              onClick={() => c.undo()}
            >
              ↶ {t("real.undo")}
            </button>
            <button
              type="button"
              className="real-chip danger"
              onClick={() => setSheet({ kind: "close" })}
            >
              {t("real.close")}
            </button>
          </div>
        ) : (
          <span className="muted real-scorer">
            {state.hostPosition == null
              ? t("real.refereeIs", { name: state.hostName })
              : t("real.scoredBy", { name: state.hostName })}
          </span>
        )}
      </div>

      <div className={`real-table ${host ? "is-facing" : ""}`}>
        {[2, 3, 1, 0].map((p) => {
          const seat = state.seats[p];
          const cls = `real-seat pos-${POS_CLASS[p]}`;
          if (!seat) return <div key={p} className={`${cls} is-void`} aria-hidden />;
          const total = slotTotal(state, seat.slot);
          const pct = Math.min(100, Math.round((total / Math.max(1, state.target)) * 100));
          return (
            <button
              key={p}
              type="button"
              className={cls}
              disabled={!host || blocked}
              onClick={() => setSheet({ kind: "player", position: p })}
            >
              {/* Faces outward: the phone lies on the table and each player
                  reads their own name and score from their side. */}
              <span className="real-seat-in">
                <span className="real-seat-name">
                  <i className={`real-dot c${p}`} />
                  {seat.name}
                </span>
                <span className="real-seat-pts">{total}</span>
                {state.mode === "parejas" && (
                  <span className="real-seat-sub">{t("real.ownPts", { n: seat.points })}</span>
                )}
                <span className="real-bar">
                  <i className={`c${p}`} style={{ inlineSize: `${pct}%` }} />
                </span>
              </span>
            </button>
          );
        })}
        <div className="real-center">
          <button
            type="button"
            className="real-mesa"
            disabled={!host || blocked || state.config.mesa <= 0}
            onClick={() => setSheet({ kind: "mesa" })}
          >
            <span className="real-mesa-icon">✨</span>
            <span>{t("real.mesaLimpia")}</span>
            <small>+{state.config.mesa}</small>
          </button>
        </div>
      </div>

      <button
        type="button"
        className="real-foot"
        disabled={!state.ops.length}
        onClick={() => setSheet({ kind: "history" })}
      >
        {last ? (
          <span className="real-foot-last">
            <span className="muted">{t("real.last")}</span> <b>{seatName(state, last.seat)}</b> ·{" "}
            {opLabel(last)}
          </span>
        ) : (
          <span className="muted">{host ? t("real.emptyHintHost") : t("real.emptyHint")}</span>
        )}
        {state.ops.length > 0 && <span className="real-foot-count">≡ {state.ops.length}</span>}
      </button>

      {sheet?.kind === "player" && state.seats[sheet.position] && (
        <PlayerSheet
          state={state}
          position={sheet.position}
          onRecord={record}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === "mesa" && (
        <MesaSheet state={state} onRecord={record} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "history" && (
        <HistorySheet state={state} onUndo={(id) => c.undo(id)} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "close" && (
        <CloseSheet
          state={state}
          onWinner={(slot) => {
            setSheet(null);
            c.closeWithWinner(slot);
          }}
          onDiscard={() => {
            setSheet(null);
            setConfirmDiscard(true);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {state.pendingWin && (
        <PendingWin state={state} onConfirm={c.confirmWin} onUndo={() => c.undo()} />
      )}
      {confirmDiscard && (
        <Modal
          title={t("real.discardTitle")}
          confirmKind="danger"
          confirmLabel={t("real.discard")}
          cancelLabel={t("cfg.cancel")}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false);
            c.discard();
          }}
        >
          <p className="muted">{t("real.discardBody")}</p>
        </Modal>
      )}
    </div>
  );
}

/** A player's edge was tapped: caída 1–4, ronda 1–4, cantos, manual points. */
function PlayerSheet({
  state,
  position,
  onRecord,
  onClose,
}: {
  state: CompanionState;
  position: number;
  onRecord: (input: RecordInput) => void;
  onClose: () => void;
}) {
  const seat = state.seats[position]!;
  const cfg = state.config;
  const total = slotTotal(state, seat.slot);
  const cantos = CANTO_KEYS.filter((k) => Number(cfg[k]) > 0);
  const [extra, setExtra] = useState(11);

  return (
    <Sheet
      title={
        <>
          <i className={`real-dot c${position}`} />
          {seat.name}
        </>
      }
      sub={` · ${total} pts`}
      onClose={onClose}
    >
      {cfg.caida > 0 && (
        <>
          <div className="real-lbl">⬇ {t("real.didCaida")}</div>
          <div className="real-row4">
            {[1, 2, 3, 4].map((v) => (
              <button
                key={v}
                type="button"
                className="real-k"
                onClick={() => onRecord({ kind: "caida", seat: position, value: v })}
              >
                +{v * cfg.caida}
                <small>{cardLabel(v)}</small>
              </button>
            ))}
          </div>
        </>
      )}

      {cfg.ronda > 0 && (
        <>
          <div className="real-lbl">🎵 {t("real.ronda")}</div>
          <div className="real-row4">
            {[1, 2, 3, 4].map((v) => (
              <button
                key={v}
                type="button"
                className="real-k is-sm"
                onClick={() =>
                  onRecord({ kind: "canto", seat: position, canto: "ronda", value: v })
                }
              >
                +{v * cfg.ronda}
                <small>{cardLabel(v)}</small>
              </button>
            ))}
          </div>
        </>
      )}
      {cantos.length > 0 && (
        <>
          <div className="real-lbl">🎵 {t("real.otherCantos")}</div>
          <div className="real-grid2">
            {cantos.map((k) => (
              <button
                key={k}
                type="button"
                className={`real-c ${k === "trivilin" ? "is-win" : ""}`}
                onClick={() => onRecord({ kind: "canto", seat: position, canto: k })}
              >
                {CANTO_LABEL[k]} <span>+{cfg[k]}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Everything else the table scores (mala echada, pegado en mesa,
          cartas al final de la baraja...) is just points for this person. */}
      <div className="real-lbl">➕ {t("real.manualPts")}</div>
      <p className="muted real-hint">{t("real.manualHint")}</p>
      <div className="real-row5">
        {QUICK_POINTS.map((v) => (
          <button
            key={v}
            type="button"
            className="real-k is-xs"
            onClick={() => onRecord({ kind: "puntos", seat: position, value: v })}
          >
            +{v}
          </button>
        ))}
      </div>
      <MiniStepper
        label={t("real.manualOther")}
        value={extra}
        min={1}
        max={MAX_MANUAL}
        onChange={setExtra}
        onAdd={() => onRecord({ kind: "puntos", seat: position, value: extra })}
      />
    </Sheet>
  );
}

function MiniStepper({
  label,
  value,
  min,
  max,
  onChange,
  onAdd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="real-mini">
      <span className="real-mini-lbl">{label}</span>
      <button
        type="button"
        className="btn cfg-step"
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="cfg-value">{value}</span>
      <button
        type="button"
        className="btn cfg-step"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
      <button type="button" className="btn btn-primary real-mini-add" onClick={onAdd}>
        +{value}
      </button>
    </div>
  );
}

/** Center tapped: who cleaned the table? Shows where each total lands. */
function MesaSheet({
  state,
  onRecord,
  onClose,
}: {
  state: CompanionState;
  onRecord: (input: RecordInput) => void;
  onClose: () => void;
}) {
  const mesa = state.config.mesa;
  return (
    <Sheet title={`✨ ${t("real.whoCleaned")}`} sub={` +${mesa}`} onClose={onClose}>
      <div className="real-who">
        {state.seats.map((seat, p) => {
          if (!seat) return null;
          const before = slotTotal(state, seat.slot);
          const after = before + mesa;
          return (
            <button
              key={p}
              type="button"
              className="real-w"
              onClick={() => onRecord({ kind: "mesa", seat: p })}
            >
              <span>
                <i className={`real-dot c${p}`} />
                {seat.name}
              </span>
              <small>
                {before} → {after}
                {after >= state.target ? " 🏆" : ""}
              </small>
            </button>
          );
        })}
      </div>
      <p className="muted real-note">{t("real.targetNote")}</p>
    </Sheet>
  );
}

function HistorySheet({
  state,
  onUndo,
  onClose,
}: {
  state: CompanionState;
  onUndo: (opId: number) => void;
  onClose: () => void;
}) {
  const host = state.you.isHost;
  const ops = [...state.ops].reverse();
  return (
    <Sheet title={t("real.historyTitle")} sub={` · ${ops.length}`} onClose={onClose}>
      <ol className="real-history">
        {ops.map((op) => (
          <li key={op.id}>
            <span>
              <i className={`real-dot c${op.seat}`} />
              <b>{seatName(state, op.seat)}</b> · {opLabel(op)}
            </span>
            {host && (
              <button
                type="button"
                className="btn real-x"
                title={t("real.removeOp")}
                onClick={() => onUndo(op.id)}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

/** "Cerrar": end now with a chosen winner (saved), or drop it unsaved. */
function CloseSheet({
  state,
  onWinner,
  onDiscard,
  onClose,
}: {
  state: CompanionState;
  onWinner: (slot: number) => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={t("real.closeTitle")} onClose={onClose}>
      <p className="muted real-note">{t("real.closeBody")}</p>
      <div className="real-who">
        {state.slots.map((s) => (
          <button key={s.slot} type="button" className="real-w" onClick={() => onWinner(s.slot)}>
            <span>🏆 {slotName(state, s.slot)}</span>
            <small>{s.total} pts</small>
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-danger real-wide" onClick={onDiscard}>
        {t("real.discard")}
      </button>
    </Sheet>
  );
}

/** Someone reached the target: the scorer confirms (saves) or undoes a mis-tap. */
function PendingWin({
  state,
  onConfirm,
  onUndo,
}: {
  state: CompanionState;
  onConfirm: () => void;
  onUndo: () => void;
}) {
  const slot = state.pendingWin!.slot;
  const winner = slotTotal(state, slot);
  const rest = state.slots.filter((s) => s.slot !== slot).map((s) => s.total);
  return (
    <div className="real-sheet-backdrop is-center">
      <div className="real-win">
        <div className="endgame-emoji">🏆</div>
        <h3>{wonTitle(state, slot)}</h3>
        <p className="real-win-score">{[winner, ...rest].join(" – ")}</p>
        {state.you.isHost ? (
          <>
            <button type="button" className="btn btn-primary real-wide" onClick={onConfirm}>
              {t("real.saveResult")}
            </button>
            <button type="button" className="btn real-wide" onClick={onUndo}>
              ↶ {t("real.undoMistake")}
            </button>
          </>
        ) : (
          <p className="muted">{t("real.waitingScorer", { name: state.hostName })}</p>
        )}
      </div>
    </div>
  );
}
