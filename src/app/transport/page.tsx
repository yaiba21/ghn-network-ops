"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getLaneCodesForFilter,
  getLaneHealth,
  getTransportAlerts,
  getTransportByCarrier,
  getTransportByRouteType,
  getTransportCostByRegion,
  getTransportKpis,
  getTransportMap,
  getTransportNccByRegion,
  getTransportTrips,
  getTripDetail,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { KPI, statusFromValue } from "@/lib/kpi-config";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { TripTimeline } from "@/components/ui/TripTimeline";
import { Modal } from "@/components/ui/Modal";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { KpiCard } from "@/components/ui/KpiCard";
import { X } from "lucide-react";
import { REGION_LABEL_VI, type RegionCode } from "@/lib/types";

// Leaflet cần window → client-only
const LeafletTransportMap = dynamic(
  () => import("@/components/ui/LeafletTransportMap").then((m) => m.LeafletTransportMap),
  { ssr: false, loading: () => <div className="h-[560px] ghn-skeleton rounded-md" /> },
);
const TripRouteMap = dynamic(
  () => import("@/components/ui/TripRouteMap").then((m) => m.TripRouteMap),
  { ssr: false, loading: () => <div className="h-[300px] ghn-skeleton rounded-md" /> },
);
import {
  cn,
  formatCompactInt,
  formatHours,
  formatInt,
  formatPct,
  formatVND,
  formatVNDate,
} from "@/lib/utils";

