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
  getTransportKpis,
  getTransportMap,
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";

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
  const updated = dataUpdatedAt();

  // Trip được chọn → xem các điểm chạm
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const tripDetail = useMemo(
    () => (selectedTrip ? getTripDetail(selectedTrip) : null),
    [selectedTrip],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Vận Tải" },
        ]}
        title="Vận Tải — Trip & Fleet"
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
        subtitle="Bản đồ thật. KTC chấm cam (size = parcels). Hover/chọn 1 tuyến bên phải → hiện chuỗi điểm chạm (BC lấy → KTC → BC giao) với marker từng điểm."
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

      {/* === Trip detail popup (modal) === */}
      <Modal
        open={!!tripDetail}
        onClose={() => setSelectedTrip(null)}
        title={tripDetail ? `Hành trình chuyến ${tripDetail.tripId}` : ""}
        subtitle="Chuỗi điểm chạm theo thứ tự (BC lấy → KTC → KTC → BC giao). Bản đồ + timeline giờ đến/rời, thời gian dừng, tổng thời lượng tích luỹ."
        widthClass="max-w-5xl"
      >
        {tripDetail && (
          <div className="space-y-4">
            <TripRouteMap stops={tripDetail.stops} status={tripDetail.status} height={280} />
            <TripTimeline detail={tripDetail} />
          </div>
        )}
      </Modal>

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
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
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
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
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
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
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
