"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  dataUpdatedAt,
  getMisRouteRows,
  getProvinceCoverage,
  getReRouteTrend,
  getReRouteTriggers,
  getRoutingDecisionQuality,
  getRoutingKpis,
} from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { KpiCard, KpiCardFrom } from "@/components/ui/KpiCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { OdMatrixCard } from "@/components/routing/OdMatrixCard";
import { RoutingDecisionQualityCard } from "@/components/routing/RoutingDecisionQualityCard";
import { ReRouteTriggersCard } from "@/components/routing/ReRouteTriggersCard";
import { ProvinceCoverageGrid } from "@/components/routing/ProvinceCoverageGrid";
import {
  formatHours,
  formatInt,
  formatVNDate,
} from "@/lib/utils";
import {
  SERVICE_LABEL_VI,
  type MisRouteRow,
} from "@/lib/types";

export default function RoutingPage() {
  const { filter } = useFilter();
  const k = getRoutingKpis(filter);
  const triggers = getReRouteTriggers(filter);
  const reRouteTrend = getReRouteTrend(filter);
  const decisions = getRoutingDecisionQuality(filter);
  const coverage = useMemo(() => getProvinceCoverage(filter), [filter]);
  const misRouteRows = getMisRouteRows(filter, 20);
  const updated = dataUpdatedAt();

  // Coverage KPI = weighted avg of province coverage by order volume.
  const coverageKpi = useMemo(() => {
    const total = coverage.reduce((a, b) => a + b.totalOrders, 0);
    const weighted =
      total === 0
        ? 0
        : coverage.reduce((a, b) => a + b.coveredPct * b.totalOrders, 0) /
          total;
    const status =
      weighted >= 97 ? "green" : weighted >= 93 ? "amber" : "red";
    return {
      label: "Coverage %",
      value: weighted,
      unit: "%" as const,
      target: 98,
      deltaPct: 0.4,
      sparkline: [95, 95.2, 95.5, 95.8, 95.9, 96.0, 96.1, 96.2, 96.3, 96.4, 96.4, 96.5, 96.5, 96.6],
      status,
      direction: "higher-better" as const,
    };
  }, [coverage]);

  const misRouteColumns: Column<MisRouteRow>[] = [
    {
      key: "mvd",
      label: "MVĐ",
      sortable: true,
      className: "font-mono text-xs",
    },
    {
      key: "createdAt",
      label: "Tạo lúc",
      sortable: true,
      sortValue: (r) => r.createdAt,
      render: (r) => (
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
          {formatVNDate(r.createdAt.slice(0, 10))}{" "}
          {r.createdAt.slice(11, 16)}
        </span>
      ),
    },
    {
      key: "senderProvince",
      label: "Sender",
      sortable: true,
    },
    {
      key: "receiverProvince",
      label: "Receiver",
      sortable: true,
    },
    {
      key: "serviceType",
      label: "Service",
      sortable: true,
      render: (r) => SERVICE_LABEL_VI[r.serviceType],
    },
    {
      key: "predictedKtc",
      label: "Predicted KTC",
      render: (r) => <span className="font-mono text-xs">{r.predictedKtc}</span>,
    },
    {
      key: "actualKtc",
      label: "Actual KTC",
      render: (r) => (
        <span className="font-mono text-xs text-[var(--color-status-red)]">
          {r.actualKtc}
        </span>
      ),
    },
    {
      key: "reason",
      label: "Lý do",
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Định tuyến (ORS)" },
        ]}
        title="Định tuyến (ORS)"
        updatedAt={updated}
        showDefaultActions={false}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          service: true,
          granularity: true,
        }}
      />

      {/* KPI strip — 6 cards per plan_1 spec */}
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCardFrom kpi={k.routingAccuracy} size="sm" />
        <KpiCardFrom kpi={k.misRouteRate} size="sm" />
        <KpiCardFrom kpi={k.reRouteRate} size="sm" />
        <KpiCardFrom kpi={k.fallbackRate} size="sm" />
        <KpiCard
          label="ORS latency (P50/P99)"
          value={k.latencyP50.value}
          unit="ms"
          deltaPct={k.latencyP50.deltaPct}
          status={k.latencyP50.status}
          direction={k.latencyP50.direction}
          target={k.latencyP50.target}
          sparkline={k.latencyP50.sparkline}
          hint={`P99 ${formatInt(k.latencyP99.value)}ms`}
          size="sm"
        />
        <KpiCard {...coverageKpi} size="sm" />
      </section>

      {/* §1 OD Matrix */}
      <OdMatrixCard filter={filter} />

      {/* §2 Routing decision quality */}
      <RoutingDecisionQualityCard rows={decisions} />

      {/* §3 Mis-route deep dive table */}
      <Card
        title="Mis-route deep dive — top 20"
        subtitle="Planned vs actual KTC, lý do mis-route. Sort theo cột để tìm rule sai trong ORS."
      >
        <DataTable<MisRouteRow>
          columns={misRouteColumns}
          data={misRouteRows}
          rowKey={(r) => r.mvd}
          searchable
          searchPlaceholder="Tìm MVĐ, tỉnh, lý do..."
          pageSize={20}
        />
      </Card>

      {/* §4 Re-route triggers */}
      <ReRouteTriggersCard triggers={triggers} trend={reRouteTrend} />

      {/* §5 Province coverage */}
      <ProvinceCoverageGrid rows={coverage} />
    </div>
  );
}