export default function TransportPage() {
  const { filter, setFilter } = useFilter();
  const kpis = useMemo(() => getTransportKpis(filter), [filter]);
  const trips = useMemo(() => getTransportTrips(filter, 50), [filter]);
  const carriers = useMemo(() => getTransportByCarrier(filter), [filter]);
  const routeTypes = useMemo(() => getTransportByRouteType(filter), [filter]);
  const laneHealth = useMemo(() => getLaneHealth(filter, 30), [filter]);
  const laneOpts = useMemo(() => getLaneCodesForFilter(filter), [filter]);
  const map = useMemo(() => getTransportMap(filter, 14), [filter]);
  const alerts = useMemo(() => getTransportAlerts(filter), [filter]);
  const regionCost = useMemo(() => getTransportCostByRegion(filter), [filter]);
  const updated = dataUpdatedAt();

  // Trip được chọn → xem các điểm chạm
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const tripDetail = useMemo(
    () => (selectedTrip ? getTripDetail(selectedTrip) : null),
    [selectedTrip],
  );

  // Vùng được chọn → drill NCC + chi phí
  const [costRegion, setCostRegion] = useState<RegionCode | null>(null);
  const nccByRegion = useMemo(
    () => (costRegion ? getTransportNccByRegion(filter, costRegion) : []),
    [filter, costRegion],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Vận Tải" },
        ]}
        title="Vận Tải (Trip & Fleet)"
        subtitle="Chuyến xe realtime, fill rate, NCC, sức khoẻ tuyến. 1 tuyến gồm nhiều trip — lọc theo mã tuyến."
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
        extras={
          <DimensionSelect
            label="Mã tuyến"
            value={filter.laneCode}
            options={laneOpts}
            onChange={(v) => setFilter({ laneCode: v })}
            allOptionLabel="Tất cả tuyến"
            width={260}
            searchable
          />
        }
      />

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* === KPI vận tải (mở rộng) === */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="OPR" value={kpis.opr} unit="%" deltaPct={0} status={kpis.opr >= 95 ? "green" : kpis.opr >= 92 ? "amber" : "red"} direction="higher-better" target={95} size="sm" hint="Order Performance Rate" />
        <KpiCard label="ODR" value={kpis.odr} unit="%" deltaPct={0} status={kpis.odr >= 95 ? "green" : kpis.odr >= 92 ? "amber" : "red"} direction="higher-better" target={95} size="sm" hint="On-time Delivery Rate" />
        <KpiCard label="Ontime lấy hàng" value={kpis.ontimeLayHang} unit="%" deltaPct={0} status={statusFromValue(KPI.pctLTC, kpis.ontimeLayHang)} direction="higher-better" target={85} size="sm" hint="Đúng cutoff" />
        <KpiCard label="%FD" value={kpis.fdRate} unit="%" deltaPct={0} status={statusFromValue(KPI.fdRate, kpis.fdRate)} direction="lower-better" target={5} size="sm" hint="Failed Delivery" />
        <KpiCard label="AOV" value={kpis.aov} unit="VND" deltaPct={0} status="green" direction="higher-better" target={28000} size="sm" hint="Avg Order Value" />
        <KpiCard label="Cost / km" value={kpis.avgCostPerKm} unit="VND" deltaPct={0} status="green" direction="lower-better" target={15000} size="sm" />
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Ontime vận tải" value={kpis.ontimeTrip} unit="%" deltaPct={0} status={statusFromValue(KPI.ontimeVanTai, kpis.ontimeTrip)} direction="higher-better" target={95} size="sm" />
        <KpiCard label="Fill rate kg" value={kpis.fillRateKg} unit="%" deltaPct={0} status={statusFromValue(KPI.fillRateKg, kpis.fillRateKg)} direction="higher-better" target={75} size="sm" />
        <KpiCard label="Fill rate đơn" value={kpis.fillRateOrder} unit="%" deltaPct={0} status={statusFromValue(KPI.fillRateOrder, kpis.fillRateOrder)} direction="higher-better" target={70} size="sm" />
        <KpiCard label="% Empty Mileage" value={kpis.emptyMileage} unit="%" deltaPct={0} status={statusFromValue(KPI.pctEmptyMileage, kpis.emptyMileage)} direction="lower-better" target={20} size="sm" />
        <KpiCard label="Leadtime gán" value={kpis.leadtimeGanH} unit="h" deltaPct={0} status={kpis.leadtimeGanH <= 2 ? "green" : kpis.leadtimeGanH <= 3 ? "amber" : "red"} direction="lower-better" target={1.5} size="sm" />
        <KpiCard label="Leadtime LTC" value={kpis.leadtimeLtcH} unit="h" deltaPct={0} status={kpis.leadtimeLtcH <= 4 ? "green" : kpis.leadtimeLtcH <= 6 ? "amber" : "red"} direction="lower-better" target={4} size="sm" />
      </section>

      {/* === Leaflet map tuyến + điểm chạm === */}
      <Card
        title="Bản đồ tuyến vận tải — KTC + điểm chạm"
        subtitle="Tuyến vẽ theo đường bộ thực tế (bám đường, nằm trong đất liền). KTC chấm cam (size = parcels). Hover/chọn 1 tuyến bên phải → hiện chuỗi điểm chạm BC lấy → KTC → BC giao."
      >
        <LeafletTransportMap nodes={map.nodes} routes={map.routes} />
      </Card>

      {/* === Bảng sức khoẻ tuyến === */}
      <Card
        title={`Sức khoẻ tuyến — ${laneHealth.length} tuyến (mỗi tuyến ≥2 trip)`}
        subtitle="Gom trip theo tuyến origin→dest. Sort để tìm tuyến ontime thấp / fill rate kém / empty cao."
      >
        <DataTable
          columns={laneColumns}
          data={laneHealth}
          rowKey={(r) => r.laneCode}
          searchable
          searchPlaceholder="Tìm tuyến (origin/dest)..."
          pageSize={12}
          onRowClick={(r) => setFilter({ laneCode: r.laneCode })}
        />
      </Card>

      {/* === Trip realtime === */}
      <Card
        title="Bảng chuyến realtime — Top 50 mới nhất"
        subtitle="Bấm 1 chuyến để xem các điểm chạm (qua BC/KTC nào, timestamp, thời lượng)."
      >
        <DataTable
          columns={tripColumns}
          data={trips}
          rowKey={(r) => r.tripId}
          searchable
          searchPlaceholder="Tìm trip ID / origin / dest / NCC..."
          pageSize={20}
          onRowClick={(r) => setSelectedTrip(r.tripId)}
        />
      </Card>

      {/* === Trip detail popup (modal) — trang chi tiết đầy đủ === */}
      <Modal
        open={!!tripDetail}
        onClose={() => setSelectedTrip(null)}
        title={tripDetail ? `Chi tiết chuyến ${tripDetail.tripId}` : ""}
        subtitle="Tổng quan chuyến · chi phí · tải trọng · kế hoạch vs thực tế · chuỗi điểm chạm (bản đồ + timeline)."
        widthClass="max-w-5xl"
      >
        {tripDetail && <TripDetailView detail={tripDetail} />}
      </Modal>

      {/* === Chi phí run rate vs budget theo vùng (+ drill NCC) === */}
      <Card
        title="Chi phí vận tải theo vùng — run rate vs budget"
        subtitle="Run rate = chi phí kỳ quy đổi/tháng. So với budget tháng; vượt budget = cảnh báo đỏ. Bấm 1 vùng để drill xuống NCC + chi phí trong vùng."
        actions={
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Budget mock — chờ data thật
          </div>
        }
      >
        <DataTable
          columns={regionCostColumns}
          data={regionCost}
          rowKey={(r) => r.regionCode}
          onRowClick={(r) => setCostRegion(r.regionCode)}
        />
      </Card>

      {/* === Drill NCC trong vùng === */}
      {costRegion && (
        <Card
          title={`NCC trong vùng ${REGION_LABEL_VI[costRegion]} — chi phí`}
          subtitle={`${nccByRegion.length} NCC hoạt động, sort theo chi phí. Share = % chi phí vùng.`}
          actions={
            <button
              type="button"
              onClick={() => setCostRegion(null)}
              className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              <X className="w-3.5 h-3.5" /> Đóng
            </button>
          }
        >
          <DataTable
            columns={regionNccColumns}
            data={nccByRegion}
            rowKey={(r) => r.carrier}
          />
        </Card>
      )}

      {/* === Carriers + Route types === */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card title="Theo Nhà Cung Cấp (NCC)" subtitle="So sánh ontime · fill rate · avg cost giữa các NCC.">
          <DataTable columns={carrierColumns} data={carriers} rowKey={(r) => r.carrier} />
        </Card>
        <Card title="Theo loại tuyến" subtitle="FM (BC→KTC) · LH (KTC↔KTC) · LM (KTC→BC) · RT (Return).">
          <DataTable columns={routeTypeColumns} data={routeTypes} rowKey={(r) => r.type} />
        </Card>
      </div>
    </div>
  );
}

