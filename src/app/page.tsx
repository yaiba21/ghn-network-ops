"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getChannelComparison,
  getDailyTrend,
  getLoaiHangComparison,
  getOverviewAlerts,
  getOverviewModuleHealth,
  getOverviewNorthStar,
  getOverviewPulseGauges,
  getOverviewRegionHeatmap,
  getSlaComparison,
  getStageOverview,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { ModuleHealthCard } from "@/components/ui/ModuleHealthCard";
import { PulseGauge } from "@/components/ui/PulseGauge";
import { Heatmap } from "@/components/ui/Heatmap";
import { MetricChart } from "@/components/ui/MetricChart";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  cn,
  formatCompactInt,
  formatHours,
  formatPct,
  formatVND,
  shortDate,
} from "@/lib/utils";

export default function OverallPage() {
  const { filter } = useFilter();

  const northStar = useMemo(() => getOverviewNorthStar(filter), [filter]);
  const modules = useMemo(() => getOverviewModuleHealth(filter), [filter]);
  const heatmap = useMemo(() => getOverviewRegionHeatmap(filter), [filter]);
  const alerts = useMemo(() => getOverviewAlerts(filter), [filter]);
  const gauges = useMemo(() => getOverviewPulseGauges(filter), [filter]);
  const channels = useMemo(() => getChannelComparison(filter), [filter]);
  const loaiHangs = useMemo(() => getLoaiHangComparison(filter), [filter]);
  const slas = useMemo(() => getSlaComparison(filter), [filter]);
  const trend = useMemo(() => getDailyTrend(filter, 14), [filter]);
  const stages = useMemo(() => getStageOverview(filter), [filter]);
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops" }, { label: "Tổng Quan" }]}
        title="Tổng Quan — Sức khoẻ vận hành mạng"
        subtitle="Các chỉ số chiến lược của GHN."
        updatedAt={updated}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          channel: true,
          loaiHoatDong: true,
          loaiHang: true,
          loaiDichVu: true,
          loaiTuyen: true,
          slaDays: true,
          granularity: true,
        }}
      />

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* === 6 thẻ North Star === */}
      <section>
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
          North Star — 6 chỉ số chiến lược toàn mạng
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCardFrom kpi={northStar.ontimeNetwork} size="sm" />
          <KpiCardFrom kpi={northStar.costPerKg} size="sm" />
          <KpiCardFrom kpi={northStar.hangVeBc4Ca} size="sm" />
          <KpiCardFrom kpi={northStar.fdRate} size="sm" />
          <KpiCardFrom kpi={northStar.ontimeVanTai} size="sm" />
          <KpiCardFrom kpi={northStar.doiKhoOverall} size="sm" />
        </div>
      </section>

      {/* === Module health + Pulse gauges === */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Sức khoẻ theo mô-đun (click drill xuống trang chi tiết)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Last Mile xếp cuối theo flow đơn */}
            <ModuleHealthCard module={modules[0]} href="#chang-van-hanh" />
            <ModuleHealthCard module={modules[1]} href="/network" />
            <ModuleHealthCard module={modules[3]} href="/routing" />
            <ModuleHealthCard module={modules[4]} href="/transport" />
            <ModuleHealthCard module={modules[2]} href="#chang-van-hanh" />
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Pulse realtime ({gauges.length} chỉ số)
          </div>
          <Card>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {gauges.map((g) => (
                <PulseGauge key={g.label} data={g} />
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* === Trend 14 ngày === */}
      <Card
        title="Trend 14 ngày — sản lượng + Ontime + %TC + Đổi kho"
        subtitle="Xu hướng theo ngày. Spike volume thường kèm drop Ontime — kiểm tra ca/lane cụ thể."
      >
        <MetricChart
          type="combo"
          data={trend}
          xKey="date"
          height={260}
          series={[
            {
              key: "orders",
              label: "Sản lượng (đơn)",
              type: "bar",
              color: "#F97316",
              yAxisId: "left",
            },
            {
              key: "ontime",
              label: "Ontime Network %",
              type: "line",
              color: "#10b981",
              yAxisId: "right",
            },
            {
              key: "pctTC",
              label: "%TC",
              type: "line",
              color: "#1F2937",
              yAxisId: "right",
            },
            {
              key: "doiKho",
              label: "% Đổi kho",
              type: "line",
              color: "#DC2626",
              yAxisId: "right",
            },
          ]}
          xTickFormatter={(d) => shortDate(String(d))}
          yTickFormatter={(v) => formatCompactInt(v)}
          rightYTickFormatter={(v) => `${v.toFixed(1)}%`}
          legend
          tooltipValueFormatter={(v, name) =>
            String(name).includes("%") || String(name).includes("Ontime")
              ? `${v.toFixed(2)}%`
              : formatCompactInt(v)
          }
        />
      </Card>

      {/* === 5 chặng vận hành (gom từ trang Các Chặng cũ) === */}
      <Card
        title="Metrics theo 5 chặng vận hành"
        subtitle="First-mile → KTC đi → Last-mile → KTC về → Trả. Lượng đơn · LT TB · % thành công · # NV active mỗi chặng."
      >
        <div id="chang-van-hanh" className="scroll-mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {stages.map((s) => (
            <div
              key={s.stageKey}
              className="border border-[var(--color-border)] rounded-md overflow-hidden bg-white"
            >
              <div
                className={cn(
                  "h-1",
                  s.stageKey === "fm"
                    ? "bg-emerald-500"
                    : s.stageKey === "ktc-fw"
                      ? "bg-violet-500"
                      : s.stageKey === "lm"
                        ? "bg-amber-500"
                        : s.stageKey === "ktc-ret"
                          ? "bg-sky-500"
                          : "bg-rose-500",
                )}
              />
              <div className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--color-text)] truncate">
                    {s.stageLabel}
                  </span>
                  <StatusDot status={s.status} />
                </div>
                <div className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                  {formatCompactInt(s.throughput)}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)]">
                  lượng đơn / kỳ filter
                </div>
                <div className="mt-2 pt-2 border-t border-[var(--color-border-soft)] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                      LT TB
                    </div>
                    <div className="tabular-nums font-medium">
                      {formatHours(s.ltMedianH)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                      Success
                    </div>
                    <div className="tabular-nums font-medium">
                      {formatPct(s.successRate, 1)}
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
                  ~{formatCompactInt(s.activeNV)} nhân viên active
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* === Heatmap 14 vùng × 4 cột === */}
      <Card
        title={`So sánh ${heatmap.rows.length} vùng × ${heatmap.cols.length} chỉ số`}
        subtitle="Heatmap màu theo ngưỡng đèn giao thông (xanh / vàng / đỏ). Click ô để drill."
        actions={
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            [MẪU per-vùng — chờ data thật]
          </div>
        }
      >
        <Heatmap
          data={heatmap}
          rowLabel="Vùng"
          colLabel="Chỉ số"
          valueFormat={(v: number) => {
            if (v > 1000) return formatVND(v);
            return formatPct(v, 1);
          }}
        />
      </Card>

      {/* === So sánh theo channel + loại hàng === */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card
          title="So sánh theo nguồn đơn (Channel)"
          subtitle="6 channel: TTS / SPE / SME / KA / B2B / CB. Theo dõi channel nào đang underperform."
        >
          <DataTable
            columns={channelColumns}
            data={channels}
            rowKey={(r) => r.channel}
          />
        </Card>

        <Card
          title="So sánh theo loại hàng"
          subtitle="Tiêu chuẩn / Cồng kềnh / Nặng — chi phí + thời gian khác nhau đáng kể."
        >
          <DataTable
            columns={loaiHangColumns}
            data={loaiHangs}
            rowKey={(r) => r.key}
          />
        </Card>
      </section>

      {/* === So sánh theo SLA === */}
      <Card
        title="So sánh theo SLA days (1 / 2 / 3 ngày)"
        subtitle="SLA 1 ngày khắt khe nhất — NDD. Đo lead time TB vs ontime per SLA bucket."
      >
        <DataTable columns={slaColumns} data={slas} rowKey={(r) => String(r.slaDays)} />
      </Card>
    </div>
  );
}

