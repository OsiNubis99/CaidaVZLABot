// "Mi cuenta" extras: your last games (did they count? why not?) and the
// Acompañante (Mesa real) stats — shown apart, never summed with the app's.
import { useQuery } from "@tanstack/react-query";
import * as api from "../api";
import { getLocale, t } from "../lib/i18n";
import { fmtDay, fmtPct } from "../lib/format";
import type { CompanionRecentGame, GameHistoryRow } from "../types";

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

/** Acompañante stats: games scored at real tables (separate from the app). */
export function CompanionStatsCard() {
  const q = useQuery({ queryKey: ["companionMe"], queryFn: api.companionMe });
  const s = q.data?.stats;
  const recent = q.data?.recent ?? [];
  return (
    <div className="card companion-card">
      <div className="card-title">
        {t("me.realTitle")} <span className="muted">· {t("me.realSeparate")}</span>
      </div>
      {q.isLoading ? (
        <p className="muted">{t("app.loading")}</p>
      ) : q.isError || !s ? (
        <p className="muted">{t("me.recentError")}</p>
      ) : s.played === 0 ? (
        <p className="muted">{t("me.realEmpty")}</p>
      ) : (
        <>
          <div className="cards-row">
            <Mini label={t("me.games")} value={s.played} />
            <Mini label={t("me.realWon")} value={s.won} />
            <Mini label={t("me.winRate")} value={fmtPct(Math.round((s.won / s.played) * 100))} />
            <Mini label={t("me.realCaidas")} value={s.caidas} />
            <Mini label={t("me.realMesas")} value={s.mesas} />
            <Mini label={t("me.realPoints")} value={s.points} />
          </div>
          {CANTO_ROWS.some(([k]) => (s.cantos[k] || 0) > 0) && (
            <div className="real-cantos">
              {CANTO_ROWS.filter(([k]) => (s.cantos[k] || 0) > 0).map(([k, label]) => (
                <span key={k} className="badge no">
                  {label} ×{s.cantos[k]}
                </span>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <>
              <div className="card-subtitle">{t("me.realRecent")}</div>
              <ul className="history-list">
                {recent.map((g) => (
                  <CompanionRow key={g.id} game={g} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
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

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}
