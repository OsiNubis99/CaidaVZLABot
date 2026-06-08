import { useState } from "react";
import type { GameState, CpuDifficulty } from "../types";
import { useGame } from "../store";
import { openTelegramLink } from "../../lib/telegram";
import { t } from "../../lib/i18n";
import type { Dict } from "../../lib/i18n.dict";
import { CreateConfig } from "../components/CreateConfig";
import { configSummary } from "../configDefaults";

const BOT = "CaidaVZLABot";
const DIFFS: { id: CpuDifficulty; labelKey: keyof Dict }[] = [
  { id: "easy", labelKey: "lobby.diff.easy" },
  { id: "medium", labelKey: "lobby.diff.medium" },
  { id: "pro", labelKey: "lobby.diff.pro" },
];

interface Props {
  /** Null until the viewer has created/joined a session. */
  state: GameState | null;
  youId: number | null;
}

/** Lobby: create or join a session, fill seats with CPUs, start. Once a session
 *  exists (`state` non-null), shows the seat roster + host controls. */
export function Lobby({ state, youId }: Props) {
  const game = useGame();
  const [editingConfig, setEditingConfig] = useState(false);

  if (!state) return <PreLobby />;

  // Host is seat 0 (per spec). We can't see rivals' userIds, but the viewer is
  // the host iff they occupy seat 0.
  const isHost = youId != null && state.you.seat === 0;

  // Host editing the rules from the lobby (the usual place to configure).
  if (editingConfig && isHost) {
    return (
      <div className="lobby">
        <CreateConfig
          initial={state.config}
          title={t("lobby.configureTitle", { code: state.code })}
          submitLabel={t("lobby.saveConfig")}
          onCancel={() => setEditingConfig(false)}
          onSubmit={(config) => {
            setEditingConfig(false);
            game.setConfig(config);
          }}
        />
      </div>
    );
  }

  const filled = state.seats.length;
  const canStart = isHost && filled >= 2;
  // Deep link into this table. Opens the WebApp with start_param=<code> when
  // the bot has a Main Mini App enabled; the code in the text is the fallback
  // (friend opens the bot → 🎮 Jugar → Unirme → pega el código).
  const deepLink = `https://t.me/${BOT}?startapp=${state.code}`;
  const inviteText = t("lobby.inviteText", { code: state.code });
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    deepLink,
  )}&text=${encodeURIComponent(inviteText)}`;

  return (
    <div className="lobby">
      <div className="lobby-head">
        <div>
          <div className="muted">{t("lobby.code")}</div>
          <div className="lobby-code">{state.code}</div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openTelegramLink(shareUrl)}
        >
          {t("lobby.invite")}
        </button>
      </div>

      <div className="lobby-config" title={t("lobby.rulesTitle")}>
        <span className="muted">⚙️ {configSummary(state.config)}</span>
        {isHost && (
          <button
            type="button"
            className="btn lobby-config-edit"
            onClick={() => setEditingConfig(true)}
          >
            {t("lobby.configure")}
          </button>
        )}
      </div>

      <div className="lobby-seats">
        {state.seats.map((seat) => (
          <div className="lobby-seat" key={seat.index}>
            <span className="lobby-seat-idx">{seat.index + 1}</span>
            <span className="lobby-seat-name">
              {seat.name}
              {seat.kind === "cpu" && <span className="badge cpu">{t("opp.cpu")}</span>}
              {seat.index === 0 && <span className="muted">{t("lobby.host")}</span>}
            </span>
            {isHost && seat.kind === "cpu" && (
              <button
                type="button"
                className="btn btn-danger lobby-seat-x"
                onClick={() => game.removeCpu(seat.index)}
                title={t("lobby.removeCpu")}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - filled) }).map((_, i) => (
          <div className="lobby-seat lobby-seat-empty" key={`e${i}`}>
            <span className="lobby-seat-idx">{filled + i + 1}</span>
            <span className="muted">{t("lobby.free")}</span>
          </div>
        ))}
      </div>

      {isHost && filled < 4 && (
        <div className="lobby-cpu">
          <span className="muted">{t("lobby.addCpu")}</span>
          {DIFFS.map((d) => (
            <button
              key={d.id}
              type="button"
              className="btn"
              onClick={() => game.addCpu(d.id)}
            >
              + {t(d.labelKey)}
            </button>
          ))}
        </div>
      )}

      <div className="lobby-actions">
        {isHost ? (
          <button
            type="button"
            className="btn btn-primary lobby-start"
            disabled={!canStart}
            onClick={game.start}
          >
            {t("lobby.start")}
          </button>
        ) : (
          <span className="muted">{t("lobby.waitingHost")}</span>
        )}
        <button type="button" className="btn" onClick={game.leave}>
          {t("lobby.leave")}
        </button>
      </div>

      {!canStart && isHost && (
        <p className="muted lobby-hint">{t("lobby.needPlayers")}</p>
      )}
    </div>
  );
}

/** No session yet: create one (with optional config) or join by code. */
function PreLobby() {
  const game = useGame();
  const [code, setCode] = useState("");
  const [configuring, setConfiguring] = useState(false);

  if (configuring) {
    return (
      <div className="lobby lobby-pre">
        <CreateConfig
          submitLabel={t("cfg.create")}
          onCancel={() => setConfiguring(false)}
          onSubmit={(config) => {
            setConfiguring(false);
            game.createSession(config);
          }}
        />
      </div>
    );
  }

  return (
    <div className="lobby lobby-pre">
      <div className="prelobby-card">
        <h3>{t("prelobby.title")}</h3>
        <p className="muted">{t("prelobby.body")}</p>
        <button
          type="button"
          className="btn btn-primary prelobby-create"
          onClick={() => game.createSession()}
        >
          {t("prelobby.createQuick")}
        </button>
        <button
          type="button"
          className="btn prelobby-configure"
          onClick={() => setConfiguring(true)}
        >
          {t("prelobby.createConfig")}
        </button>

        <div className="prelobby-sep">
          <span>{t("prelobby.or")}</span>
        </div>

        <form
          className="prelobby-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) game.joinSession(code);
          }}
        >
          <input
            className="input"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            placeholder={t("prelobby.codePlaceholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!code.trim()}>
            {t("prelobby.join")}
          </button>
        </form>
      </div>
    </div>
  );
}
