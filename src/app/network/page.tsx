"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useFilter } from "@/components/filter/FilterContext";
import { useUploadedRows } from "@/components/upload/UploadedDataContext";
import {
  dataUpdatedAt,
  getCutOffHeatmap,
  getForecastMapeTrend,
  getKtcOverstayFunnel,
  getKtcStatus,
  getLanePerf,
  getNetworkAlerts,
  getNetworkKpis,
  getVolumeForecast,
} from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { MetricChart } from "@/components/ui/MetricChart";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Heatmap } from "@/components/ui/Heatmap";
import { Funnel } from "@/components/ui/Funnel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusDot } from "@/components/ui/StatusDot";
import { Sparkline } from "@/components/ui/Sparkline";
import { StageHeader } from "@/components/journey/StageHeader";
import {
  cn,
  formatCompactInt,
  formatHours,
  formatInt,
  formatPct,
  formatVND,
  shortDate,
  formatVNDate,
} from "@/lib/utils";
import type {
  KpiValue,
  KtcStatusRow,
  LanePerfRow,
  SeriesPoint,
  TimePoint,
} from "@/lib/types";

const REGION_LABEL: Record<string, string> = {
  bac: "Bắc",
  trung: "Trung",
  nam: "Nam",
};

export default function NetworkPage() {
  const { filter } = useFilter();

  const k = getNetworkKpis(filter);
  const alerts = getNetworkAlerts(filter);
  const forecast = getVolumeForecast(filter, 30);
  const mape = getForecastMapeTrend(filter, 12);
  const heatmap = getCutOffHeatmap(filter);
  const funnel = getKtcOverstayFunnel(filter);

  // Uploaded data overrides — fallback to mock when not uploaded.
  const uploadedLanes = useUploadedRows<LanePerfRow>("lane-perf");
  const lanes = uploadedLanes ?? getLanePerf(filter);

  const uploadedKtcs = useUploadedRows<KtcStatusRow>("ktc-status");
  const ktcs = uploadedKtcs ?? getKtcStatus(filter);

  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Mạng lưới (NDS + KTC)" },
        ]}
        title="Mạng lưới linehaul — drill down theo 3 chặng"
        subtitle="Đơn đi qua middle-mile theo 3 chặng linehaul: BC nhận → KTC → KTC ↔ KTC → KTC → BC giao."
        updatedAt={updated}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          ktc: true,
          lane: true,
          vehicle: true,
          carrier: true,
          service: true,
          granularity: true,
        }}
      />

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* North Star (5 cards) — toàn mạng */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiCardFrom kpi={k.fillRate} />
        <KpiCardFrom kpi={k.onTimeCutOff} />
        <KpiCardFrom kpi={k.costPerOrder} />
        <KpiCardFrom kpi={k.sortAccuracy} />
        <OnTimeDualCard departure={k.onTimeDeparture} arrival={k.onTimeArrival} />
      </section>

      {/* === Chặng 1: BC nhận → KTC === */}
      <StageHeader
        step="1"
        label="Chặng 1: BC nhận → KTC (first leg)"
        description="Đơn rời BC nhận, đi xe tải lên KTC gần nhất. Đo on-time, fill rate và lead time của chặng này."
        tone="green"
        anchorKey="first-leg"
      />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCardFrom kpi={k.firstLegOnTime} size="sm" />
        <KpiCardFrom kpi={k.firstLegFill} size="sm" />
        <KpiCardFrom kpi={k.firstLegLeadTime} size="sm" hint="Trung bình toàn mạng" />
      </section>

      {/* === Chặng 2: KTC ↔ KTC (inter-KTC linehaul) === */}
      <StageHeader
        step="2"
        label="Chặng 2: KTC ↔ KTC (inter-KTC linehaul)"
        description="Nhập KTC → kiểm seal → phân loại lớn/nhỏ → đóng kiện điểm đến → xuất KTC tiếp hoặc BC giao."
        tone="violet"
        anchorKey="inter-ktc"
      />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={k.tatHub} size="sm" hint="Turn-around time tại KTC" />
        <KpiCardFrom kpi={k.forecastMape} size="sm" hint="Mean Absolute % Error" />
        <KpiCardFrom kpi={k.missortRate} size="sm" />
        <KpiCardFrom kpi={k.overstayRate} size="sm" />
      </section>

      <CutOffHeatmapCard data={heatmap} />

      <section className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-2">
          <OverstayFunnelCard funnel={funnel} />
        </div>
        <div className="xl:col-span-3">
          <LanePerfTable rows={lanes} />
        </div>
      </section>

      {/* === Chặng 3: KTC → BC giao === */}
      <StageHeader
        step="3"
        label="Chặng 3: KTC → BC giao (last linehaul leg)"
        description="Đơn rời KTC cuối cùng, về BC giao để giao last-mile. Hoàn tất middle-mile tại đây."
        tone="amber"
        anchorKey="last-leg"
        linkHref="/journey#stage-bcGiao"
        linkLabel="Xem last-mile"
      />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCardFrom kpi={k.lastLegOnTime} size="sm" />
        <KpiCardFrom kpi={k.lastLegFill} size="sm" />
        <KpiCardFrom kpi={k.lastLegLeadTime} size="sm" hint="Trung bình toàn mạng" />
      </section>

      {/* === Cross-cutting: forecast + cost === */}
      <StageHeader
        step="X"
        label="Cross-cutting: Forecast & chi phí"
        description="NDS dự báo volume + tối ưu chi phí. Drift cao = lane planning cần điều chỉnh."
        tone="slate"
        anchorKey="forecast"
      />
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <ForecastVsActualCard data={forecast} />
        </div>
        <MapeTrendCard data={mape} />
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCardFrom kpi={k.costPerKg} size="sm" />
        <KpiCardFrom kpi={k.emptyBackhaul} size="sm" hint="Chuyến rỗng chiều về" />
        <KpiCardFrom kpi={k.costPerOrder} size="sm" />
      </section>

      {/* === Realtime KTC === */}
      <StageHeader
        step="Live"
        label="Trạng thái KTC realtime"
        description={`Snapshot ${ktcs.length} KTC toàn mạng. Filter để xem theo vùng.`}
        tone="rose"
        anchorKey="realtime"
      />
      <KtcStatusTable rows={ktcs} />
    </div>
  );
}