// =============================================================================
// Trang chi tiết chuyến (rich)
// =============================================================================

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--color-border)] rounded-md p-2 bg-white">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] truncate">
        {label}
      </div>
      <div className="text-sm font-semibold tabular-nums text-[var(--color-text)] mt-0.5">
        {value}
      </div>
    </div>
  );
}

function PlanActual({
  label,
  plan,
  actual,
  lateMin,
}: {
  label: string;
  plan: string;
  actual: string;
  lateMin: number;
}) {
  const fmt = (iso: string) =>
    `${formatVNDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
  const tone =
    lateMin <= 15 ? "text-emerald-600" : lateMin <= 60 ? "text-amber-600" : "text-red-600";
  const lateLabel =
    lateMin < 0
      ? `Sớm ${Math.abs(lateMin)}'`
      : lateMin <= 15
        ? `Đúng giờ (+${lateMin}')`
        : `Trễ ${lateMin}'`;
  return (
    <div className="border border-[var(--color-border)] rounded-md p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Kế hoạch</div>
          <div className="font-medium tabular-nums">{fmt(plan)}</div>
        </div>
        <div>
          <div className="text-[10px] text-[var(--color-text-muted)]">Thực tế</div>
          <div className="font-medium tabular-nums">{fmt(actual)}</div>
        </div>
      </div>
      <div className={cn("mt-1.5 text-xs font-medium", tone)}>{lateLabel}</div>
    </div>
  );
}

