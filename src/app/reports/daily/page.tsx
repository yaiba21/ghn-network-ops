"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getDailyTrend,
  getOverviewNorthStar,
  getRegionScorecard,
  getStageOverview,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { MetricChart } from "@/components/ui/MetricChart";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  cn,
  formatCompactInt,
  formatHours,
  formatPct,
  formatVND,
  shortDate,
} from "@/lib/utils";

export default function DailyOpsPage() {
  const { filter } = useFilter();
  const northStar = useMemo(() => getOverviewNorthStar(filter), [filter]);
  const trend = useMemo(() => getDailyTrend(filter, 7), [filter]);
  const regions = useMemo(() => getRegionScorecard(filter), [filter]);
  const stages = useMemo(() => getStageOverview(filter), [filter]);
  const updated = dataUpdatedAt();

  const today = trend[trend.length - 1];
  const yest = trend[trend.length - 2];
  const deltaOrders = today && yest ? today.orders - yest.orders : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Báo cáo" },
          { label: "Daily ops" },
        ]}
        title="Báo cáo Daily Ops"
        subtitle="Snapshot vận hành trong ngày — sản lượng, north star, 5 chặng, scorecard vùng."
        updatedAt={updated}
      />

      <FilterBar
        show={{ region: true, province: true, channel: true, loaiHang: true }}
      />

      {/* Tóm tắt ngày */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="border border-[var(--color-border)] rounded-md bg-white p-4">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Sản lượng hôm nay
          </div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {formatCompactInt(today?.orders ?? 0)}
          </div>
          <div className={cn("text-xs mt-1 tabular-nums", deltaOrders >= 0 ? "text-emerald-600" : "text-red-600")}>
            {deltaOrders >= 0 ? "+" : ""}
            {formatCompactInt(deltaOrders)} vs hôm qua
          </div>
        </div>
        <KpiCardFrom kpi={northStar.ontimeNetwork} size="sm" />
        <KpiCardFrom kpi={northStar.fdRate} size="sm" />
        <KpiCardFrom kpi={northStar.doiKhoOverall} size="sm" />
      </section>

      {/* Trend 7 ngày */}
      <Card title="Sản lượng + Ontime 7 ngày gần nhất" subtitle="Cột = sản lượng, line = ontime network %.">
        <MetricChart
          type="combo"
          data={trend}
          xKey="date"
          height={240}
          series={[
            { key: "orders", label: "Sản lượng", type: "bar", color: "#F97316", yAxisId: "left" },
            { key: "ontime", label: "Ontime %", type: "line", color: "#10b981", yAxisId: "right" },
          ]}
          xTickFormatter={(d) => shortDate(String(d))}
          yTickFormatter={(v) => formatCompactInt(v)}
          rightYTickFormatter={(v) => `${v.toFixed(0)}%`}
          legend
        />
      </Card>

      {/* 5 chặng hôm nay */}
      <Card title="5 chặng vận hành hôm nay" subtitle="Lượng đơn + % thành công mỗi chặng.">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {stages.map((s) => (
            <div key={s.stageKey} className="border border-[var(--color-border)] rounded-md p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium truncate">{s.stageLabel}</span>
                <StatusDot status={s.status} />
              </div>
              <div className="text-xl font-semibold tabular-nums">{formatCompactInt(s.throughput)}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">đơn · {formatPct(s.successRate, 0)} GTC</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Scorecard vùng */}
      <Card title="Scorecard 14 vùng hôm nay" subtitle="Sort cột để tìm vùng cần chú ý.">
        <DataTable columns={regionColumns} data={regions} rowKey={(r) => r.regionCode} pageSize={14} />
      </Card>
    </div>
  );
}

const regionColumns: Column<ReturnType<typeof getRegionScorecard>[number]>[] = [
  { key: "regionName", label: "Vùng", render: (r) => <span className="font-medium">{r.regionName}</span> },
  { key: "totalOrders", label: "Lượng đơn", align: "right", sortable: true, sortValue: (r) => r.totalOrders, render: (r) => formatCompactInt(r.totalOrders) },
  {
    key: "ontimeNetwork", label: "Ontime", align: "right", sortable: true, sortValue: (r) => r.ontimeNetwork,
    render: (r) => <span className={r.ontimeNetwork >= 90 ? "text-emerald-600" : r.ontimeNetwork >= 88 ? "text-amber-600" : "text-red-600"}>{formatPct(r.ontimeNetwork, 1)}</span>,
  },
  {
    key: "costPerKg", label: "Cost/kg", align: "right", sortable: true, sortValue: (r) => r.costPerKg,
    render: (r) => <span className={r.costPerKg <= 1970 ? "text-emerald-600" : r.costPerKg <= 2057 ? "text-amber-600" : "text-red-600"}>{formatVND(r.costPerKg)}</span>,
  },
  {
    key: "pctTC", label: "%GTC", align: "right", sortable: true, sortValue: (r) => r.pctTC,
    render: (r) => <span className={r.pctTC >= 92 ? "text-emerald-600" : r.pctTC >= 88 ? "text-amber-600" : "text-red-600"}>{formatPct(r.pctTC, 1)}</span>,
  },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];