// ---------- Sub-components ----------------------------------------------

function OnTimeDualCard({
  departure,
  arrival,
}: {
  departure: KpiValue;
  arrival: KpiValue;
}) {
  const worstStatus =
    [departure.status, arrival.status].includes("red")
      ? "red"
      : [departure.status, arrival.status].includes("amber")
        ? "amber"
        : "green";
  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] truncate">
          On-time departure / arrival
        </div>
        <StatusDot status={worstStatus} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <DualMini label="Xuất kho" kpi={departure} />
        <DualMini label="Đến nơi" kpi={arrival} />
      </div>
    </div>
  );
}

function DualMini({ label, kpi }: { label: string; kpi: KpiValue }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
        {formatPct(kpi.value)}
      </div>
      <div className="mt-1.5">
        <Sparkline data={kpi.sparkline} status={kpi.status} width={120} height={22} />
      </div>
    </div>
  );
}

function ForecastVsActualCard({ data }: { data: SeriesPoint[] }) {
  const totalActual = data.reduce((a, b) => a + b.actual, 0);
  const totalForecast = data.reduce((a, b) => a + (b.forecast ?? 0), 0);
  const drift =
    totalForecast === 0 ? 0 : ((totalActual - totalForecast) / totalForecast) * 100;
  return (
    <Card
      title="Volume forecast vs thực tế (30 ngày)"
      subtitle="NDS forecast vs volume thực tế qua các KTC. Drift > 10% = cần điều chỉnh lane planning."
      actions={
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Drift 30 ngày
          </div>
          <div
            className={cn(
              "text-lg font-semibold tabular-nums",
              Math.abs(drift) <= 5
                ? "text-emerald-600"
                : Math.abs(drift) <= 10
                  ? "text-amber-600"
                  : "text-red-600",
            )}
          >
            {drift >= 0 ? "+" : ""}
            {drift.toFixed(1)}%
          </div>
        </div>
      }
    >
      <MetricChart<SeriesPoint>
        type="combo"
        data={data}
        xKey="date"
        height={260}
        series={[
          {
            key: "actual",
            label: "Thực tế",
            color: "#F97316",
            type: "bar",
          },
          {
            key: "forecast",
            label: "Forecast",
            color: "#1F2937",
            type: "line",
          },
        ]}
        legend
        xTickFormatter={(d) => shortDate(String(d))}
        yTickFormatter={(v) => formatCompactInt(v)}
        tooltipValueFormatter={(v) => `${formatInt(v)} đơn`}
      />
    </Card>
  );
}

