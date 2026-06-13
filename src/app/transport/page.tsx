"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getTransportByCarrier,
  getTransportByRouteType,
  getTransportKpis,
  getTransportTrips,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { KPI, statusFromValue } from "@/lib/kpi-config";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { KpiCard } from "@/components/ui/KpiCard";
import {
  cn,
  formatCompactInt,
  formatPct,
  formatVND,
  formatVNDate,
  formatInt,
} from "@/lib/utils";

export default function TransportPage() {
  const { filter } = useFilter();
  const kpis = useMemo(() => getTransportKpis(filter), [filter]);
  const trips = useMemo(() => getTransportTrips(filter, 50), [filter]);
  const carriers = useMemo(() => getTransportByCarrier(filter), [filter]);
  const routeTypes = useMemo(() => getTransportByRouteType(filter), [filter]);
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Vận Tải" },
        ]}
        title="Vận Tải — Trip & Fleet"
        subtitle="Theo dõi chuyến xe realtime, fill rate, NCC, route type. Drill xuống từng trip ID."
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

      {/* === KPI vận tải === */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Ontime vận tải"
          value={kpis.ontimeTrip}
          unit="%"
          deltaPct={0}
          status={statusFromValue(KPI.ontimeVanTai, kpis.ontimeTrip)}
          direction="higher-better"
          target={95}
          size="sm"
        />
        <KpiCard
          label="Fill rate kg"
          value={kpis.fillRateKg}
          unit="%"
          deltaPct={0}
          status={statusFromValue(KPI.fillRateKg, kpis.fillRateKg)}
          direction="higher-better"
          target={75}
          size="sm"
        />
        <KpiCard
          label="Fill rate đơn"
          value={kpis.fillRateOrder}
          unit="%"
          deltaPct={0}
          status={statusFromValue(KPI.fillRateOrder, kpis.fillRateOrder)}
          direction="higher-better"
          target={70}
          size="sm"
        />
        <KpiCard
          label="% Empty Mileage"
          value={kpis.emptyMileage}
          unit="%"
          deltaPct={0}
          status={statusFromValue(KPI.pctEmptyMileage, kpis.emptyMileage)}
          direction="lower-better"
          target={20}
          size="sm"
        />
        <KpiCard
          label="Cost / km"
          value={kpis.avgCostPerKm}
          unit="VND"
          deltaPct={0}
          status="green"
          direction="lower-better"
          target={15000}
          size="sm"
        />
        <KpiCard
          label="Tổng chuyến"
          value={kpis.totalTrips}
          unit="đơn"
          deltaPct={0}
          status="green"
          direction="higher-better"
          target={0}
          size="sm"
          hint={`${formatCompactInt(kpis.totalParcels)} parcels`}
        />
      </section>

      {/* === Trip realtime table === */}
      <Card
        title="Bảng chuyến realtime — Top 50 mới nhất"
        subtitle="Sort theo cột để tìm chuyến trễ / fill rate thấp / cost cao."
      >
        <DataTable
          columns={tripColumns}
          data={trips}
          rowKey={(r) => r.tripId}
          searchable
          searchPlaceholder="Tìm trip ID / origin / dest / NCC..."
          pageSize={20}
        />
      </Card>

      {/* === Carriers + Route types === */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card
          title="Theo Nhà Cung Cấp (NCC)"
          subtitle="So sánh ontime · fill rate · avg cost giữa các NCC."
        >
          <DataTable
            columns={carrierColumns}
            data={carriers}
            rowKey={(r) => r.carrier}
          />
        </Card>
        <Card
          title="Theo loại tuyến"
          subtitle="FM (BC→KTC) · LH (KTC↔KTC) · LM (KTC→BC) · RT (Return)."
        >
          <DataTable
            columns={routeTypeColumns}
            data={routeTypes}
            rowKey={(r) => r.type}
          />
        </Card>
      </div>
    </div>
  );
}

