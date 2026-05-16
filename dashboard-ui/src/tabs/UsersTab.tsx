import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as api from "../api";
import { DataTable } from "../components/DataTable";
import { BannedBadge, CpuBadge } from "../components/Badge";
import { useToast } from "../components/Toast";
import {
  caidaRatio,
  displayName,
  fmtPct,
  fmtRate,
  isCpu,
  winRate,
} from "../lib/format";
import { useDebounced } from "../lib/useDebounce";
import type { UserRow } from "../types";

const PAGE_SIZE = 25;

export function UsersTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [qInput, setQInput] = useState("");
  const qDebounced = useDebounced(qInput, 250);

  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const list = useQuery({
    queryKey: ["users", { page, sort, q: qDebounced }],
    queryFn: () => api.listUsers({ page, pageSize: PAGE_SIZE, sort, q: qDebounced }),
  });

  const toggleBanned = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.setUserBanned(id, value),
    onSuccess: (u) => {
      toast(u.is_banned ? "Baneado" : "Desbaneado");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err: Error) => toast("Error: " + err.message, "err"),
  });

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        id: "name",
        header: "Nombre",
        accessorFn: (u) => displayName(u),
        cell: (c) => (
          <>
            {displayName(c.row.original)}
            {isCpu(c.row.original) && <CpuBadge />}
          </>
        ),
      },
      {
        accessorKey: "username",
        header: "@user",
        cell: (c) =>
          c.row.original.username ? "@" + c.row.original.username : "—",
      },
      {
        accessorKey: "id_user",
        header: "id",
        cell: (c) => <span className="cell-mono">{c.row.original.id_user}</span>,
      },
      {
        accessorKey: "finished",
        header: "Partidas",
        accessorFn: (u) => Number(u.finished) || 0,
      },
      {
        accessorKey: "win",
        header: "Wins",
        accessorFn: (u) => Number(u.win) || 0,
      },
      {
        id: "win_rate",
        header: "Win rate",
        accessorFn: (u) => winRate(u) ?? -1,
        cell: (c) => fmtPct(winRate(c.row.original)),
      },
      {
        id: "caidas",
        header: "Caídas",
        accessorFn: (u) => (Number(u.caida) || 0) - (Number(u.caido) || 0),
        cell: (c) => (
          <span className="cell-mono">
            {Number(c.row.original.caida) || 0}↑/{Number(c.row.original.caido) || 0}↓
          </span>
        ),
      },
      {
        id: "caida_ratio",
        header: "Ratio",
        accessorFn: (u) => {
          const r = caidaRatio(u);
          if (r === null) return -1;
          if (!Number.isFinite(r)) return Number.MAX_SAFE_INTEGER;
          return r;
        },
        cell: (c) => fmtRate(caidaRatio(c.row.original)),
      },
      {
        id: "banned",
        header: "Baneado",
        accessorFn: (u) => !!u.is_banned,
        cell: (c) =>
          isCpu(c.row.original) ? (
            <span className="muted">—</span>
          ) : (
            <BannedBadge value={c.row.original.is_banned} />
          ),
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        cell: (c) => {
          if (isCpu(c.row.original)) {
            return (
              <span className="muted" style={{ fontSize: 11 }}>
                no aplica
              </span>
            );
          }
          const u = c.row.original;
          return (
            <button
              className="btn"
              onClick={() =>
                toggleBanned.mutate({ id: u.id_user, value: !u.is_banned })
              }
            >
              {u.is_banned ? "Desbanear" : "Banear"}
            </button>
          );
        },
      },
    ],
    [toggleBanned],
  );

  return (
    <section className="tab-panel">
      <div className="toolbar">
        <input
          type="search"
          className="input"
          placeholder="Buscar por nombre, username o id_user…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          autoComplete="off"
        />
        <select
          className="input"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="name">Orden: nombre</option>
          <option value="wins">Orden: más wins</option>
          <option value="banned">Orden: baneados primero</option>
        </select>
        <span className="muted">
          {list.data
            ? `${list.data.total} usuario${list.data.total === 1 ? "" : "s"}`
            : ""}
        </span>
      </div>
      <DataTable
        data={list.data?.rows ?? []}
        columns={columns}
        page={list.data?.page}
        totalPages={list.data?.totalPages}
        total={list.data?.total}
        onPageChange={setPage}
      />
    </section>
  );
}
