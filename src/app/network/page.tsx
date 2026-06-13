"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getKtcScorecard,
  getOverviewNorthStar,
  getRegionScorecard,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MetricBadge } from "@/components/ui/MetricBadge";
import { cn, formatCompactInt, formatHours, formatPct, formatVND } from "@/lib/utils";
import { REGION_LABEL_VI } from "@/lib/types";

export default function NetworkPage() {
  const { filter } = useFilter();

  const northStar = useMemo(() => getOverviewNorthStar(filter), [filter]);
  const regionScorecard = useMemo(() => getRegionScorecard(filter), [filter]);
  const ktcScorecard = useMemo(() => getKtcScorecard(filter), [filter]);
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Mạng Lưới" },
        ]}
        title="Mạng Lưới — KTC + Linehaul"
        subtitle="Sức khoẻ middle-mile: throughput KTC, SLA Network, cost/kg, fill rate xe."
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

      {/* === KPI mạng === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={northStar.ontimeNetwork} size="sm" />
        <KpiCardFrom kpi={northStar.hangVeBc4Ca} size="sm" />
        <KpiCardFrom kpi={northStar.costPerKg} size="sm" />
        <KpiCardFrom kpi={northStar.doiKhoOverall} size="sm" />
      </section>

      {/* === Scorecard 3 vùng === */}
      <Card
        title="Scorecard 3 vùng — Bắc / Trung / Nam"
        subtitle="So sánh nhanh: throughput · ontime network · cost/kg · %TC · % hàng ≥4 ca · đổi kho."
        actions={<MetricBadge kind="sample" label="Số liệu mock seeded" />}
      >
        <DataTable
          columns={regionColumns}
          data={regionScorecard}
          rowKey={(r) => r.regionCode}
        />
      </Card>

      {/* === KTC table === */}
      <Card
        title={`KTC scorecard — ${ktcScorecard.length} KTC active`}
        subtitle="Top KTC theo throughput. Click cột để sort, tìm KTC bottleneck."
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

      {/* === Sub-metrics network (GAP placeholders) === */}
      <Card
        title="Network sub-metrics — chờ chốt công thức"
        subtitle="Các chỉ số NDS+KTC chi tiết — chờ data engineering xác nhận formula."
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            "% xuất kiện ontime BC lấy",
            "Thời gian chờ nhập KTC",
            "Thời gian sorting",
            "Tỷ lệ sai lệch KLKT",
            "TB số lần KTC hàng đi qua",
          ].map((m) => (
            <div key={m} className="border border-[var(--color-border)] rounded-md p-3">
              <div className="text-xs text-[var(--color-text)]">{m}</div>
              <div className="mt-2">
                <MetricBadge kind="gap" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const regionColumns: Column<ReturnType<typeof getRegionScorecard>[number]>[] = [
  {
    key: "regionName",
    label: "Vùng",
    render: (r) => <span className="font-semibold">{r.regionName}</span>,
  },
  {
    key: "totalOrders",
    label: "Throughput",
    align: "right",
    sortable: true,
    sortValue: (r) => r.totalOrders,
    render: (r) => formatCompactInt(r.totalOrders),
  },
  {
    key: "ontimeNetwork",
    label: "Ontime Network",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ontimeNetwork,
    render: (r) => (
      <span
        className={
          r.ontimeNetwork >= 90
            ? "text-emerald-600"
            : r.ontimeNetwork >= 88
              ? "text-amber-600"
              : "text-red-600"
        }
      >
        {formatPct(r.ontimeNetwork, 1)}
      </span>
    ),
  },
  {
    key: "costPerKg",
    label: "Cost/kg",
    align: "right",
    sortable: true,
    sortValue: (r) => r.costPerKg,
    render: (r) => (
      <span
        className={
          r.costPerKg <= 1970
            ? "text-emerald-600"
            : r.costPerKg <= 2057
              ? "text-amber-600"
              : "text-red-600"
        }
      >
        {formatVND(r.costPerKg)}
      </span>
    ),
  },
  {
    key: "pctTC",
    label: "%TC",
    align: "right",
    sortable: true,
    sortValue: (r) => r.pctTC,
    render: (r) => formatPct(r.pctTC, 1),
  },
  {
    key: "hangVeBc4Ca",
    label: "% ≥4 ca",
    align: "right",
    sortable: true,
    sortValue: (r) => r.hangVeBc4Ca,
    render: (r) => formatPct(r.hangVeBc4Ca, 1),
  },
  {
    key: "doiKho",
    label: "% đổi kho",
    align: "right",
    sortable: true,
    sortValue: (r) => r.doiKho,
    render: (r) => formatPct(r.doiKho, 1),
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

const ktcColumns: Column<ReturnType<typeof getKtcScorecard>[number]>[] = [
  {
    key: "ktcCode",
    label: "Mã KTC",
    sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.ktcCode}</span>,
  },
  {
    key: "region",
    label: "Vùng",
    sortable: true,
    render: (r) => REGION_LABEL_VI[r.region] ?? r.region,
  },
  {
    key: "ordersIn",
    label: "Đơn vào",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ordersIn,
    render: (r) => formatCompactInt(r.ordersIn),
  },
  {
    key: "ordersOut",
    label: "Đơn ra",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ordersOut,
    render: (r) => formatCompactInt(r.ordersOut),
  },
  {
    key: "ltAvgH",
    label: "LT TB",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ltAvgH,
    render: (r) => formatHours(r.ltAvgH),
  },
  {
    key: "fillRateKg",
    label: "Fill rate kg",
    align: "right",
    sortable: true,
    sortValue: (r) => r.fillRateKg,
    render: (r) => (
      <span
        className={cn(
          r.fillRateKg >= 75
            ? "text-emerald-600"
            : r.fillRateKg >= 60
              ? "text-amber-600"
              : "text-red-600",
        )}
      >
        {formatPct(r.fillRateKg, 1)}
      </span>
    ),
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
