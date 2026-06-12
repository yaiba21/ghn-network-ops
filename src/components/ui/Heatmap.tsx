import { cn } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";
import type { HeatmapData, Status } from "@/lib/types";

type Props = {
  data: HeatmapData;
  valueFormat?: (v: number) => string;
  rowLabel?: string;
  colLabel?: string;
  className?: string;
  /** Optional click handler for drilldown. */
  onCellClick?: (cell: { row: string; col: string; value: number; status: Status }) => void;
};

const CELL_BG: Record<Status, string> = {
  green: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
  amber: "bg-amber-100 hover:bg-amber-200 text-amber-900",
  red: "bg-red-100 hover:bg-red-200 text-red-900",
};

export function Heatmap({
  data,
  valueFormat = (v) => v.toLocaleString("vi-VN"),
  rowLabel,
  colLabel,
  className,
  onCellClick,
}: Props) {
  const cellLookup = new Map<string, { value: number; status: Status }>();
  for (const c of data.cells) {
    cellLookup.set(`${c.row}|${c.col}`, { value: c.value, status: c.status });
  }

  // Use CSS grid for crisp alignment. First column = row labels, header row at top.
  const gridTemplate = `minmax(160px, 200px) repeat(${data.cols.length}, minmax(80px, 1fr))`;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div
        className="grid gap-1 min-w-fit"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {/* Header row */}
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
          {rowLabel} {colLabel && <span className="opacity-50">/ {colLabel}</span>}
        </div>
        {data.cols.map((col) => (
          <div
            key={col}
            className="px-2 py-1.5 text-[11px] font-medium text-[var(--color-text)] text-center"
          >
            {col}
          </div>
        ))}

        {/* Body rows */}
        {data.rows.map((row) => (
          <RowFragment
            key={row}
            row={row}
            cols={data.cols}
            cellLookup={cellLookup}
            valueFormat={valueFormat}
            onCellClick={onCellClick}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
        {(["green", "amber", "red"] as Status[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm", STATUS_TOKENS[s].dot)} />
            <span>
              {s === "green" ? "Đạt" : s === "amber" ? "Cảnh báo" : "Vượt ngưỡng"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RowFragment({
  row,
  cols,
  cellLookup,
  valueFormat,
  onCellClick,
}: {
  row: string;
  cols: string[];
  cellLookup: Map<string, { value: number; status: Status }>;
  valueFormat: (v: number) => string;
  onCellClick?: Props["onCellClick"];
}) {
  return (
    <>
      <div className="px-2 py-2 text-xs font-medium text-[var(--color-text)] truncate self-center">
        {row}
      </div>
      {cols.map((col) => {
        const cell = cellLookup.get(`${row}|${col}`);
        if (!cell) {
          return (
            <div
              key={col}
              className="px-2 py-2 text-xs text-[var(--color-text-muted)] text-center bg-[var(--color-hover)] rounded"
            >
              -
            </div>
          );
        }
        return (
          <button
            key={col}
            type="button"
            onClick={
              onCellClick
                ? () => onCellClick({ row, col, value: cell.value, status: cell.status })
                : undefined
            }
            className={cn(
              "px-2 py-2 text-xs tabular-nums text-center rounded transition-colors",
              CELL_BG[cell.status],
              onCellClick && "cursor-pointer",
            )}
            title={`${row} — ${col}: ${valueFormat(cell.value)}`}
          >
            {valueFormat(cell.value)}
          </button>
        );
      })}
    </>
  );
}
