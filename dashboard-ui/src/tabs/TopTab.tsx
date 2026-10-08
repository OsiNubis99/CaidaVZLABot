import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as api from "../api";
import { DataTable } from "../components/DataTable";
import { CpuBadge } from "../components/Badge";
import { useToast } from "../components/Toast";
import { t } from "../lib/i18n";
import {
  caidaRatio,
  displayName,
  fmtPct,
  fmtRate,
  isCpu,
  winRate,
} from "../lib/format";
import type { CompanionLeaderRow, UserRow } from "../types";

// Top-N + a rank index, so we can sort by ANY column but the default
// "#" stays a stable original ranking from the leaderboard endpoint.
interface Ranked extends UserRow {
  rank: number;
}

export function TopTab() {
  const [limit, setLimit] = useState(25);
  // "app" = games played in the bot/WebApp; "real" = Acompañante (Mesa real).
  // Two separate rankings — never mixed.
  const [view, setView] = useState<"app" | "real">("app");
  const toast = useToast();
  const q = useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: () => api.leaderboard(limit),
    enabled: view === "app",
  });

  if (q.isError) {
    const err = q.error as Error;
    toast("Error: " + err.message, "err");
  }

  const ranked = useMemo<Ranked[]>(
    () => (q.data?.rows ?? []).map((u, i) => ({ ...u, rank: i + 1 })),
    [q.data],
  );

  const columns = useMemo<ColumnDef<Ranked>[]>(
    () => [
      {
        accessorKey: "rank",
        header: t("top.rank"),
        cell: (c) => <span className="cell-mono">{c.row.original.rank}</span>,
      },
      {
        id: "name",
        header: t("top.player"),
        accessorFn: (u) => displayName(u),
        cell: (c) => (
          <>
            {displayName(c.row.original)}
            {isCpu(c.row.original) && <CpuBadge />}
            {c.row.original.username && (
              <small className="muted"> @{c.row.original.username}</small>
            )}
          </>
        ),
      },
      {
        accessorKey: "finished",
        header: t("top.games"),
        accessorFn: (u) => Number(u.finished) || 0,
      },
      {
        accessorKey: "win",
        header: t("top.won"),
        accessorFn: (u) => Number(u.win) || 0,
      },
      {
        accessorKey: "beat_pro",
        header: t("top.pro"),
        accessorFn: (u) => Number(u.beat_pro) || 0,
      },
      {
        id: "win_rate",
        header: t("top.winRate"),
        accessorFn: (u) => winRate(u) ?? -1,
        cell: (c) => fmtPct(winRate(c.row.original)),
      },
      {
        accessorKey: "caida",
        header: t("top.caidasGiven"),
        accessorFn: (u) => Number(u.caida) || 0,
      },
      {
        accessorKey: "caido",
        header: t("top.caidasReceived"),
        accessorFn: (u) => Number(u.caido) || 0,
      },
      {
        id: "caida_ratio",
        header: t("top.caidaRatio"),
        accessorFn: (u) => {
          const r = caidaRatio(u);
          if (r === null) return -1;
          if (!Number.isFinite(r)) return Number.MAX_SAFE_INTEGER;
          return r;
        },
        cell: (c) => fmtRate(caidaRatio(c.row.original)),
      },
    ],
    [],
  );

  return (
    <section className="tab-panel">
      <div className="toolbar">
        <div className="cfg-seg top-switch">
          <button
            type="button"
            className={`cfg-seg-btn ${view === "app" ? "is-on" : ""}`}
            onClick={() => setView("app")}
          >
            {t("top.viewApp")}
          </button>
          <button
            type="button"
            className={`cfg-seg-btn ${view === "real" ? "is-on" : ""}`}
            onClick={() => setView("real")}
          >
            {t("top.viewReal")}
          </button>
        </div>
        <select
          className="input"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={10}>{t("top.top10")}</option>
          <option value={25}>{t("top.top25")}</option>
          <option value={50}>{t("top.top50")}</option>
          <option value={100}>{t("top.top100")}</option>
        </select>
        {view === "app" && q.isFetching && <span className="muted">{t("top.loading")}</span>}
      </div>
      {view === "app" ? (
        <DataTable
          data={ranked}
          columns={columns}
          emptyMessage={t("top.empty")}
        />
      ) : (
        <CompanionTop limit={limit} />
      )}
    </section>
  );
}

interface RealRanked extends CompanionLeaderRow {
  rank: number;
}

/** Acompañante leaderboard: games scored at real tables. */
function CompanionTop({ limit }: { limit: number }) {
  const q = useQuery({
    queryKey: ["companionLeaderboard", limit],
    queryFn: () => api.companionLeaderboard(limit),
  });
  const rows = useMemo<RealRanked[]>(
    () => (q.data?.rows ?? []).map((r, i) => ({ ...r, rank: i + 1 })),
    [q.data],
  );
  const columns = useMemo<ColumnDef<RealRanked>[]>(
    () => [
      {
        accessorKey: "rank",
        header: t("top.rank"),
        cell: (c) => <span className="cell-mono">{c.row.original.rank}</span>,
      },
      { accessorKey: "name", header: t("top.player") },
      { accessorKey: "played", header: t("top.games") },
      { accessorKey: "won", header: t("top.realWon") },
      {
        id: "win_rate",
        header: t("top.winRate"),
        accessorFn: (r) => (r.played ? Math.round((r.won / r.played) * 100) : -1),
        cell: (c) =>
          fmtPct(c.row.original.played ? Math.round((c.row.original.won / c.row.original.played) * 100) : null),
      },
      { accessorKey: "caidas", header: t("top.realCaidas") },
      { accessorKey: "mesas", header: t("top.realMesas") },
      { accessorKey: "points", header: t("top.realPoints") },
    ],
    [],
  );
  return (
    <>
      <p className="muted top-note">{t("top.realNote")}</p>
      {q.isError ? (
        <p className="muted">{t("me.recentError")}</p>
      ) : (
        <DataTable data={rows} columns={columns} emptyMessage={t("top.realEmpty")} />
      )}
    </>
  );
}