const tripColumns: Column<ReturnType<typeof getTransportTrips>[number]>[] = [
  {
    key: "tripId",
    label: "Trip ID",
    sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.tripId}</span>,
  },
  {
    key: "type",
    label: "Loại",
    sortable: true,
    render: (r) => (
      <span className="text-xs px-1.5 py-0.5 bg-[var(--color-hover)] rounded font-mono">
        {r.type}
      </span>
    ),
  },
  {
    key: "origin",
    label: "Origin",
    render: (r) => <span className="font-mono text-xs">{r.origin}</span>,
  },
  {
    key: "dest",
    label: "Dest",
    render: (r) => <span className="font-mono text-xs">{r.dest}</span>,
  },
  {
    key: "planDepart",
    label: "Plan depart",
    sortable: true,
    sortValue: (r) => r.planDepart,
    render: (r) => (
      <span className="text-xs tabular-nums">
        {formatVNDate(r.planDepart.slice(0, 10))} {r.planDepart.slice(11, 16)}
      </span>
    ),
  },
  {
    key: "fillRateKg",
    label: "Fill kg",
    align: "right",
    sortable: true,
    sortValue: (r) => r.fillRateKg,
    render: (r) => (
      <span
        className={
          r.fillRateKg >= 75
            ? "text-emerald-600"
            : r.fillRateKg >= 60
              ? "text-amber-600"
              : "text-red-600"
        }
      >
        {formatPct(r.fillRateKg, 1)}
      </span>
    ),
  },
  {
    key: "parcels",
    label: "Parcels",
    align: "right",
    sortable: true,
    sortValue: (r) => r.parcels,
    render: (r) => formatCompactInt(r.parcels),
  },
  {
    key: "cost",
    label: "Cost",
    align: "right",
    sortable: true,
    sortValue: (r) => r.cost,
    render: (r) => formatVND(r.cost, true),
  },
  {
    key: "vehicle",
    label: "Xe",
    sortable: true,
  },
  {
    key: "carrier",
    label: "NCC",
    sortable: true,
  },
  {
    key: "status",
    label: "Trạng thái",
    align: "right",
    render: (r) => (
      <div className="inline-flex">
        <StatusBadge status={r.status} />
      </div>
    ),
  },
];

const carrierColumns: Column<ReturnType<typeof getTransportByCarrier>[number]>[] = [
  { key: "carrier", label: "NCC", render: (r) => <span className="font-medium">{r.carrier}</span> },
  {
    key: "trips",
    label: "Chuyến",
    align: "right",
    sortable: true,
    sortValue: (r) => r.trips,
    render: (r) => formatCompactInt(r.trips),
  },
  {
    key: "ontime",
    label: "Ontime",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ontime,
    render: (r) => (
      <span className={r.ontime >= 95 ? "text-emerald-600" : r.ontime >= 93 ? "text-amber-600" : "text-red-600"}>
        {formatPct(r.ontime, 1)}
      </span>
    ),
  },
  {
    key: "fillRateKg",
    label: "Fill kg",
    align: "right",
    sortable: true,
    sortValue: (r) => r.fillRateKg,
    render: (r) => formatPct(r.fillRateKg, 1),
  },
  {
    key: "avgCost",
    label: "Cost TB",
    align: "right",
    sortable: true,
    sortValue: (r) => r.avgCost,
    render: (r) => formatVND(r.avgCost),
  },
  {
    key: "status",
    label: "Trạng thái",
    align: "right",
    render: (r) => (
      <div className="inline-flex">
        <StatusBadge status={r.status} />
      </div>
    ),
  },
];

const routeTypeColumns: Column<ReturnType<typeof getTransportByRouteType>[number]>[] = [
  { key: "type", label: "Loại tuyến", render: (r) => <span className="font-medium">{r.type}</span> },
  {
    key: "trips",
    label: "Số chuyến",
    align: "right",
    sortable: true,
    sortValue: (r) => r.trips,
    render: (r) => formatCompactInt(r.trips),
  },
  {
    key: "fillRateKg",
    label: "Fill kg",
    align: "right",
    sortable: true,
    sortValue: (r) => r.fillRateKg,
    render: (r) => formatPct(r.fillRateKg, 1),
  },
  {
    key: "avgKm",
    label: "Km TB",
    align: "right",
    sortable: true,
    sortValue: (r) => r.avgKm,
    render: (r) => `${formatInt(r.avgKm)} km`,
  },
  {
    key: "emptyPct",
    label: "% Empty",
    align: "right",
    sortable: true,
    sortValue: (r) => r.emptyPct,
    render: (r) => (
      <span className={r.emptyPct <= 20 ? "text-emerald-600" : r.emptyPct <= 30 ? "text-amber-600" : "text-red-600"}>
        {formatPct(r.emptyPct, 1)}
      </span>
    ),
  },
];
