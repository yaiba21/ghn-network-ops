"use client";

import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { cn, formatDelta, formatPct } from "@/lib/utils";
import type { OpsScorecardRow } from "@/lib/types";

type Props = {
  rows: OpsScorecardRow[];
};

/**
 * GHN-native weekly scorecard. Reads like the ops team's Excel:
 * W20 (tuần đã hoàn thành) vs WTD (tuần hiện tại tới hôm nay), Δ tính bằng pp.
 */
export function OpsScorecardCard({ rows }: Props) {
  const columns: Column<OpsScorecardRow>[] = [
    {
      key: "label",
      label: "Chỉ số",
      width: "38%",
      render: (r) => (
        <div>
          <div className="text-[var(--color-text)]">{r.label}</div>
          {r.note && (
            <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {r.note}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "w20Value",
      label: "W20",
      align: "right",
      sortable: true,
      sortValue: (r) => r.w20Value,
      render: (r) => (
        <span className="text-[var(--color-text-muted)] tabular-nums">
          {formatPct(r.w20Value, 2)}
        </span>
      ),
    },
    {
      key: "wtdValue",
      label: "WTD",
      align: "right",
      sortable: true,
      sortValue: (r) => r.wtdValue,
      render: (r) => (
        <span className="font-semibold text-[var(--color-text)] tabular-nums">
          {formatPct(r.wtdValue, 2)}
        </span>
      ),
    },
    {
      key: "deltaPp",
      label: "Δ vs W20",
      align: "right",
      sortable: true,
      sortValue: (r) => r.deltaPp,
      render: (r) => {
        // Direction-aware coloring: change is "good" if it moves toward target.
        const improving =
          r.direction === "higher-better" ? r.deltaPp >= 0 : r.deltaPp <= 0;
        const neutral = Math.abs(r.deltaPp) < 0.05;
        return (
          <span
            className={cn(
              "tabular-nums font-medium",
              neutral
                ? "text-[var(--color-text-muted)]"
                : improving
                  ? "text-emerald-600"
                  : "text-red-600",
            )}
          >
            {formatDelta(r.deltaPp, 2)}
          </span>
        );
      },
    },
    {
      key: "target",
      label: "Mục tiêu",
      align: "right",
      render: (r) => (
        <span className="text-[var(--color-text-muted)] tabular-nums text-xs">
          {r.direction === "lower-better" ? "≤ " : "≥ "}
          {formatPct(r.target, 0)}
        </span>
      ),
    },
  ];

  return (
    <Card
      title="Bảng điểm vận hành tuần"
      subtitle="W20 (tuần đã hoàn thành) ↔ WTD (tuần hiện tại tới hôm nay). Δ = WTD − W20."
    >
      <DataTable<OpsScorecardRow>
        columns={columns}
        data={rows}
        rowKey={(r) => r.key}
      />
    </Card>
  );
}
