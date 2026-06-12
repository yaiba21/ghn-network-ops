"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  label: string;
  accessor?: (row: T) => unknown;
  align?: "left" | "right" | "center";
  width?: number | string;
  format?: (value: unknown, row: T) => string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  /** When provided, used for sorting instead of accessor / key. */
  sortValue?: (row: T) => number | string;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Predicate for filtering rows when search term changes. */
  filterRow?: (row: T, q: string) => boolean;
  pageSize?: number;
  emptyText?: string;
  className?: string;
  onRowClick?: (row: T) => void;
};

function getValue<T>(col: Column<T>, row: T): unknown {
  if (col.accessor) return col.accessor(row);
  return (row as Record<string, unknown>)[col.key];
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  searchable = false,
  searchPlaceholder = "Tìm trong bảng...",
  filterRow,
  pageSize,
  emptyText = "Không có dữ liệu",
  className,
  onRowClick,
}: Props<T>) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q) return data;
    const lower = q.toLowerCase();
    if (filterRow) return data.filter((r) => filterRow(r, lower));
    // Default: stringify all column values and substring match.
    return data.filter((r) =>
      columns.some((c) => {
        const v = getValue(c, r);
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(lower);
      }),
    );
  }, [data, q, filterRow, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : (getValue(col, a) as number | string);
      const bv = col.sortValue ? col.sortValue(b) : (getValue(col, b) as number | string);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av).localeCompare(String(bv), "vi") * sign;
    });
  }, [filtered, sort, columns]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const pageRows = pageSize ? sorted.slice(page * pageSize, page * pageSize + pageSize) : sorted;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {searchable && (
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="w-full h-8 pl-8 pr-3 text-sm border border-[var(--color-border)] rounded-md outline-none focus:border-[var(--color-ghn-red)]"
          />
        </div>
      )}

      <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-table-head)] border-b border-[var(--color-border)]">
              <tr>
                {columns.map((col) => {
                  const sorting = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className={cn(
                        "px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]",
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left",
                      )}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSort((s) =>
                              s?.key === col.key
                                ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" }
                                : { key: col.key, dir: "asc" },
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-[var(--color-text)]",
                            col.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {col.label}
                          {sorting ? (
                            sort?.dir === "asc" ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]"
                  >
                    {emptyText}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-[var(--color-border-soft)] last:border-b-0 hover:bg-[var(--color-table-head)]",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {columns.map((col) => {
                      const v = getValue(col, row);
                      const display = col.render
                        ? col.render(row)
                        : col.format
                          ? col.format(v, row)
                          : v === null || v === undefined || v === ""
                            ? "-"
                            : String(v);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3 text-[var(--color-text)] tabular-nums",
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                                ? "text-center"
                                : "text-left",
                            col.className,
                          )}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageSize && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            <div>
              {sorted.length === 0
                ? "0"
                : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, sorted.length)}`}{" "}
              / {sorted.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-7 px-2 rounded border border-[var(--color-border)] disabled:opacity-40"
              >
                Trước
              </button>
              <span className="px-2">
                Trang {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="h-7 px-2 rounded border border-[var(--color-border)] disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
