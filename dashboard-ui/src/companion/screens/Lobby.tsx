import { useState } from "react";
import type { CompanionState } from "../types";
import { useCompanion } from "../store";
import { t } from "../../lib/i18n";
import { openTelegramLink } from "../../lib/telegram";
import { CreateConfig } from "../../game/components/CreateConfig";
import { configSummary, matchPreset } from "../../game/configDefaults";
import { Modal } from "../../components/Modal";
import { Sheet } from "../components/Sheet";
import { ClaimBanner, PeopleChip, QueueCta } from "../components/People";
import { POS_CLASS } from "../labels";

const BOT = "CaidaVZLABot";

/** Seat everyone as they sit at the real table. The host taps a seat, then
 *  another (empty seats too) to move people; partners sit across (A/B). */
export function Lobby({ state }: { state: CompanionState }) {
  const c = useCompanion();
  const host = state.you.isHost;
  const [picked, setPicked] = useState<number | null>(null);
  const [emptySeat, setEmptySeat] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  if (editing && host) {
    return (
      <div className="lobby">
        <CreateConfig
          variant="companion"
          initial={state.config}
          title={t("real.configTitle")}
          submitLabel={t("lobby.saveConfig")}
          onCancel={() => setEditing(false)}
          onSubmit={(config) => {
            setEditing(false);
            c.setConfig(config);
          }}
        />
      </div>
    );
  }

  const seated = state.seats.filter(Boolean).length;
  const parejas = state.config.type === "parejas";
  // Ignore a pick whose seat emptied meanwhile (someone left / was removed).
  const sel = picked != null && state.seats[picked] ? picked : null;
  const preset = matchPreset(state.config);

  const tap = (p: number) => {
    if (!host) return;
    if (sel == null) {
      if (state.seats[p]) setPicked(p);
      else setEmptySeat(p);
      return;
    }
    if (sel !== p) c.swap(sel, p);
    setPicked(null);
  };

  const deepLink = `https://t.me/${BOT}?startapp=${state.code}`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(
    t("real.inviteText", { code: state.code }),
  )}`;

  const hint = !host
    ? t("real.lobbyHintGuest", { name: state.hostName })
    : sel != null
      ? t("real.lobbyHintMove", { name: state.seats[sel]?.name ?? "" })
      : t("real.lobbyHintHost");

  return (
    <div className="lobby real-lobby">
      <div className="lobby-head">
        <div>
          <div className="muted">{t("real.codeLabel")}</div>
          <div className="lobby-code">{state.code}</div>
        </div>
        <div className="real-head-actions">
          <PeopleChip state={state} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openTelegramLink(shareUrl)}
          >
            {t("lobby.invite")}
          </button>
        </div>
      </div>

      <div className="lobby-config">
        <span className="muted">
          ⚙️ {configSummary(state.config)}
          {preset ? ` · ${preset.name}` : ""}
        </span>
        {host && (
          <button type="button" className="btn lobby-config-edit" onClick={() => setEditing(true)}>
            {t("lobby.configure")}
          </button>
        )}
      </div>

      <div className="real-table is-lobby">
        {[2, 3, 1, 0].map((p) => {
          const seat = state.seats[p];
          const team = parejas ? (p % 2 === 0 ? "A" : "B") : null;
          return (
            <button
              key={p}
              type="button"
              className={[
                "real-seat",
                `pos-${POS_CLASS[p]}`,
                seat ? "" : "is-empty",
                sel === p ? "is-picked" : "",
                sel != null && sel !== p ? "is-target" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={!host}
              onClick={() => tap(p)}
            >
              {/* one wrapper so the side seats can turn as a whole (vertical) */}
              {seat ? (
                <span className="real-seat-in">
                  <span className="real-seat-name">
                    <i className={`real-dot c${p}`} />
                    {seat.name}
                  </span>
                  <span className="real-seat-tags">
                    {seat.isHost && <small>{t("real.scorerTag")}</small>}
                    {seat.guest && <small>{t("real.guestTag")}</small>}
                    {state.you.position === p && <small>{t("real.youTag")}</small>}
                    {!seat.guest && !seat.online && (
                      <small className="is-off">{t("real.offline")}</small>
                    )}
                  </span>
                </span>
              ) : (
                <span className="real-seat-in">
                  <span className="real-seat-free">
                    {host ? `+ ${t("real.sit")}` : t("lobby.free")}
                  </span>
                </span>
              )}
              {team && <span className={`team-tag team-${team}`}>{team}</span>}
            </button>
          );
        })}
        <div className="real-center">
          <div className="real-felt">{hint}</div>
        </div>
      </div>

      {host && sel != null && state.seats[sel] && (
        <div className="real-selbar">
          <span>{t("real.selected", { name: state.seats[sel]!.name })}</span>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              c.kick(sel);
              setPicked(null);
            }}
          >
            {sel === state.hostPosition ? t("real.standUp") : t("real.remove")}
          </button>
          <button type="button" className="btn" onClick={() => setPicked(null)}>
            {t("cfg.cancel")}
          </button>
        </div>
      )}

      <p className="muted lobby-legend">
        {parejas
          ? seated === 4
            ? t("real.legendTeams")
            : t("real.legendTeamsNeed4")
          : t("real.legendIndividual")}
      </p>
      {state.hostPosition == null &&
        (host ? (
          <div className="real-referee">
            <span>🧑‍⚖️ {t("real.refereeYou")}</span>
            <button
              type="button"
              className="btn"
              disabled={seated >= state.seats.length}
              onClick={() => c.sit()}
            >
              {t("real.playToo")}
            </button>
          </div>
        ) : (
          <p className="muted lobby-legend">🧑‍⚖️ {t("real.refereeIs", { name: state.hostName })}</p>
        ))}
      {!host &&
        state.you.position == null &&
        (seated < state.seats.length && state.queue.length === 0 ? (
          <div className="real-referee">
            <span>{t("real.watching")}</span>
            <button type="button" className="btn btn-primary" onClick={() => c.join(state.code)}>
              {t("real.sitMe")}
            </button>
          </div>
        ) : (
          <QueueCta state={state} />
        ))}
      <ClaimBanner state={state} />

      <div className="lobby-actions">
        {host ? (
          <button
            type="button"
            className="btn btn-primary lobby-start"
            disabled={seated < 2}
            onClick={c.start}
          >
            {t("lobby.start")}
          </button>
        ) : (
          <span className="muted">{t("real.waitingHost", { name: state.hostName })}</span>
        )}
        {host ? (
          <button type="button" className="btn" onClick={() => setConfirmClose(true)}>
            {t("real.closeTable")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={c.leave}>
            {t("lobby.leave")}
          </button>
        )}
      </div>
      {host && seated < 2 && <p className="muted lobby-hint">{t("lobby.needPlayers")}</p>}

      {emptySeat != null && (
        <EmptySeatSheet state={state} position={emptySeat} onClose={() => setEmptySeat(null)} />
      )}
      {confirmClose && (
        <Modal
          title={t("real.closeTableTitle")}
          confirmKind="danger"
          confirmLabel={t("real.closeTable")}
          cancelLabel={t("cfg.cancel")}
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            c.discard();
          }}
        >
          <p className="muted">{t("real.closeTableBody")}</p>
        </Modal>
      )}
    </div>
  );
}

/** Empty seat tapped: seat the next in line, a guest (no account), or the
 *  referee themselves. */
function EmptySeatSheet({
  state,
  position,
  onClose,
}: {
  state: CompanionState;
  position: number;
  onClose: () => void;
}) {
  const c = useCompanion();
  const [name, setName] = useState("");
  return (
    <Sheet title={t("real.emptySeatTitle")} onClose={onClose}>
      {state.queue.length > 0 && (
        <>
          <div className="real-lbl">🙋 {t("real.queue.fromLine")}</div>
          <div className="real-who">
            {state.queue.slice(0, 4).map((e, i) => (
              <button
                key={e.qid}
                type="button"
                className="real-w"
                onClick={() => {
                  c.seatQueued(e.qid, position);
                  onClose();
                }}
              >
                <span>
                  {i + 1}. {e.name}
                </span>
                <small>{e.guest ? t("real.guestTag") : e.online ? "" : t("real.offline")}</small>
              </button>
            ))}
          </div>
          <div className="real-lbl">{t("real.queue.orGuest")}</div>
        </>
      )}
      <form
        className="prelobby-join"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          c.addGuest(name.trim(), position);
          onClose();
        }}
      >
        <input
          className="input"
          maxLength={32}
          placeholder={t("real.guestPlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          {t("real.seatGuest")}
        </button>
      </form>
      <p className="muted real-note">{t("real.guestNote")}</p>
      {state.hostPosition == null && (
        <button
          type="button"
          className="btn real-wide"
          onClick={() => {
            c.sit(position);
            onClose();
          }}
        >
          {t("real.sitHere")}
        </button>
      )}
      <p className="muted real-note">{t("real.inviteNote")}</p>
    </Sheet>
  );
}
