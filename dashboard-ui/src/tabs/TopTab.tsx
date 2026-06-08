import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as api from "../api";
import { DataTable } from "../components/DataTable";
import { CpuBadge } from "../components/Badge";
import { useToast } from "../components/Toast";
import {
  caidaRatio,
  displayName,
  fmtPct,
  fmtRate,
  isCpu,
  winRate,
} from "../lib/format";
import type { UserRow } from "../types";

// Top-N + a rank index, so we can sort by ANY column but the default
// "#" stays a stable original ranking from the leaderboard endpoint.
interface Ranked extends UserRow {
  rank: number;
}

export function TopTab() {
  const [limit, setLimit] = useState(25);
  const toast = useToast();
  const q = useQuery({
    queryKey: ["leaderboard", limit],
    queryFn: () => api.leaderboard(limit),
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
        header: "#",
        cell: (c) => <span className="cell-mono">{c.row.original.rank}</span>,
      },
      {
        id: "name",
        header: "Jugador",
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
        header: "Partidas",
        accessorFn: (u) => Number(u.finished) || 0,
      },
      {
        accessorKey: "win",
        header: "Ganados",
        accessorFn: (u) => Number(u.win) || 0,
      },
      {
        accessorKey: "beat_pro",
        header: "🏆 PRO",
        accessorFn: (u) => Number(u.beat_pro) || 0,
      },
      {
        id: "win_rate",
        header: "Win rate",
        accessorFn: (u) => winRate(u) ?? -1,
        cell: (c) => fmtPct(winRate(c.row.original)),
      },
      {
        accessorKey: "caida",
        header: "Caídas dadas",
        accessorFn: (u) => Number(u.caida) || 0,
      },
      {
        accessorKey: "caido",
        header: "Caídas recibidas",
        accessorFn: (u) => Number(u.caido) || 0,
      },
      {
        id: "caida_ratio",
        header: "Caída ratio",
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
        <select
          className="input"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={10}>Top 10</option>
          <option value={25}>Top 25</option>
          <option value={50}>Top 50</option>
          <option value={100}>Top 100</option>
        </select>
        {q.isFetching && <span className="muted">cargando…</span>}
      </div>
      <DataTable
        data={ranked}
        columns={columns}
        emptyMessage="Aún no hay datos"
      />
    </section>
  );
}
