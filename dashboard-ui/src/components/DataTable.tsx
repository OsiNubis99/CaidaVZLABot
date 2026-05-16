import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  SortingState,
  Row,
} from "@tanstack/react-table";
import { useState } from "react";

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  emptyMessage?: string;
  // Server-side pagination — DataTable just renders, parent owns state.
  page?: number;
  totalPages?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  // Pluggable row-level renderers don't fit react-table by default;
  // this lets the parent expose actions etc.
  rowClassName?: (row: Row<T>) => string;
}

export function DataTable<T extends object>({
  data,
  columns,
  emptyMessage = "Sin resultados",
  page,
  totalPages,
  total,
  onPageChange,
  rowClassName,
}: Props<T>) {
  // Client-side sort over the current page. Combined with server-side
  // pagination, this is the typical pattern: search/filter scopes the
  // dataset; sort tweaks the order in the visible slice. If we ever
  // need cross-page sort we'll wire it back to the server.
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const canSort = h.column.getCanSort();
                  const sort = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={
                        canSort
                          ? h.column.getToggleSortingHandler()
                          : undefined
                      }
                      style={{
                        cursor: canSort ? "pointer" : "default",
                        userSelect: "none",
                      }}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sort === "asc" ? " ▲" : sort === "desc" ? " ▼" : canSort ? "  " : ""}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="muted"
                  style={{ textAlign: "center", padding: 32 }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={rowClassName ? rowClassName(row) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages !== undefined && totalPages > 1 && onPageChange && page !== undefined && (
        <div className="pager">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ◀
          </button>
          <span>{`${page} / ${totalPages}${total !== undefined ? ` · ${total} en total` : ""}`}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            ▶
          </button>
        </div>
      )}
    </>
  );
}
