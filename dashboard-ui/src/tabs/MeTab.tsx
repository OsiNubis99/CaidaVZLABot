import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import { useToast } from "../components/Toast";
import { ViewSwitch, useStatsView } from "../components/ViewSwitch";
import { t } from "../lib/i18n";
import { winRate, caidaRatio, fmtPct, fmtRate } from "../lib/format";
import { keepAwakeWanted, setKeepAwake, useKeepAwakeMode, type AwakeMode } from "../lib/keepAwake";
import type { MeResponse, UserRow } from "../types";
import { CompanionProfile, Kpi, PartnersCard, RecentGamesCard } from "./MeExtras";

const SINGS: Array<[keyof UserRow, string]> = [
  ["ronda", "Ronda"],
  ["chiguire", "Chigüire"],
  ["patrulla", "Patrulla"],
  ["vigia", "Vigía"],
  ["registro", "Registro"],
  ["maguaro", "Maguaro"],
  ["registrico", "Registrico"],
  ["casa_chica", "Casa chica"],
  ["casa_grande", "Casa grande"],
  ["trivilin", "Trivilín"],
];

/** Mi cuenta: your stats in the app OR at real tables (🃏 Mesa real) — the
 *  same App / Mesa real switch as Top, two systems never summed. */
export function MeTab({ me }: { me: MeResponse }) {
  const u = me.user ?? ({} as UserRow);
  const toast = useToast();
  const qc = useQueryClient();
  const [view, setView] = useStatsView();

  const notify = useMutation({
    mutationFn: (value: boolean) => api.setMyNotify(value),
    onSuccess: (data) => {
      toast(data.notify_on_turn ? t("me.notifyOn") : t("me.notifyOff"));
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (err: Error) => toast("Error: " + err.message, "err"),
  });

  const finished = Number(u.finished) || 0;
  const win = Number(u.win) || 0;
  const beatPro = Number(u.beat_pro) || 0;
  const caida = Number(u.caida) || 0;
  const caido = Number(u.caido) || 0;

  return (
    <section className="tab-panel">
      <div className="toolbar">
        <ViewSwitch value={view} onChange={setView} />
      </div>

      {view === "real" ? (
        <CompanionProfile />
      ) : (
        <>
          {beatPro > 0 && (
            <div className="achievement-badge">
              {t("me.beatPro")} {beatPro > 1 ? `×${beatPro}` : ""}
            </div>
          )}
          <div className="cards-row">
            <Kpi label={t("me.games")} value={finished} />
            <Kpi label={t("me.won")} value={win} hint={t("me.wonHint")} />
            <Kpi label={t("me.winRate")} value={fmtPct(winRate(u))} />
            <Kpi label={t("me.caidasGiven")} value={caida} />
            <Kpi label={t("me.caidasReceived")} value={caido} />
            <Kpi
              label={t("me.caidaRatio")}
              value={fmtRate(caidaRatio(u))}
              hint={t("me.caidaRatioHint")}
            />
          </div>

          <PartnersCard source="app" />

          <div className="card">
            <div className="card-title">{t("me.cantos")}</div>
            {finished === 0 ? (
              <p className="muted">{t("me.noCantos")}</p>
            ) : (
              SINGS.map(([k, label]) => {
                const total = Number(u[k]) || 0;
                const alive = Number(u[("alive_" + (k as string)) as keyof UserRow]) || 0;
                return (
                  <div className="sing-row" key={k as string}>
                    <span>{label}</span>
                    <span className="cell-mono">
                      {alive} / {total}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <RecentGamesCard />
        </>
      )}

      <div className="card">
        <div className="card-title">{t("me.prefs")}</div>
        <label className="row-toggle">
          <span>
            <strong>{t("me.notifyTitle")}</strong>
            <small className="muted">{t("me.notifyHint")}</small>
          </span>
          <input
            type="checkbox"
            checked={!!u.notify_on_turn}
            onChange={(e) => notify.mutate(e.target.checked)}
            disabled={notify.isPending}
          />
        </label>
        <KeepAwakeToggle />
      </div>
    </section>
  );
}

const AWAKE_STATUS: Record<AwakeMode, Parameters<typeof t>[0]> = {
  wakelock: "me.awakeOn",
  video: "me.awakeVideo",
  failed: "me.awakeFailed",
  off: "me.awakePending",
};

/** Keep the screen on while the app is open (the referee's phone on the
 *  table). Local to this device; the status line says whether it took. */
function KeepAwakeToggle() {
  const [on, setOn] = useState(keepAwakeWanted);
  const mode = useKeepAwakeMode();
  return (
    <label className="row-toggle">
      <span>
        <strong>{t("me.awakeTitle")}</strong>
        <small className="muted">{t("me.awakeHint")}</small>
        {on && <small className={`awake-status is-${mode}`}>{t(AWAKE_STATUS[mode])}</small>}
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => {
          setKeepAwake(e.target.checked);
          setOn(e.target.checked);
        }}
      />
    </label>
  );
}
