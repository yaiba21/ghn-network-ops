"use client";

import { useMemo, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  bcStateLabel,
  getBcDrillByRegion,
  getBcSubMetricsByRegion,
  getKtcScorecard,
  getNetworkAlerts,
  getNetworkSubMetricsByRegion,
  getLaneMatrix,
  getOverviewNorthStar,
  getRegionBcStates,
  getRegionScorecard,
  getTerritoryMap,
} from "@/lib/aggregators";
import { dataUpdatedAt, getProvinces } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import dynamic from "next/dynamic";
import { OdMatrix } from "@/components/ui/OdMatrix";

// Leaflet cần window → load client-only, tránh SSR error
const LeafletTerritoryMap = dynamic(
  () =>
    import("@/components/ui/LeafletTerritoryMap").then(
      (m) => m.LeafletTerritoryMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] ghn-skeleton rounded-md" />
    ),
  },
);
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
  const subMetricsByRegion = useMemo(
    () => getNetworkSubMetricsByRegion(filter),
    [filter],
  );
  const laneMatrix = useMemo(() => getLaneMatrix(filter, 10), [filter]);
  const alerts = useMemo(() => getNetworkAlerts(filter), [filter]);
  const updated = dataUpdatedAt();

  // Drill-down state: vùng đang chọn để show BC bên dưới
  const [drillRegion, setDrillRegion] = useState<RegionCode | null>(null);
  const bcDrill = useMemo(
    () => (drillRegion ? getBcDrillByRegion(filter, drillRegion, 50) : []),
    [filter, drillRegion],
  );

  // Drill cho sub-metrics
  const [subDrillRegion, setSubDrillRegion] = useState<RegionCode | null>(null);
  const bcSubDrill = useMemo(
    () => (subDrillRegion ? getBcSubMetricsByRegion(filter, subDrillRegion, 50) : []),
    [filter, subDrillRegion],
  );

  // Territory map — chọn tỉnh để xem phân chia địa bàn BC
  const provinceOpts = useMemo(
    () => getProvinces().map((p) => ({ value: p.code, label: p.name })),
    [],
  );
  const [territoryProvince, setTerritoryProvince] = useState<string>(
    filter.provinceCode ?? "HCM",
  );
  const territory = useMemo(
    () => getTerritoryMap(filter, territoryProvince),
    [filter, territoryProvince],
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

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

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
        subtitle="So sánh: lượng đơn · ontime network · cost/kg · %GTC · % hàng ≥4 ca. Bấm vùng để drill xuống BC."
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

      {/* === Lane OD matrix === */}
      <Card
        title="Ma trận lane KTC ↔ KTC (Origin–Destination)"
        subtitle="Hàng = KTC đi, cột = KTC đến. Toggle giữa số trip (đậm = nhiều) và ontime (đỏ = trễ) để tìm lane bận / lane nghẽn."
      >
        <OdMatrix data={laneMatrix} />
      </Card>

      {/* === Phân chia địa bàn BC (territory map) === */}
      <Card
        title="Phân chia địa bàn BC"
        subtitle="Chọn tỉnh → xem phạm vi hoạt động từng BC. Hover vùng để xem đơn lấy/giao, đơn trong kho, sắp vận chuyển, ontime lấy + giao."
        actions={
          <DimensionSelect
            label="Tỉnh / Thành"
            value={territoryProvince}
            options={provinceOpts}
            onChange={(v) => v && setTerritoryProvince(v)}
            allOptionLabel="Chọn tỉnh"
            width={200}
            searchable
          />
        }
      >
        <LeafletTerritoryMap data={territory} />
      </Card>

      {/* === Network sub-metrics dạng bảng theo vùng (drill BC) === */}
      <Card
        title="Network sub-metrics theo vùng"
        subtitle="So sánh sub-metric NDS+KTC giữa 14 vùng. Bấm vùng để drill xuống sub-metric từng BC."
        actions={
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Công thức ước lượng — mock data
          </div>
        }
      >
        <DataTable
          columns={subMetricRegionColumns}
          data={subMetricsByRegion}
          rowKey={(r) => r.regionCode}
          onRowClick={(r) => setSubDrillRegion(r.regionCode)}
        />
      </Card>

      {/* === Drill sub-metrics theo BC === */}
      {subDrillRegion && (
        <Card
          title={`Sub-metrics BC — Vùng ${REGION_LABEL_VI[subDrillRegion]}`}
          subtitle={`${bcSubDrill.length} BC, sort theo cột để tìm BC kém. Xuất kiện ontime · chờ nhập KTC · sorting · sai lệch KLKT.`}
          actions={
            <button
              type="button"
              onClick={() => setSubDrillRegion(null)}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X className="w-3.5 h-3.5" /> Đóng
            </button>
          }
        >
          <DataTable
            columns={bcSubMetricColumns}
            data={bcSubDrill}
            rowKey={(r) => r.bcCode}
            searchable
            searchPlaceholder="Tìm BC..."
            pageSize={15}
          />
        </Card>
      )}
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

const subMetricRegionColumns: Column<
  ReturnType<typeof getNetworkSubMetricsByRegion>[number]
>[] = [
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
    key: "xuatKienOntime", label: "% Xuất kiện ontime", align: "right", sortable: true, sortValue: (r) => r.xuatKienOntime,
    render: (r) => <span className={pctColor(r.xuatKienOntime, 95, 90)}>{formatPct(r.xuatKienOntime, 1)}</span>,
  },
  {
    key: "choNhapKtc", label: "Chờ nhập KTC (phút)", align: "right", sortable: true, sortValue: (r) => r.choNhapKtc,
    render: (r) => <span className={pctColor(r.choNhapKtc, 30, 45, false)}>{formatInt(r.choNhapKtc)}'</span>,
  },
  {
    key: "tgSorting", label: "TG sorting (phút)", align: "right", sortable: true, sortValue: (r) => r.tgSorting,
    render: (r) => <span className={pctColor(r.tgSorting, 45, 60, false)}>{formatInt(r.tgSorting)}'</span>,
  },
  {
    key: "saiLechKlkt", label: "% Sai lệch KLKT", align: "right", sortable: true, sortValue: (r) => r.saiLechKlkt,
    render: (r) => <span className={pctColor(r.saiLechKlkt, 1.5, 3, false)}>{formatPct(r.saiLechKlkt, 1)}</span>,
  },
  {
    key: "soLanQuaKtc", label: "TB lần qua KTC", align: "right", sortable: true, sortValue: (r) => r.soLanQuaKtc,
    render: (r) => <span className={pctColor(r.soLanQuaKtc, 1.5, 2, false)}>{r.soLanQuaKtc}</span>,
  },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];

