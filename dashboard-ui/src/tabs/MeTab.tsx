import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api";
import { useToast } from "../components/Toast";
import { t } from "../lib/i18n";
import { winRate, caidaRatio, fmtPct, fmtRate } from "../lib/format";
import type { MeResponse, UserRow } from "../types";

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

export function MeTab({ me }: { me: MeResponse }) {
  const u = me.user ?? ({} as UserRow);
  const toast = useToast();
  const qc = useQueryClient();

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
        <Kpi label={t("me.caidaRatio")} value={fmtRate(caidaRatio(u))} hint={t("me.caidaRatioHint")} />
      </div>

      <div className="card">
        <div className="card-title">{t("me.cantos")}</div>
        {finished === 0 ? (
          <p className="muted">{t("me.noCantos")}</p>
        ) : (
          SINGS.map(([k, label]) => {
            const total = Number(u[k]) || 0;
            const alive =
              Number(u[("alive_" + (k as string)) as keyof UserRow]) || 0;
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
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
