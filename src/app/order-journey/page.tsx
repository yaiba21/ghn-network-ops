"use client";

import { useMemo, useState } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  dataUpdatedAt,
  getDeliveryCohorts,
  getOrderFunnel,
  getOrderJourneyKpis,
  getOrderList,
  getOrderTimeline,
  getSankeyFlows,
  getStageLeadTimes,
} from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { Funnel } from "@/components/ui/Funnel";
import { Heatmap } from "@/components/ui/Heatmap";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import { BoxPlot } from "@/components/order-journey/BoxPlot";
import { Sankey } from "@/components/order-journey/Sankey";
import { OrderTimelineDrawer } from "@/components/order-journey/OrderTimelineDrawer";
import { cn, formatHours, formatPct, formatVNDate } from "@/lib/utils";
import type { OrderRow, OrderTimeline } from "@/lib/types";

export default function OrderJourneyPage() {
  const { filter } = useFilter();

  const kpis = getOrderJourneyKpis(filter);
  const funnel = getOrderFunnel(filter);
  const leadTimes = getStageLeadTimes(filter);
  const sankey = getSankeyFlows(filter);
  const cohorts = useMemo(() => {
    const c = getDeliveryCohorts(filter);
    // Format row labels as DD/MM
    return {
      ...c,
      rows: c.rows.map((d) => formatVNDate(d).slice(0, 5)),
      cells: c.cells.map((cell) => ({
        ...cell,
        row: formatVNDate(cell.row).slice(0, 5),
      })),
    };
  }, [filter]);
  const orders = useMemo(() => getOrderList(filter, 50), [filter]);
  const updated = dataUpdatedAt();

  const [drillId, setDrillId] = useState<string | null>(null);
  const drillTimeline: OrderTimeline | null = useMemo(
    () => (drillId ? getOrderTimeline(drillId) : null),
    [drillId],
  );

  const orderColumns: Column<OrderRow>[] = [
    {
      key: "mvd",
      label: "MVĐ",
      sortable: true,
      className: "font-mono text-xs",
      width: 120,
    },
    { key: "shop", label: "Shop", sortable: true },
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
      key: "currentState",
      label: "Trạng thái",
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs">{r.currentState}</span>
      ),
    },
    {
      key: "daysInState",
      label: "Days in state",
      align: "right",
      sortable: true,
      sortValue: (r) => r.daysInState,
      render: (r) => (
        <span
          className={cn(
            "tabular-nums text-sm",
            r.daysInState >= 1 && "text-red-600 font-medium",
          )}
        >
          {r.daysInState}d
        </span>
      ),
    },
    {
      key: "slaDeltaHours",
      label: "Lead vs SLA",
      align: "right",
      sortable: true,
      sortValue: (r) => r.slaDeltaHours,
      render: (r) => {
        const sign = r.slaDeltaHours > 0 ? "+" : "";
        const color =
          r.slaStatus === "green"
            ? "text-emerald-600"
            : r.slaStatus === "amber"
              ? "text-amber-600"
              : "text-red-600";
        return (
          <span className={cn("tabular-nums text-sm", color)}>
            {sign}
            {formatHours(r.slaDeltaHours)}
          </span>
        );
      },
    },
    {
      key: "slaStatus",
      label: "Status",
      align: "center",
      width: 70,
      render: (r) => (
        <div className="flex justify-center">
          <StatusDot status={r.slaStatus} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops" },
          { label: "Hành trình đơn" },
        ]}
        title="Hành trình đơn hàng"
        updatedAt={updated}
        showDefaultActions={false}
      />

      <FilterBar
        show={{
          region: true,
          province: false,
          service: true,
          granularity: true,
        }}
      />

      {/* KPI strip — 6 cards */}
      <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCardFrom kpi={kpis.totalOrders} size="sm" />
        <KpiCardFrom kpi={kpis.otd} size="sm" />
        <KpiCardFrom kpi={kpis.avgLeadTime} size="sm" />
        <KpiCardFrom kpi={kpis.firstAttempt} size="sm" />
        <KpiCardFrom kpi={kpis.returnRate} size="sm" />
        <KpiCardFrom kpi={kpis.lostRate} size="sm" />
      </section>

      {/* Section 1 — Funnel */}
      <Card
        title="Funnel trạng thái đơn"
        subtitle="Tỷ lệ đơn pass qua mỗi state từ ORDER_CREATED đến DELIVERED, kèm 2 branch RETURNED / LOST."
      >
        <Funnel steps={funnel} />
      </Card>

      {/* Section 2 — Lead time per stage (box plot) */}
      <Card
        title="Lead time theo chặng"
        subtitle="Box plot P10–P90 + outliers, đường đỏ chấm = SLA target cho từng chặng."
      >
        <BoxPlot rows={leadTimes} />
      </Card>

      {/* Section 3 — Sankey */}
      <Card
        title="Sankey flow trạng thái"
        subtitle="Độ dày cạnh = số đơn, cạnh đỏ = failure paths (Cancelled / RETURNED / LOST)."
      >
        <Sankey edges={sankey} />
      </Card>

      {/* Section 4 — Cohort heatmap */}
      <Card
        title="Cohort delivery"
        subtitle="Mỗi hàng = ngày tạo đơn (14 ngày gần nhất). Cell = % đơn delivered tới mốc giờ X. Đọc dọc xuống để so sánh tuần này với tuần trước."
      >
        <Heatmap
          data={cohorts}
          valueFormat={(v) => formatPct(v)}
          rowLabel="Cohort"
          colLabel="Giờ kể từ tạo đơn"
        />
      </Card>

      {/* Section 5 — Order tracker table */}
      <Card
        title="Order tracker"
        subtitle="Click 1 đơn để xem timeline đầy đủ + planned vs actual path."
      >
        <DataTable<OrderRow>
          columns={orderColumns}
          data={orders}
          rowKey={(r) => r.orderId}
          searchable
          searchPlaceholder="Tìm MVĐ, shop, trạng thái..."
          pageSize={15}
          onRowClick={(r) => setDrillId(r.orderId)}
        />
      </Card>

      {/* Drill drawer */}
      <OrderTimelineDrawer
        timeline={drillTimeline}
        onClose={() => setDrillId(null)}
      />
    </div>
  );
}