function TripDetailView({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof getTripDetail>>;
}) {
  const d = detail;
  return (
    <div className="space-y-4">
      {/* Badges + trạng thái */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono px-2 py-0.5 bg-[var(--color-hover)] rounded">{d.type}</span>
        <span className="text-xs px-2 py-0.5 bg-[var(--color-hover)] rounded">NCC: {d.carrier}</span>
        <span className="text-xs px-2 py-0.5 bg-[var(--color-hover)] rounded">Xe: {d.vehicle}</span>
        <span className="text-xs px-2 py-0.5 bg-[var(--color-hover)] rounded">Vùng: {d.region}</span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium">
          <StatusDot status={d.status} />
          {d.lateMin <= 15 ? "Đến đúng giờ" : `Đến trễ ${d.lateMin}'`}
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <MiniStat label="Parcels" value={formatCompactInt(d.parcels)} />
        <MiniStat label="Khối lượng" value={`${formatCompactInt(d.weightKg)} kg`} />
        <MiniStat label="Tổng km" value={`${formatInt(d.totalKm)} km`} />
        <MiniStat label="Chi phí" value={formatVND(d.cost, true)} />
        <MiniStat label="Cost/km" value={formatVND(d.costPerKm)} />
        <MiniStat label="Cost/parcel" value={formatVND(d.costPerParcel)} />
        <MiniStat label="Fill kg" value={formatPct(d.fillRateKg, 1)} />
        <MiniStat label="Fill đơn" value={formatPct(d.fillRateOrder, 1)} />
        <MiniStat label="Empty" value={`${formatInt(d.emptyKm)}km · ${formatPct(d.emptyPct, 0)}`} />
        <MiniStat label="Điểm chạm" value={`${d.stopCount}`} />
        <MiniStat label="Tổng dừng" value={formatHours(d.totalDwellMin / 60)} />
        <MiniStat label="Thời lượng" value={formatHours(d.totalDurationMin / 60)} />
      </div>

      {/* Kế hoạch vs thực tế */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <PlanActual label="Xuất phát" plan={d.planDepart} actual={d.actualDepart} lateMin={d.departLateMin} />
        <PlanActual label="Đến nơi" plan={d.planArrive} actual={d.actualArrive} lateMin={d.lateMin} />
      </div>

      {/* Bản đồ + timeline điểm chạm */}
      <TripRouteMap stops={d.stops} status={d.status} height={280} />
      <TripTimeline detail={d} />
    </div>
  );
}

const regionCostColumns: Column<ReturnType<typeof getTransportCostByRegion>[number]>[] = [
  {
    key: "regionName",
    label: "Vùng",
    render: (r) => <span className="font-medium">{r.regionName}</span>,
  },
  { key: "trips", label: "Số trip", align: "right", sortable: true, sortValue: (r) => r.trips, render: (r) => formatCompactInt(r.trips) },
  { key: "actualCost", label: "Chi phí kỳ", align: "right", sortable: true, sortValue: (r) => r.actualCost, render: (r) => formatVND(r.actualCost, true) },
  { key: "runRate", label: "Run rate / tháng", align: "right", sortable: true, sortValue: (r) => r.runRate, render: (r) => <span className="font-semibold tabular-nums">{formatVND(r.runRate, true)}</span> },
  { key: "budget", label: "Budget / tháng", align: "right", sortable: true, sortValue: (r) => r.budget, render: (r) => <span className="text-[var(--color-text-muted)]">{formatVND(r.budget, true)}</span> },
  {
    key: "pctBudget", label: "% so budget", align: "right", sortable: true, sortValue: (r) => r.pctBudget,
    render: (r) => (
      <span className={r.pctBudget > 100 ? "text-red-600 font-semibold" : r.pctBudget >= 95 ? "text-amber-600" : "text-emerald-600"}>
        {formatPct(r.pctBudget, 1)}
      </span>
    ),
  },
  {
    key: "overBudget", label: "Cảnh báo", align: "right",
    render: (r) =>
      r.overBudget ? (
        <span className="inline-block px-2 py-0.5 text-xs font-medium border rounded bg-red-100 text-red-800 border-red-200">
          Vượt budget +{formatVND(r.runRate - r.budget, true)}
        </span>
      ) : (
        <span className="inline-block px-2 py-0.5 text-xs font-medium border rounded bg-emerald-100 text-emerald-800 border-emerald-200">
          Trong budget
        </span>
      ),
  },
];

const regionNccColumns: Column<ReturnType<typeof getTransportNccByRegion>[number]>[] = [
  { key: "carrier", label: "NCC", render: (r) => <span className="font-medium">{r.carrier}</span> },
  { key: "trips", label: "Chuyến", align: "right", sortable: true, sortValue: (r) => r.trips, render: (r) => formatCompactInt(r.trips) },
  { key: "cost", label: "Chi phí", align: "right", sortable: true, sortValue: (r) => r.cost, render: (r) => <span className="font-semibold tabular-nums">{formatVND(r.cost, true)}</span> },
  {
    key: "share", label: "Share vùng", align: "right", sortable: true, sortValue: (r) => r.share,
    render: (r) => formatPct(r.share, 1),
  },
  { key: "avgCost", label: "Cost TB/chuyến", align: "right", sortable: true, sortValue: (r) => r.avgCost, render: (r) => formatVND(r.avgCost) },
  {
    key: "ontime", label: "Ontime", align: "right", sortable: true, sortValue: (r) => r.ontime,
    render: (r) => <span className={r.ontime >= 95 ? "text-emerald-600" : r.ontime >= 93 ? "text-amber-600" : "text-red-600"}>{formatPct(r.ontime, 1)}</span>,
  },
];

const laneColumns: Column<ReturnType<typeof getLaneHealth>[number]>[] = [
  { key: "origin", label: "Điểm đi", render: (r) => <span className="font-mono text-xs">{r.origin}</span> },
  { key: "dest", label: "Điểm đến", render: (r) => <span className="font-mono text-xs">{r.dest}</span> },
  { key: "trips", label: "Số trip", align: "right", sortable: true, sortValue: (r) => r.trips, render: (r) => formatInt(r.trips) },
  { key: "totalParcels", label: "Parcels", align: "right", sortable: true, sortValue: (r) => r.totalParcels, render: (r) => formatCompactInt(r.totalParcels) },
  {
    key: "ontime", label: "Ontime", align: "right", sortable: true, sortValue: (r) => r.ontime,
    render: (r) => <span className={r.ontime >= 95 ? "text-emerald-600" : r.ontime >= 93 ? "text-amber-600" : "text-red-600"}>{formatPct(r.ontime, 1)}</span>,
  },
  {
    key: "fillRateKg", label: "Fill kg", align: "right", sortable: true, sortValue: (r) => r.fillRateKg,
    render: (r) => <span className={r.fillRateKg >= 75 ? "text-emerald-600" : r.fillRateKg >= 60 ? "text-amber-600" : "text-red-600"}>{formatPct(r.fillRateKg, 1)}</span>,
  },
  {
    key: "emptyPct", label: "% Empty", align: "right", sortable: true, sortValue: (r) => r.emptyPct,
    render: (r) => <span className={r.emptyPct <= 20 ? "text-emerald-600" : r.emptyPct <= 30 ? "text-amber-600" : "text-red-600"}>{formatPct(r.emptyPct, 1)}</span>,
  },
  { key: "avgCost", label: "Cost TB", align: "right", sortable: true, sortValue: (r) => r.avgCost, render: (r) => formatVND(r.avgCost, true) },
];

const tripColumns: Column<ReturnType<typeof getTransportTrips>[number]>[] = [
  { key: "tripId", label: "Trip ID", sortable: true, render: (r) => <span className="font-mono text-xs">{r.tripId}</span> },
  { key: "type", label: "Loại", sortable: true, render: (r) => <span className="text-xs px-1.5 py-0.5 bg-[var(--color-hover)] rounded font-mono">{r.type}</span> },
  { key: "origin", label: "Origin", render: (r) => <span className="font-mono text-xs">{r.origin}</span> },
  { key: "dest", label: "Dest", render: (r) => <span className="font-mono text-xs">{r.dest}</span> },
  {
    key: "planDepart", label: "Plan depart", sortable: true, sortValue: (r) => r.planDepart,
    render: (r) => <span className="text-xs tabular-nums">{formatVNDate(r.planDepart.slice(0, 10))} {r.planDepart.slice(11, 16)}</span>,
  },
  {
    key: "fillRateKg", label: "Fill kg", align: "right", sortable: true, sortValue: (r) => r.fillRateKg,
    render: (r) => <span className={r.fillRateKg >= 75 ? "text-emerald-600" : r.fillRateKg >= 60 ? "text-amber-600" : "text-red-600"}>{formatPct(r.fillRateKg, 1)}</span>,
  },
  { key: "parcels", label: "Parcels", align: "right", sortable: true, sortValue: (r) => r.parcels, render: (r) => formatCompactInt(r.parcels) },
  { key: "cost", label: "Cost", align: "right", sortable: true, sortValue: (r) => r.cost, render: (r) => formatVND(r.cost, true) },
  { key: "vehicle", label: "Xe", sortable: true },
  { key: "carrier", label: "NCC", sortable: true },
];

const carrierColumns: Column<ReturnType<typeof getTransportByCarrier>[number]>[] = [
  { key: "carrier", label: "NCC", render: (r) => <span className="font-medium">{r.carrier}</span> },
  { key: "trips", label: "Chuyến", align: "right", sortable: true, sortValue: (r) => r.trips, render: (r) => formatCompactInt(r.trips) },
  {
    key: "ontime", label: "Ontime", align: "right", sortable: true, sortValue: (r) => r.ontime,
    render: (r) => <span className={r.ontime >= 95 ? "text-emerald-600" : r.ontime >= 93 ? "text-amber-600" : "text-red-600"}>{formatPct(r.ontime, 1)}</span>,
  },
  { key: "fillRateKg", label: "Fill kg", align: "right", sortable: true, sortValue: (r) => r.fillRateKg, render: (r) => formatPct(r.fillRateKg, 1) },
  { key: "avgCost", label: "Cost TB", align: "right", sortable: true, sortValue: (r) => r.avgCost, render: (r) => formatVND(r.avgCost) },
];

const routeTypeColumns: Column<ReturnType<typeof getTransportByRouteType>[number]>[] = [
  { key: "type", label: "Loại tuyến", render: (r) => <span className="font-medium">{r.type}</span> },
  { key: "trips", label: "Số chuyến", align: "right", sortable: true, sortValue: (r) => r.trips, render: (r) => formatCompactInt(r.trips) },
  { key: "fillRateKg", label: "Fill kg", align: "right", sortable: true, sortValue: (r) => r.fillRateKg, render: (r) => formatPct(r.fillRateKg, 1) },
  { key: "avgKm", label: "Km TB", align: "right", sortable: true, sortValue: (r) => r.avgKm, render: (r) => `${formatInt(r.avgKm)} km` },
  {
    key: "emptyPct", label: "% Empty", align: "right", sortable: true, sortValue: (r) => r.emptyPct,
    render: (r) => <span className={r.emptyPct <= 20 ? "text-emerald-600" : r.emptyPct <= 30 ? "text-amber-600" : "text-red-600"}>{formatPct(r.emptyPct, 1)}</span>,
  },
];