// =============================================================================
// Columns
// =============================================================================

const channelColumns: Column<
  ReturnType<typeof getChannelComparison>[number]
>[] = [
  { key: "channelLabel", label: "Channel", render: (r) => <span className="font-medium">{r.channelLabel}</span> },
  {
    key: "orders",
    label: "Sản lượng",
    align: "right",
    sortable: true,
    sortValue: (r) => r.orders,
    render: (r) => formatCompactInt(r.orders),
  },
  {
    key: "share",
    label: "Share",
    align: "right",
    sortable: true,
    sortValue: (r) => r.share,
    render: (r) => formatPct(r.share, 1),
  },
  {
    key: "ontime",
    label: "Ontime",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ontime,
    render: (r) => (
      <span
        className={
          r.ontime >= 90 ? "text-emerald-600" : r.ontime >= 88 ? "text-amber-600" : "text-red-600"
        }
      >
        {formatPct(r.ontime, 1)}
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
    key: "fd",
    label: "FD",
    align: "right",
    sortable: true,
    sortValue: (r) => r.fd,
    render: (r) => (
      <span className={r.fd <= 5 ? "text-emerald-600" : r.fd <= 10 ? "text-amber-600" : "text-red-600"}>
        {formatPct(r.fd, 1)}
      </span>
    ),
  },
  {
    key: "doiKho",
    label: "% Đổi kho",
    align: "right",
    sortable: true,
    sortValue: (r) => r.doiKho,
    render: (r) => (
      <span className={r.doiKho <= 1.5 ? "text-emerald-600" : r.doiKho <= 2.3 ? "text-amber-600" : "text-red-600"}>
        {formatPct(r.doiKho, 1)}
      </span>
    ),
  },
];

const loaiHangColumns: Column<
  ReturnType<typeof getLoaiHangComparison>[number]
>[] = [
  { key: "label", label: "Loại hàng", render: (r) => <span className="font-medium">{r.label}</span> },
  {
    key: "orders",
    label: "Sản lượng",
    align: "right",
    sortable: true,
    sortValue: (r) => r.orders,
    render: (r) => formatCompactInt(r.orders),
  },
  {
    key: "share",
    label: "Share",
    align: "right",
    sortable: true,
    sortValue: (r) => r.share,
    render: (r) => formatPct(r.share, 1),
  },
  {
    key: "ontime",
    label: "Ontime",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ontime,
    render: (r) => formatPct(r.ontime, 1),
  },
  {
    key: "costPerKg",
    label: "Cost/kg ước lượng",
    align: "right",
    sortable: true,
    sortValue: (r) => r.costPerKg,
    render: (r) => formatVND(r.costPerKg),
  },
  {
    key: "doiKho",
    label: "% Đổi kho",
    align: "right",
    sortable: true,
    sortValue: (r) => r.doiKho,
    render: (r) => formatPct(r.doiKho, 1),
  },
];

const slaColumns: Column<ReturnType<typeof getSlaComparison>[number]>[] = [
  {
    key: "slaDays",
    label: "SLA",
    render: (r) => <span className="font-medium">{r.slaDays} ngày</span>,
  },
  {
    key: "orders",
    label: "Sản lượng",
    align: "right",
    sortable: true,
    sortValue: (r) => r.orders,
    render: (r) => formatCompactInt(r.orders),
  },
  {
    key: "share",
    label: "Share",
    align: "right",
    sortable: true,
    sortValue: (r) => r.share,
    render: (r) => formatPct(r.share, 1),
  },
  {
    key: "ontime",
    label: "Ontime",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ontime,
    render: (r) => (
      <span className={r.ontime >= 90 ? "text-emerald-600" : r.ontime >= 85 ? "text-amber-600" : "text-red-600"}>
        {formatPct(r.ontime, 1)}
      </span>
    ),
  },
  {
    key: "ltAvgH",
    label: "Lead time TB",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ltAvgH,
    render: (r) => formatHours(r.ltAvgH),
  },
];
