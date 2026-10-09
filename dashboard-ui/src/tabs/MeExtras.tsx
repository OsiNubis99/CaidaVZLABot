// "Mi cuenta" extras: your last games (did they count? why not?), 🤝 who you
// win with, and the Acompañante (Mesa real) profile — its own view, never
// summed with the app's.
import { useQuery } from "@tanstack/react-query";
import * as api from "../api";
import { getLocale, t } from "../lib/i18n";
import { fmtDay, fmtPct } from "../lib/format";
import type { CompanionRecentGame, GameHistoryRow, PartnerRow } from "../types";

const CANTO_ROWS: [string, string][] = [
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

function scoreLine(points: number[], mySlot: number | null): string {
  if (!points.length) return "";
  if (mySlot == null || points[mySlot] == null) return points.join(" – ");
  const others = points.filter((_, i) => i !== mySlot);
  return [points[mySlot], ...others].join(" – ");
}

/** Your last finished games with the "counted / didn't count, why" badge. */
export function RecentGamesCard() {
  const q = useQuery({ queryKey: ["myGames"], queryFn: () => api.myGames(10) });
  const rows = q.data?.rows ?? [];
  return (
    <div className="card">
      <div className="card-title">{t("me.recentTitle")}</div>
      {q.isLoading ? (
        <p className="muted">{t("app.loading")}</p>
      ) : q.isError ? (
        <p className="muted">{t("me.recentError")}</p>
      ) : rows.length === 0 ? (
        <p className="muted">{t("me.recentEmpty")}</p>
      ) : (
        <ul className="history-list">
          {rows.map((r, i) => (
            <RecentRow key={`${r.at}-${i}`} row={r} />
          ))}
        </ul>
      )}
      <p className="muted history-foot">{t("me.recentFoot")}</p>
    </div>
  );
}

function RecentRow({ row }: { row: GameHistoryRow }) {
  // In parejas, split my partner from the rivals (slot = team).
  const named = row.players.filter((p) => !p.me && p.name);
  const partners =
    row.mySlot != null ? named.filter((p) => p.slot === row.mySlot).map((p) => p.name) : [];
  const rivals = named
    .filter((p) => row.mySlot == null || p.slot !== row.mySlot)
    .map((p) => p.name);
  return (
    <li className="history-row">
      <div className="history-main">
        <span className="history-when">
          {fmtDay(row.at, getLocale())} ·{" "}
          {row.source === "webapp" ? t("me.recentWebapp") : row.place || t("me.recentGroup")}
        </span>
        <span className={`history-result ${row.won ? "is-won" : ""}`}>
          {row.won ? t("me.recentWon") : t("me.recentLost")}
          <b>{scoreLine(row.points, row.mySlot)}</b>
        </span>
      </div>
      {(partners.length > 0 || rivals.length > 0) && (
        <div className="muted history-vs">
          {partners.length > 0
            ? t("me.realWithVs", { with: partners.join(" & "), vs: rivals.join(" & ") })
            : t("me.recentVs", { names: rivals.join(", ") })}
        </div>
      )}
      <div>
        {row.ranked ? (
          <span className="badge ok">
            {t("me.recentCounted", { preset: row.preset || "Clásico" })}
          </span>
        ) : (
          <span className="badge no">
            {row.reason === "bots"
              ? t("me.recentNotBots")
              : row.reason === "custom_scoring"
                ? t("me.recentNotCustom")
                : t("me.recentNotUnknown")}
          </span>
        )}
      </div>
    </li>
  );
}

/** "Mi cuenta" → 🃏 Mesa real: the full profile of the games scored at real
 *  tables, laid out like the app's (KPIs, cantos, last games) and always
 *  apart from it. No "caídas recibidas" here: real tables only record who
 *  made the caída. */
export function CompanionProfile() {
  const q = useQuery({ queryKey: ["companionMe"], queryFn: api.companionMe });
  const s = q.data?.stats;
  const recent = q.data?.recent ?? [];
  if (q.isLoading) {
    return (
      <div className="card">
        <p className="muted">{t("app.loading")}</p>
      </div>
    );
  }
  if (q.isError || !s) {
    return (
      <div className="card">
        <p className="muted">{t("me.recentError")}</p>
      </div>
    );
  }
  const rate = s.played > 0 ? Math.round((s.won / s.played) * 100) : null;
  return (
    <>
      <p className="muted top-note">{t("me.realNote")}</p>
      {s.played === 0 && s.refereed === 0 ? (
        <div className="card">
          <p className="muted">{t("me.realEmpty")}</p>
        </div>
      ) : (
        <>
          <div className="cards-row">
            <Kpi label={t("me.games")} value={s.played} />
            <Kpi label={t("me.realWon")} value={s.won} />
            <Kpi label={t("me.winRate")} value={fmtPct(rate)} />
            <Kpi label={t("me.realCaidas")} value={s.caidas} />
            <Kpi label={t("me.realMesas")} value={s.mesas} />
            <Kpi label={t("me.realPoints")} value={s.points} />
            <Kpi label={t("me.realManual")} value={s.manual} hint={t("me.realManualHint")} />
            <Kpi label={t("me.realRefereed")} value={s.refereed} hint={t("me.realRefereedHint")} />
          </div>

          <PartnersCard source="real" />

          <div className="card">
            <div className="card-title">{t("me.realCantos")}</div>
            {CANTO_ROWS.map(([k, label]) => (
              <div className="sing-row" key={k}>
                <span>{label}</span>
                <span className="cell-mono">{s.cantos[k] || 0}</span>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">{t("me.realRecent")}</div>
            {recent.length === 0 ? (
              <p className="muted">{t("me.realRecentEmpty")}</p>
            ) : (
              <ul className="history-list">
                {recent.map((g) => (
                  <CompanionRow key={g.id} game={g} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}

function CompanionRow({ game }: { game: CompanionRecentGame }) {
  const mine = game.totals[String(game.mySlot)] ?? 0;
  const others = Object.entries(game.totals)
    .filter(([slot]) => Number(slot) !== game.mySlot)
    .map(([, v]) => v);
  const partners = game.roster.filter((r) => r.slot === game.mySlot && !r.me).map((r) => r.name);
  const rivals = game.roster.filter((r) => r.slot !== game.mySlot).map((r) => r.name);
  return (
    <li className="history-row">
      <div className="history-main">
        <span className="history-when">
          {fmtDay(game.at, getLocale())} ·{" "}
          {game.mode === "parejas" ? t("cfg.parejas") : t("cfg.individual")}
        </span>
        <span className={`history-result ${game.won ? "is-won" : ""}`}>
          {game.won ? t("me.recentWon") : t("me.recentLost")}
          <b>{[mine, ...others].join(" – ")}</b>
        </span>
      </div>
      <div className="muted history-vs">
        {partners.length > 0
          ? t("me.realWithVs", { with: partners.join(" & "), vs: rivals.join(" & ") })
          : t("me.recentVs", { names: rivals.join(", ") })}
      </div>
    </li>
  );
}

export function Kpi({
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
      {hint && (
        <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/** "+7" / "−43" / "±0" — points over/under your 2v2 average. */
function fmtDelta(d: number | null): string {
  if (d == null) return "—";
  return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}`;
}

const deltaClass = (d: number | null) =>
  d == null ? "" : d > 0 ? "is-up" : d < 0 ? "is-down" : "is-even";

/** 🤝 Mis parejas: who you win with in 2v2 — app (ranked) or Mesa real,
 *  each from its own data. Like OpenDota's peers / doubles apps: games and
 *  % together, plus the ± against your own 2v2 average (so "70 % with B"
 *  reads as "+10 over my usual"), and a best partner only past a minimum. */
export function PartnersCard({ source }: { source: "app" | "real" }) {
  const q = useQuery({
    queryKey: ["partners", source],
    queryFn: source === "app" ? api.myPartners : api.companionPartners,
  });
  const s = q.data;
  return (
    <div className="card partners-card">
      <div className="card-title">{t("me.partners.title")}</div>
      {q.isLoading ? (
        <p className="muted">{t("app.loading")}</p>
      ) : q.isError || !s ? (
        <p className="muted">{t("me.recentError")}</p>
      ) : s.rows.length === 0 ? (
        <p className="muted">
          {t("me.partners.empty")}
          {source === "app" ? ` ${t("me.partners.footApp")}` : ""}
        </p>
      ) : (
        <>
          <div className="partners-highlights">
            <Highlight
              label={t("me.partners.most")}
              who={s.mostPlayed}
              detail={s.mostPlayed ? t("me.partners.games", { n: s.mostPlayed.played }) : ""}
            />
            <Highlight
              label={t("me.partners.best")}
              who={s.best}
              detail={
                s.best
                  ? `${fmtPct(s.best.rate)} · ${s.best.won}-${s.best.lost} · ${fmtDelta(s.best.delta)}`
                  : t("me.partners.noBest", { n: s.minGames })
              }
            />
          </div>
          <p className="muted partners-avg">
            {t("me.partners.avg", { pct: fmtPct(s.rate), w: s.won, l: s.played - s.won })}
          </p>
          <ul className="partners-list">
            <li className="is-head" aria-hidden="true">
              <span>{t("me.partners.colPartner")}</span>
              <span>{t("me.partners.colRecord")}</span>
              <span>%</span>
              <span>±</span>
            </li>
            {s.rows.slice(0, 12).map((r) => (
              <PartnerLine key={r.key} row={r} />
            ))}
          </ul>
          <p className="muted history-foot">
            {t("me.partners.foot", { n: s.minGames })}
            {source === "app" ? ` ${t("me.partners.footApp")}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

function Highlight({
  label,
  who,
  detail,
}: {
  label: string;
  who: PartnerRow | null;
  detail: string;
}) {
  return (
    <div className="partners-hl">
      <div className="partners-hl-label">{label}</div>
      <div className="partners-hl-who">{who ? who.name : "—"}</div>
      <div className="partners-hl-detail">{detail}</div>
    </div>
  );
}

function PartnerLine({ row }: { row: PartnerRow }) {
  return (
    <li className={row.enough ? "" : "is-few"}>
      <span className="partners-name">
        {row.name}
        {row.guest && <small className="partners-guest"> · {t("real.guestTag")}</small>}
      </span>
      <span className="cell-mono">
        {row.won}-{row.lost}
      </span>
      <span>{fmtPct(row.rate)}</span>
      <span className={`partners-delta ${deltaClass(row.delta)}`}>{fmtDelta(row.delta)}</span>
    </li>
  );
}
