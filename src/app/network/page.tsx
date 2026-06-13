"use client";

import { useMemo, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  bcStateLabel,
  getBcDrillByRegion,
  getKtcScorecard,
  getNetworkSubMetrics,
  getOverviewNorthStar,
  getRegionBcStates,
  getRegionScorecard,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Sparkline } from "@/components/ui/Sparkline";
import { REGION_LABEL_VI, type RegionCode } from "@/lib/types";
import {
  cn,
  formatCompactInt,
  formatHours,
  formatInt,
  formatPct,
  formatVND,
} from "@/lib/utils";

export default function NetworkPage() {
  const { filter } = useFilter();

  const northStar = useMemo(() => getOverviewNorthStar(filter), [filter]);
  const regionScorecard = useMemo(() => getRegionScorecard(filter), [filter]);
  const bcStates = useMemo(() => getRegionBcStates(filter), [filter]);
  const ktcScorecard = useMemo(() => getKtcScorecard(filter), [filter]);
  const subMetrics = useMemo(() => getNetworkSubMetrics(filter), [filter]);
  const updated = dataUpdatedAt();

  // Drill-down state: vùng đang chọn để show BC bên dưới
  const [drillRegion, setDrillRegion] = useState<RegionCode | null>(null);
  const bcDrill = useMemo(
    () => (drillRegion ? getBcDrillByRegion(filter, drillRegion, 50) : []),
    [filter, drillRegion],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Mạng Lưới" },
        ]}
        title="Mạng Lưới — KTC + Linehaul"
        subtitle="Sức khoẻ middle-mile: lượng đơn KTC, SLA Network, cost/kg, fill rate xe. Bấm vùng để drill xuống BC."
        updatedAt={updated}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          ktc: true,
          carrier: true,
          loaiTuyen: true,
        }}
      />

      {/* === KPI mạng (bỏ đổi kho) === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={northStar.ontimeNetwork} size="sm" />
        <KpiCardFrom kpi={northStar.hangVeBc4Ca} size="sm" />
        <KpiCardFrom kpi={northStar.costPerKg} size="sm" />
        <KpiCardFrom kpi={northStar.ontimeVanTai} size="sm" />
      </section>

      {/* === Đếm BC theo trạng thái per vùng === */}
      <Card
        title="Phân bổ trạng thái BC theo vùng"
        subtitle="Số BC ổn định / quá tải / vượt SLA / vượt cost target. Bấm vùng để xem chi tiết từng BC."
      >
        <DataTable
          columns={bcStateColumns}
          data={bcStates}
          rowKey={(r) => r.regionCode}
          onRowClick={(r) => setDrillRegion(r.regionCode)}
        />
      </Card>

      {/* === Scorecard 14 vùng (clickable) === */}
      <Card
        title="Scorecard 14 vùng"
        subtitle="So sánh: lượng đơn · ontime network · cost/kg · %TC · % hàng ≥4 ca. Bấm vùng để drill xuống BC."
      >
        <DataTable
          columns={regionColumns}
          data={regionScorecard}
          rowKey={(r) => r.regionCode}
          onRowClick={(r) => setDrillRegion(r.regionCode)}
        />
      </Card>

      {/* === Drill-down BC trong vùng === */}
      {drillRegion && (
        <Card
          title={`Drill xuống BC — Vùng ${REGION_LABEL_VI[drillRegion]}`}
          subtitle={`${bcDrill.length} BC trong vùng, sort theo lượng đơn. Trạng thái: ổn định / quá tải / vượt SLA / vượt cost.`}
          actions={
            <button
              type="button"
              onClick={() => setDrillRegion(null)}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X className="w-3.5 h-3.5" /> Đóng
            </button>
          }
        >
          <DataTable
            columns={bcDrillColumns}
            data={bcDrill}
            rowKey={(r) => r.bcCode}
            searchable
            searchPlaceholder="Tìm BC..."
            pageSize={15}
          />
        </Card>
      )}

      {/* === KTC scorecard === */}
      <Card
        title={`KTC scorecard — ${ktcScorecard.length} KTC active`}
        subtitle="Top KTC theo lượng đơn. Click cột để sort, tìm KTC bottleneck."
      >
        <DataTable
          columns={ktcColumns}
          data={ktcScorecard}
          rowKey={(r) => r.ktcCode}
          searchable
          searchPlaceholder="Tìm KTC..."
          pageSize={15}
        />
      </Card>

      {/* === Network sub-metrics có công thức + visualize === */}
      <Card
        title="Network sub-metrics"
        subtitle="Các chỉ số NDS+KTC chi tiết — công thức ước lượng + xu hướng 7 ngày (mock data)."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {subMetrics.map((m) => (
            <SubMetricCard key={m.key} metric={m} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function SubMetricCard({
  metric: m,
}: {
  metric: ReturnType<typeof getNetworkSubMetrics>[number];
}) {
  const colorCls =
    m.status === "green"
      ? "text-emerald-600"
      : m.status === "amber"
        ? "text-amber-600"
        : "text-red-600";
  return (
    <div className="border border-[var(--color-border)] rounded-md p-3 bg-white">
      <div className="text-[11px] text-[var(--color-text)] font-medium leading-tight min-h-[28px]">
        {m.label}
      </div>
      <div className="mt-1 flex items-baseline justify-between">
        <span className={cn("text-2xl font-semibold tabular-nums", colorCls)}>
          {m.unit === "%" ? formatPct(m.value, 1) : `${m.value}`}
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {m.unit !== "%" ? m.unit : ""}
        </span>
      </div>
      <div className="mt-1">
        <Sparkline data={m.trend} status={m.status} width={140} height={24} />
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--color-border-soft)]">
        <div className="text-[9px] uppercase tracking-wide text-[var(--color-text-muted)]">
          Công thức
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] font-mono leading-tight">
          {m.formula}
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums">
          Mục tiêu {m.unit === "%" ? `${m.target}%` : `${m.target}${m.unit}`}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Columns — bảng đổi cả xanh cả đỏ (color-coded full range)
// =============================================================================

function pctColor(value: number, green: number, amber: number, higherBetter = true): string {
  if (higherBetter) {
    return value >= green ? "text-emerald-600" : value >= amber ? "text-amber-600" : "text-red-600";
  }
  return value <= green ? "text-emerald-600" : value <= amber ? "text-amber-600" : "text-red-600";
}

const bcStateColumns: Column<ReturnType<typeof getRegionBcStates>[number]>[] = [
  {
    key: "regionName",
    label: "Vùng",
    render: (r) => (
      <span className="inline-flex items-center gap-1 font-medium">
        {r.regionName}
        <ChevronRight className="w-3 h-3 text-[var(--color-text-faint)]" />
      </span>
    ),
  },
  { key: "totalBc", label: "Tổng BC", align: "right", sortable: true, sortValue: (r) => r.totalBc, render: (r) => formatInt(r.totalBc) },
  {
    key: "stable", label: "Ổn định", align: "right", sortable: true, sortValue: (r) => r.stable,
    render: (r) => <span className="text-emerald-600 font-medium">{formatInt(r.stable)}</span>,
  },
  {
    key: "overload", label: "Quá tải", align: "right", sortable: true, sortValue: (r) => r.overload,
    render: (r) => <span className={r.overload === 0 ? "text-[var(--color-text-muted)]" : "text-amber-600 font-medium"}>{formatInt(r.overload)}</span>,
  },
  {
    key: "slaBreach", label: "Vượt SLA", align: "right", sortable: true, sortValue: (r) => r.slaBreach,
    render: (r) => <span className={r.slaBreach === 0 ? "text-[var(--color-text-muted)]" : "text-amber-600 font-medium"}>{formatInt(r.slaBreach)}</span>,
  },
  {
    key: "costBreach", label: "Vượt cost", align: "right", sortable: true, sortValue: (r) => r.costBreach,
    render: (r) => <span className={r.costBreach === 0 ? "text-[var(--color-text-muted)]" : "text-red-600 font-medium"}>{formatInt(r.costBreach)}</span>,
  },
];

const regionColumns: Column<ReturnType<typeof getRegionScorecard>[number]>[] = [
  {
    key: "regionName",
    label: "Vùng",
    render: (r) => (
      <span className="inline-flex items-center gap-1 font-medium">
        {r.regionName}
        <ChevronRight className="w-3 h-3 text-[var(--color-text-faint)]" />
      </span>
    ),
  },
  { key: "totalOrders", label: "Lượng đơn", align: "right", sortable: true, sortValue: (r) => r.totalOrders, render: (r) => formatCompactInt(r.totalOrders) },
  {
    key: "ontimeNetwork", label: "Ontime Network", align: "right", sortable: true, sortValue: (r) => r.ontimeNetwork,
    render: (r) => <span className={pctColor(r.ontimeNetwork, 90, 88)}>{formatPct(r.ontimeNetwork, 1)}</span>,
  },
  {
    key: "costPerKg", label: "Cost/kg", align: "right", sortable: true, sortValue: (r) => r.costPerKg,
    render: (r) => <span className={pctColor(r.costPerKg, 1970, 2057, false)}>{formatVND(r.costPerKg)}</span>,
  },
  {
    key: "pctTC", label: "% Giao TC", align: "right", sortable: true, sortValue: (r) => r.pctTC,
    render: (r) => <span className={pctColor(r.pctTC, 92, 88)}>{formatPct(r.pctTC, 1)}</span>,
  },
  {
    key: "hangVeBc4Ca", label: "% ≥4 ca", align: "right", sortable: true, sortValue: (r) => r.hangVeBc4Ca,
    render: (r) => <span className={pctColor(r.hangVeBc4Ca, 90, 85)}>{formatPct(r.hangVeBc4Ca, 1)}</span>,
  },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];

const STATE_BADGE: Record<string, string> = {
  stable: "bg-emerald-100 text-emerald-800 border-emerald-200",
  overload: "bg-amber-100 text-amber-800 border-amber-200",
  slaBreach: "bg-orange-100 text-orange-800 border-orange-200",
  costBreach: "bg-red-100 text-red-800 border-red-200",
};

const bcDrillColumns: Column<ReturnType<typeof getBcDrillByRegion>[number]>[] = [
  { key: "bcName", label: "Bưu cục", render: (r) => <span className="font-medium truncate">{r.bcName}</span> },
  { key: "province", label: "Tỉnh", sortable: true },
  { key: "ordersHandled", label: "Lượng đơn", align: "right", sortable: true, sortValue: (r) => r.ordersHandled, render: (r) => formatCompactInt(r.ordersHandled) },
  { key: "pendingSort", label: "Chờ sort", align: "right", sortable: true, sortValue: (r) => r.pendingSort, render: (r) => formatCompactInt(r.pendingSort) },
  {
    key: "tatHours", label: "TAT", align: "right", sortable: true, sortValue: (r) => r.tatHours,
    render: (r) => <span className={pctColor(r.tatHours, 4, 8, false)}>{formatHours(r.tatHours)}</span>,
  },
  {
    key: "costPerKg", label: "Cost/kg", align: "right", sortable: true, sortValue: (r) => r.costPerKg,
    render: (r) => <span className={pctColor(r.costPerKg, 1970, 2300, false)}>{formatVND(r.costPerKg)}</span>,
  },
  {
    key: "state", label: "Trạng thái", align: "right", sortable: true,
    render: (r) => (
      <span className={cn("inline-block px-2 py-0.5 text-xs font-medium border rounded", STATE_BADGE[r.state])}>
        {bcStateLabel(r.state)}
      </span>
    ),
  },
];

const ktcColumns: Column<ReturnType<typeof getKtcScorecard>[number]>[] = [
  { key: "ktcCode", label: "Mã KTC", sortable: true, render: (r) => <span className="font-mono text-xs">{r.ktcCode}</span> },
  { key: "region", label: "Vùng", sortable: true, render: (r) => REGION_LABEL_VI[r.region] ?? r.region },
  { key: "ordersIn", label: "Đơn vào", align: "right", sortable: true, sortValue: (r) => r.ordersIn, render: (r) => formatCompactInt(r.ordersIn) },
  { key: "ordersOut", label: "Đơn ra", align: "right", sortable: true, sortValue: (r) => r.ordersOut, render: (r) => formatCompactInt(r.ordersOut) },
  {
    key: "ltAvgH", label: "LT TB", align: "right", sortable: true, sortValue: (r) => r.ltAvgH,
    render: (r) => <span className={pctColor(r.ltAvgH, 36, 60, false)}>{formatHours(r.ltAvgH)}</span>,
  },
  {
    key: "fillRateKg", label: "Fill rate kg", align: "right", sortable: true, sortValue: (r) => r.fillRateKg,
    render: (r) => <span className={pctColor(r.fillRateKg, 75, 60)}>{formatPct(r.fillRateKg, 1)}</span>,
  },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];
