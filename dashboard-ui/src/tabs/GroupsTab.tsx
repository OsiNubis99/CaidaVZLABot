import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import * as api from "../api";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { BannedBadge, YesNo } from "../components/Badge";
import { useToast } from "../components/Toast";
import { fmtDate } from "../lib/format";
import { useDebounced } from "../lib/useDebounce";
import type { GroupRow } from "../types";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 250;

type Action = "paid" | "rename" | "delete";

export function GroupsTab() {
  const toast = useToast();
  const qc = useQueryClient();

  // Server-side state (search/sort/page). Local React state.
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("name");
  const [qInput, setQInput] = useState("");
  const qDebounced = useDebounced(qInput, SEARCH_DEBOUNCE_MS);

  // Reset to page 1 whenever the debounced search changes.
  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const list = useQuery({
    queryKey: ["groups", { page, sort, q: qDebounced }],
    queryFn: () => api.listGroups({ page, pageSize: PAGE_SIZE, sort, q: qDebounced }),
  });

  // ─── Mutations ───────────────────────────────────────────────────────
  const invalidateGroups = () => qc.invalidateQueries({ queryKey: ["groups"] });

  const togglePublic = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.setGroupPublic(id, value),
    onSuccess: (g) => {
      toast(g.public ? "Ahora es público" : "Ya no es público");
      invalidateGroups();
    },
    onError: (err: Error) => toast("Error: " + err.message, "err"),
  });
  const toggleBanned = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.setGroupBanned(id, value),
    onSuccess: (g) => {
      toast(g.is_banned ? "Baneado" : "Desbaneado");
      invalidateGroups();
    },
    onError: (err: Error) => toast("Error: " + err.message, "err"),
  });
  const extendPaid = useMutation({
    mutationFn: ({ id, months }: { id: string; months: number }) =>
      api.extendGroupPaid(id, months),
    onSuccess: (_, vars) => {
      toast(`+${vars.months} mes(es)`);
      invalidateGroups();
    },
    onError: (err: Error) => toast("Error: " + err.message, "err"),
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.renameGroup(id, name),
    onSuccess: () => {
      toast("Renombrado");
      invalidateGroups();
    },
    onError: (err: Error) => toast("Error: " + err.message, "err"),
  });
  const del = useMutation({
    mutationFn: ({ id }: { id: string }) => api.deleteGroup(id),
    onSuccess: () => {
      toast("Grupo eliminado");
      invalidateGroups();
    },
    onError: (err: Error) => toast("Error: " + err.message, "err"),
  });

  const [modal, setModal] = useState<{ kind: Action; row: GroupRow } | null>(null);

  // ─── Columns ─────────────────────────────────────────────────────────
  const columns = useMemo<ColumnDef<GroupRow>[]>(
    () => [
      { accessorKey: "name", header: "Nombre" },
      {
        accessorKey: "id_group",
        header: "id_group",
        cell: (c) => <span className="cell-mono">{c.row.original.id_group}</span>,
      },
      {
        accessorKey: "public",
        header: "Público",
        accessorFn: (g) => !!g.public,
        cell: (c) => <YesNo value={c.row.original.public} />,
      },
      {
        accessorKey: "is_banned",
        header: "Baneado",
        accessorFn: (g) => !!g.is_banned,
        cell: (c) => <BannedBadge value={c.row.original.is_banned} />,
      },
      {
        accessorKey: "paid_up_to",
        header: "Pagado",
        cell: (c) => (
          <span className="cell-mono">{fmtDate(c.row.original.paid_up_to)}</span>
        ),
      },
      {
        accessorKey: "games_played",
        header: "Partidas",
        accessorFn: (g) => Number(g.games_played) || 0,
      },
      {
        id: "actions",
        header: "Acciones",
        enableSorting: false,
        cell: (c) => {
          const g = c.row.original;
          return (
            <div className="col-actions">
              <button
                className="btn"
                onClick={() => togglePublic.mutate({ id: g.id_group, value: !g.public })}
              >
                {g.public ? "Quitar público" : "Hacer público"}
              </button>
              <button
                className="btn"
                onClick={() => toggleBanned.mutate({ id: g.id_group, value: !g.is_banned })}
              >
                {g.is_banned ? "Desbanear" : "Banear"}
              </button>
              <button className="btn" onClick={() => setModal({ kind: "paid", row: g })}>
                + mes
              </button>
              <button className="btn" onClick={() => setModal({ kind: "rename", row: g })}>
                Renombrar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setModal({ kind: "delete", row: g })}
              >
                Eliminar
              </button>
            </div>
          );
        },
      },
    ],
    [togglePublic, toggleBanned],
  );

  return (
    <section className="tab-panel">
      <div className="toolbar">
        <input
          type="search"
          className="input"
          placeholder="Buscar por nombre o id_group…"
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
          <option value="active">Orden: más activos</option>
          <option value="public">Orden: públicos primero</option>
        </select>
        <span className="muted">
          {list.data ? `${list.data.total} grupo${list.data.total === 1 ? "" : "s"}` : ""}
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

      {modal?.kind === "paid" && (
        <PaidModal
          row={modal.row}
          onCancel={() => setModal(null)}
          onConfirm={(months) => {
            extendPaid.mutate({ id: modal.row.id_group, months });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "rename" && (
        <RenameModal
          row={modal.row}
          onCancel={() => setModal(null)}
          onConfirm={(name) => {
            rename.mutate({ id: modal.row.id_group, name });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "delete" && (
        <Modal
          title="¿Eliminar grupo?"
          confirmKind="danger"
          confirmLabel="Eliminar"
          onCancel={() => setModal(null)}
          onConfirm={() => {
            del.mutate({ id: modal.row.id_group });
            setModal(null);
          }}
        >
          <p>
            Se borra la fila <code>{modal.row.id_group}</code>. Las stats de
            usuarios no se tocan.
          </p>
        </Modal>
      )}
    </section>
  );
}

function PaidModal({
  row,
  onCancel,
  onConfirm,
}: {
  row: GroupRow;
  onCancel: () => void;
  onConfirm: (months: number) => void;
}) {
  const [months, setMonths] = useState(1);
  return (
    <Modal
      title={`Extender pago — ${row.id_group}`}
      onCancel={onCancel}
      onConfirm={() => {
        if (!Number.isInteger(months) || months <= 0 || months > 120) return;
        onConfirm(months);
      }}
    >
      <input
        type="number"
        className="input"
        value={months}
        min={1}
        max={120}
        onChange={(e) => setMonths(Number(e.target.value))}
      />
    </Modal>
  );
}

function RenameModal({
  row,
  onCancel,
  onConfirm,
}: {
  row: GroupRow;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(row.name);
  return (
    <Modal
      title={`Renombrar — ${row.id_group}`}
      confirmLabel="Guardar"
      onCancel={onCancel}
      onConfirm={() => {
        const trimmed = name.trim();
        if (trimmed) onConfirm(trimmed);
      }}
    >
      <input
        type="text"
        className="input"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </Modal>
  );
}