function MapeTrendCard({ data }: { data: TimePoint[] }) {
  const latest = data[data.length - 1]?.value ?? 0;
  return (
    <Card
      title="Forecast accuracy (MAPE) theo tuần"
      subtitle="Mean Absolute % Error giữa forecast và thực tế. Mục tiêu < 10%."
      actions={
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Tuần này
          </div>
          <div
            className={cn(
              "text-lg font-semibold tabular-nums",
              latest <= 10
                ? "text-emerald-600"
                : latest <= 15
                  ? "text-amber-600"
                  : "text-red-600",
            )}
          >
            {formatPct(latest)}
          </div>
        </div>
      }
    >
      <MetricChart<TimePoint>
        type="line"
        data={data}
        xKey="date"
        height={260}
        series={[{ key: "value", label: "MAPE", color: "#DC2626" }]}
        xTickFormatter={(d) => shortDate(String(d))}
        yTickFormatter={(v) => `${v.toFixed(1)}%`}
        tooltipValueFormatter={(v) => formatPct(v)}
      />
    </Card>
  );
}

function CutOffHeatmapCard({
  data,
}: {
  data: ReturnType<typeof getCutOffHeatmap>;
}) {
  return (
    <Card
      title="Cut-off compliance heatmap"
      subtitle="% manifest xuất đúng cut-off, mỗi KTC × khung giờ. Đỏ = COT < 90% — cần can thiệp ngay."
    >
      <Heatmap
        data={data}
        valueFormat={(v) => formatPct(v)}
        rowLabel="KTC"
        colLabel="Khung giờ"
      />
    </Card>
  );
}

function OverstayFunnelCard({
  funnel,
}: {
  funnel: ReturnType<typeof getKtcOverstayFunnel>;
}) {
  return (
    <Card
      title="KTC overstay funnel (hôm nay)"
      subtitle="Nhập KTC → sort xong → đóng kiện → xuất hàng. Drop-off lớn = nghẽn."
    >
      <Funnel steps={funnel} />
    </Card>
  );
}

