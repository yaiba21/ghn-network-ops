import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusDot } from "@/components/ui/StatusDot";
import { STATUS_TOKENS, STATUS_LABEL_VI } from "@/lib/kpi-config";
import { cn, formatValue } from "@/lib/utils";
import type {
  PipelineHealthCell,
  PipelineHealthRow,
  Status,
} from "@/lib/types";

type Props = {
  rows: PipelineHealthRow[];
};

const CELL_BG: Record<Status, string> = {
  green: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  amber: "bg-amber-50 hover:bg-amber-100 border-amber-200",
  red: "bg-red-50 hover:bg-red-100 border-red-200",
};

/**
 * Signature view for the Overall page.
 * Rows = 2 modules (ORS / NDS+KTC).
 * Columns = top 5 provinces + "Tổng".
 * Each cell is a clickable tile that drills into the module page,
 * pre-filtered by the chosen province.
 */
export function PipelineHealthCard({ rows }: Props) {
  const provinces = rows[0]?.regionTotals ?? [];

  return (
    <Card
      title="Sức khoẻ pipeline middle-mile"
      subtitle="ORS và NDS + KTC theo 5 Tỉnh / Thành trọng điểm. Click ô để drill xuống chi tiết module."
      padding="md"
    >
      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="grid gap-2 min-w-fit"
          style={{
            gridTemplateColumns: `minmax(180px, 240px) repeat(${provinces.length}, minmax(130px, 1fr)) minmax(150px, 1fr)`,
          }}
        >
          {/* Header */}
          <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Module / Vùng
          </div>
          {provinces.map((p) => (
            <div
              key={p.provinceCode}
              className="px-2 py-1.5 text-[11px] font-medium text-[var(--color-text)] text-center truncate"
            >
              {p.region}
            </div>
          ))}
          <div className="px-2 py-1.5 text-[11px] font-medium text-[var(--color-text)] text-center bg-[var(--color-table-head)] rounded">
            Tổng
          </div>

          {/* Body rows */}
          {rows.map((row) => (
            <RowFragment key={row.module} row={row} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
        {(["green", "amber", "red"] as Status[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-sm", STATUS_TOKENS[s].dot)} />
            <span>{STATUS_LABEL_VI[s]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RowFragment({ row }: { row: PipelineHealthRow }) {
  return (
    <>
      <div className="px-3 py-3 flex flex-col justify-center bg-[var(--color-table-head)] rounded">
        <Link
          href={row.drillHref}
          className="text-sm font-semibold text-[var(--color-text)] hover:text-[var(--color-ghn-red)] inline-flex items-center gap-1.5"
        >
          {row.module}
          <ExternalLink className="w-3 h-3 opacity-60" />
        </Link>
        <span className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
          {row.metricLabel}
        </span>
      </div>

      {row.regionTotals.map((cell) => (
        <CellTile
          key={cell.provinceCode}
          cell={cell}
          href={`${row.drillHref}?p=${cell.provinceCode}`}
        />
      ))}

      <CellTile
        cell={{
          provinceCode: "__total",
          region: "Toàn quốc",
          status: row.totalStatus,
          value: row.totalValue,
          unit: row.totalUnit,
        }}
        href={row.drillHref}
        isTotal
      />
    </>
  );
}

function CellTile({
  cell,
  href,
  isTotal,
}: {
  cell: PipelineHealthCell;
  href: string;
  isTotal?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col justify-center items-center gap-1 px-2 py-3 border rounded transition-colors",
        CELL_BG[cell.status],
        isTotal && "ring-1 ring-[var(--color-border)]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <StatusDot status={cell.status} size={6} />
        <span className="text-base font-semibold tabular-nums text-[var(--color-text)]">
          {formatValue(cell.value, cell.unit)}
        </span>
      </div>
    </Link>
  );
}