const bcSubMetricColumns: Column<ReturnType<typeof getBcSubMetricsByRegion>[number]>[] = [
  { key: "bcName", label: "Bưu cục", render: (r) => <span className="font-medium truncate">{r.bcName}</span> },
  { key: "province", label: "Tỉnh", sortable: true },
  {
    key: "xuatKienOntime", label: "% Xuất kiện ontime", align: "right", sortable: true, sortValue: (r) => r.xuatKienOntime,
    render: (r) => <span className={pctColor(r.xuatKienOntime, 95, 90)}>{formatPct(r.xuatKienOntime, 1)}</span>,
  },
  {
    key: "choNhapKtc", label: "Chờ nhập KTC (phút)", align: "right", sortable: true, sortValue: (r) => r.choNhapKtc,
    render: (r) => <span className={pctColor(r.choNhapKtc, 30, 45, false)}>{formatInt(r.choNhapKtc)}'</span>,
  },
  {
    key: "tgSorting", label: "TG sorting (phút)", align: "right", sortable: true, sortValue: (r) => r.tgSorting,
    render: (r) => <span className={pctColor(r.tgSorting, 45, 60, false)}>{formatInt(r.tgSorting)}'</span>,
  },
  {
    key: "saiLechKlkt", label: "% Sai lệch KLKT", align: "right", sortable: true, sortValue: (r) => r.saiLechKlkt,
    render: (r) => <span className={pctColor(r.saiLechKlkt, 1.5, 3, false)}>{formatPct(r.saiLechKlkt, 1)}</span>,
  },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];

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
    key: "pctTC", label: "%GTC", align: "right", sortable: true, sortValue: (r) => r.pctTC,
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