function LanePerfTable({ rows }: { rows: LanePerfRow[] }) {
  const columns: Column<LanePerfRow>[] = [
    {
      key: "laneName",
      label: "Lane",
      sortable: true,
      render: (r) => (
        <span className="text-[var(--color-text)] truncate">{r.laneName}</span>
      ),
    },
    {
      key: "volume",
      label: "Volume",
      align: "right",
      sortable: true,
      sortValue: (r) => r.volume,
      render: (r) => formatCompactInt(r.volume),
    },
    {
      key: "fillRate",
      label: "Fill rate",
      align: "right",
      sortable: true,
      sortValue: (r) => r.fillRate,
      render: (r) => (
        <span
          className={
            r.fillRate >= 80
              ? "text-emerald-600"
              : r.fillRate >= 70
                ? "text-amber-600"
                : "text-red-600"
          }
        >
          {formatPct(r.fillRate)}
        </span>
      ),
    },
    {
      key: "costPerKg",
      label: "Cost/kg",
      align: "right",
      sortable: true,
      sortValue: (r) => r.costPerKg,
      render: (r) => formatVND(r.costPerKg),
    },
    {
      key: "onTimeDeparture",
      label: "OT departure",
      align: "right",
      sortable: true,
      sortValue: (r) => r.onTimeDeparture,
      render: (r) => formatPct(r.onTimeDeparture),
    },
    {
      key: "onTimeArrival",
      label: "OT arrival",
      align: "right",
      sortable: true,
      sortValue: (r) => r.onTimeArrival,
      render: (r) => formatPct(r.onTimeArrival),
    },
    {
      key: "missortRate",
      label: "% missort",
      align: "right",
      sortable: true,
      sortValue: (r) => r.missortRate,
      render: (r) => formatPct(r.missortRate),
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
  return (
    <Card
      title="Lane performance — Top 20 theo volume"
      subtitle="Hiệu suất từng chặng KTC → KTC. Sort theo cột để tìm lane bottleneck."
    >
      <DataTable<LanePerfRow>
        columns={columns}
        data={rows}
        rowKey={(r) => r.laneCode}
        searchable
        searchPlaceholder="Tìm lane..."
        pageSize={10}
      />
    </Card>
  );
}

function KtcStatusTable({ rows }: { rows: KtcStatusRow[] }) {
  const columns: Column<KtcStatusRow>[] = [
    {
      key: "ktcName",
      label: "KTC",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <StatusDot status={r.status} size={6} />
          <span className="text-[var(--color-text)]">{r.ktcName}</span>
        </div>
      ),
    },
    {
      key: "regionCode",
      label: "Vùng",
      sortable: true,
      render: (r) => (
        <span className="text-xs text-[var(--color-text-muted)]">
          Miền {REGION_LABEL[r.regionCode]}
        </span>
      ),
    },
    {
      key: "processing",
      label: "Đang xử lý",
      align: "right",
      sortable: true,
      sortValue: (r) => r.processing,
      render: (r) => formatCompactInt(r.processing),
    },
    {
      key: "pendingSort",
      label: "Chờ sort",
      align: "right",
      sortable: true,
      sortValue: (r) => r.pendingSort,
      render: (r) => formatCompactInt(r.pendingSort),
    },
    {
      key: "readyDispatch",
      label: "Sẵn sàng xuất",
      align: "right",
      sortable: true,
      sortValue: (r) => r.readyDispatch,
      render: (r) => formatCompactInt(r.readyDispatch),
    },
    {
      key: "tatHours",
      label: "TAT (h)",
      align: "right",
      sortable: true,
      sortValue: (r) => r.tatHours,
      render: (r) => (
        <span
          className={
            r.tatHours <= 4
              ? "text-emerald-600"
              : r.tatHours <= 8
                ? "text-amber-600"
                : "text-red-600"
          }
        >
          {formatHours(r.tatHours)}
        </span>
      ),
    },
    {
      key: "sortAccuracy",
      label: "Sort accuracy",
      align: "right",
      sortable: true,
      sortValue: (r) => r.sortAccuracy,
      render: (r) => formatPct(r.sortAccuracy, 2),
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
  return (
    <Card
      title="Trạng thái KTC realtime"
      subtitle={`Tổng ${rows.length} KTC. Sort theo cột bất kỳ để tìm KTC quá tải.`}
      actions={
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ghn-red)] hover:underline"
        >
          Quay về Tổng quan <ArrowRight className="w-3 h-3" />
        </Link>
      }
      footer={`Dữ liệu cập nhật ${formatVNDate("2026-05-20")}`}
    >
      <DataTable<KtcStatusRow>
        columns={columns}
        data={rows}
        rowKey={(r) => r.ktcCode}
        searchable
        searchPlaceholder="Tìm KTC, vùng..."
        pageSize={10}
      />
    </Card>
  );
}
