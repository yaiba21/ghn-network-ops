"use client";

import { useFilter } from "@/components/filter/FilterContext";
import {
  dataUpdatedAt,
  getModuleHealth,
  getOverallAlerts,
  getOverviewBigKpis,
  getOverviewGauges,
  getOverviewTrends,
} from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { MetricChart } from "@/components/ui/MetricChart";
import { BigKpiCard } from "@/components/overview/BigKpiCard";
import { HealthCard } from "@/components/overview/HealthCard";
import { AlertFeed } from "@/components/overview/AlertFeed";
import { Gauge } from "@/components/overview/Gauge";
import {
  formatCompactInt,
  formatPct,
  formatVND,
  shortDate,
} from "@/lib/utils";
import type { SeriesPoint } from "@/lib/types";

export default function OverviewPage() {
  const { filter } = useFilter();

  const big = getOverviewBigKpis(filter);
  const health = getModuleHealth(filter);
  const trends = getOverviewTrends(filter);
  const alerts = getOverallAlerts(filter);
  const gauges = getOverviewGauges(filter);
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops" },
          { label: "Tổng quan" },
        ]}
        title="Tổng quan vận hành"
        updatedAt={updated}
        showDefaultActions={false}
      />

      <FilterBar
        show={{
          region: true,
          province: false,
          service: true,
          granularity: false,
        }}
      />

      {/* Section 1 — North Star (4 big KPI cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <BigKpiCard kpi={big.otd} hint="% đơn giao đúng SLA E2E" />
        <BigKpiCard kpi={big.costPerParcel} hint="Tổng chi phí trên mỗi đơn" />
        <BigKpiCard kpi={big.volume} hint="So với forecast hôm nay" />
        <BigKpiCard kpi={big.lostRate} hint="Cảnh báo khi vượt 0,3%" />
      </section>

      {/* Section 2 — Module health strip (8 small cards) */}
      <section>
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-2">
          Sức khoẻ module
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-4 gap-2.5">
          {health.map((item) => (
            <HealthCard key={item.key} item={item} />
          ))}
        </div>
      </section>

      {/* Section 3 — Trend panel (4 charts 2×2) */}
      <section>
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-2">
          Xu hướng 30 ngày
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          <TrendCard
            title="OTD %"
            subtitle="Tỷ lệ giao đúng SLA E2E theo ngày"
            data={trends.otd}
            valueColor="#10B981"
            targetColor="#DC2626"
            formatY={(v) => formatPct(Number(v))}
            formatTooltip={(v) => formatPct(v)}
          />
          <TrendCard
            title="Cost per parcel (VND)"
            subtitle="Tổng chi phí trên mỗi đơn"
            data={trends.costPerParcel}
            valueColor="#1F2937"
            targetColor="#DC2626"
            formatY={(v) => formatCompactInt(Number(v))}
            formatTooltip={(v) => formatVND(v)}
          />
          <TrendCard
            title="Volume (đơn)"
            subtitle="Actual vs forecast theo ngày"
            data={trends.volume}
            valueColor="#F97316"
            targetColor="#9CA3AF"
            forecastMode
            formatY={(v) => formatCompactInt(Number(v))}
            formatTooltip={(v) => formatCompactInt(v) + " đơn"}
          />
          <TrendCard
            title="Tỷ lệ hoàn %"
            subtitle="Return rate theo ngày"
            data={trends.returnRate}
            valueColor="#F59E0B"
            targetColor="#DC2626"
            formatY={(v) => formatPct(Number(v))}
            formatTooltip={(v) => formatPct(v)}
          />
        </div>
      </section>

      {/* Section 4 — Alert feed */}
      <section>
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-2">
          Cảnh báo bất thường
        </div>
        <AlertFeed alerts={alerts} />
      </section>

      {/* Section 5 — Today's pulse gauges */}
      <section>
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-2">
          Pulse hôm nay
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {gauges.map((g) => (
            <Gauge key={g.key} gauge={g} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ---- Inline trend card -----------------------------------------------------

function TrendCard({
  title,
  subtitle,
  data,
  valueColor,
  targetColor,
  forecastMode,
  formatY,
  formatTooltip,
}: {
  title: string;
  subtitle: string;
  data: SeriesPoint[];
  valueColor: string;
  targetColor: string;
  forecastMode?: boolean;
  formatY: (v: number) => string;
  formatTooltip: (v: number) => string;
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-4">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text)]">
            {title}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">{subtitle}</div>
        </div>
      </div>
      <MetricChart<SeriesPoint>
        type="line"
        data={data}
        xKey="date"
        height={180}
        xTickFormatter={(v) => shortDate(String(v))}
        yTickFormatter={(v) => formatY(v)}
        tooltipValueFormatter={(v) => formatTooltip(v)}
        series={[
          { key: "actual", label: "Thực tế", color: valueColor, type: "line" },
          forecastMode
            ? {
                key: "forecast",
                label: "Forecast",
                color: targetColor,
                type: "line",
              }
            : {
                key: "target",
                label: "Mục tiêu",
                color: targetColor,
                type: "line",
              },
        ]}
      />
    </div>
  );
}
