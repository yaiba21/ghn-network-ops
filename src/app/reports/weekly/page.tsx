"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import { getWeeklyKpiReport } from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatCompactInt, formatPct, formatVND } from "@/lib/utils";

export default function WeeklyKpiPage() {
  const { filter } = useFilter();
  const rows = useMemo(() => getWeeklyKpiReport(filter), [filter]);
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Báo cáo" },
          { label: "Weekly KPI" },
        ]}
        title="Báo cáo Weekly KPI"
        subtitle="So sánh tuần này (7 ngày gần nhất) vs tuần trước. Δ = tuần này − tuần trước."
        updatedAt={updated}
      />

      <FilterBar
        show={{ region: true, province: true, channel: true, loaiHang: true }}
      />

      <Card
        title="Bảng KPI tuần này vs tuần trước"
        subtitle="Status theo ngưỡng đèn giao thông trên giá trị tuần này. Δ màu xanh = cải thiện theo hướng tốt."
      >
        <DataTable columns={columns} data={rows} rowKey={(r) => r.key} />
      </Card>
    </div>
  );
}

function fmt(v: number, unit: "%" | "VND" | "đơn"): string {
  if (unit === "%") return formatPct(v, 1);
  if (unit === "VND") return formatVND(v);
  return formatCompactInt(v);
}

const columns: Column<ReturnType<typeof getWeeklyKpiReport>[number]>[] = [
  { key: "label", label: "Chỉ số", render: (r) => <span className="font-medium">{r.label}</span> },
  { key: "lastWeek", label: "Tuần trước", align: "right", render: (r) => fmt(r.lastWeek, r.unit) },
  {
    key: "thisWeek",
    label: "Tuần này",
    align: "right",
    sortable: true,
    sortValue: (r) => r.thisWeek,
    render: (r) => <span className="font-semibold tabular-nums">{fmt(r.thisWeek, r.unit)}</span>,
  },
  {
    key: "delta",
    label: "Δ (tuần này − trước)",
    align: "right",
    sortable: true,
    sortValue: (r) => r.delta,
    render: (r) => {
      // improving = đi đúng hướng tốt
      const improving = r.higherBetter ? r.delta >= 0 : r.delta <= 0;
      const sign = r.delta > 0 ? "+" : "";
      return (
        <span className={cn("tabular-nums font-medium", Math.abs(r.delta) < 0.05 ? "text-[var(--color-text-muted)]" : improving ? "text-emerald-600" : "text-red-600")}>
          {sign}{fmt(r.delta, r.unit)}
        </span>
      );
    },
  },
  {
    key: "target",
    label: "Mục tiêu",
    align: "right",
    render: (r) => (r.target > 0 ? <span className="text-[var(--color-text-muted)] text-xs">{r.higherBetter ? "≥ " : "≤ "}{fmt(r.target, r.unit)}</span> : "—"),
  },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];
