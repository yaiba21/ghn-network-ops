"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getJourneyFinalStatusMix,
  getJourneyPercentiles,
  getJourneyStatusGroups,
  getJourneyTopOrders,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  cn,
  formatCompactInt,
  formatHours,
  formatInt,
  formatPct,
  formatVNDate,
} from "@/lib/utils";
import {
  CHANNEL_LABEL_VI,
  FINAL_STATUS_LABEL_VI,
  LOAI_HANG_LABEL_VI,
  type ChannelCode,
  type LoaiHang,
} from "@/lib/types";

export default function JourneyPage() {
  const { filter } = useFilter();

  const groups = useMemo(() => getJourneyStatusGroups(filter), [filter]);
  const percentiles = useMemo(() => getJourneyPercentiles(filter), [filter]);
  const finalMix = useMemo(() => getJourneyFinalStatusMix(filter), [filter]);
  const topOrders = useMemo(() => getJourneyTopOrders(filter, 30), [filter]);
  const updated = dataUpdatedAt();

  const totalOrders = finalMix.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Hành Trình Đơn Hàng" },
        ]}
        title="Hành Trình Đơn Hàng — theo trạng thái"
        subtitle="6 nhóm trạng thái từ tạo đơn đến giao thành công (hoặc hoàn / huỷ / thất lạc). Lead time percentile heatmap + drill xuống MVĐ."
        updatedAt={updated}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          channel: true,
          loaiHang: true,
          loaiTuyen: true,
          slaDays: true,
        }}
      />

      {/* === Stage flow gom funnel + 6 nhóm === */}
      <Card
        title={`Hành trình đơn — ${formatCompactInt(totalOrders)} đơn qua 6 chặng`}
        subtitle="Mỗi chặng: số lượng · % pass · LT TB · # fail. Đơn rớt khỏi flow đi xuống ô outcome bên dưới."
      >
        <StageFlowVisualization groups={groups} totalOrders={totalOrders} />
      </Card>

      {/* === 8 outcome card (6 terminal + cancelled + in_progress) === */}
      <Card
        title="8 outcome cuối — 6 terminal + 2 trạng thái khác"
        subtitle="Phân bổ kết quả cuối cùng của đơn. Đỏ = exception/lost/failed → cần investigate."
      >
        <FinalStatusGrid mix={finalMix} />
      </Card>

      {/* === Percentile heatmap === */}
      <Card
        title="Lead Time Percentile — Heatmap"
        subtitle="P50 (50% đơn dưới giá trị này) · P90 · P99. Cell màu đỏ = vượt ngưỡng cảnh báo."
      >
        <PercentileHeatmap rows={percentiles} />
      </Card>

      {/* === Drill MVĐ === */}
      <OrdersDrillTable rows={topOrders} />
    </div>
  );
}

// =============================================================================
// Stage flow visualization — combined funnel + 6 group table
// =============================================================================

const STAGE_TONE: Record<string, string> = {
  tao: "bg-slate-100",
  lay: "bg-emerald-50",
  "ktc-di": "bg-violet-50",
  giao: "bg-amber-50",
  "ktc-ve": "bg-sky-50",
  tra: "bg-rose-50",
};

const STAGE_ACCENT: Record<string, string> = {
  tao: "bg-slate-500",
  lay: "bg-emerald-500",
  "ktc-di": "bg-violet-500",
  giao: "bg-amber-500",
  "ktc-ve": "bg-sky-500",
  tra: "bg-rose-500",
};

function StageFlowVisualization({
  groups,
  totalOrders,
}: {
  groups: ReturnType<typeof getJourneyStatusGroups>;
  totalOrders: number;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex items-stretch gap-2 min-w-[900px]">
        {groups.map((g, idx) => {
          const widthPct = totalOrders > 0 ? (g.total / totalOrders) * 100 : 0;
          const dropPct = idx > 0 ? 100 - g.successRate : 0;
          return (
            <div
              key={g.groupKey}
              className={cn(
                "flex-1 border rounded-md overflow-hidden",
                STAGE_TONE[g.groupKey] ?? "bg-slate-50",
              )}
            >
              <div className={cn("h-1", STAGE_ACCENT[g.groupKey] ?? "bg-slate-500")} />
              <div className="p-3 space-y-2">
                <div className="text-xs font-semibold text-[var(--color-text)]">
                  {g.groupLabel}
                </div>
                {/* Volume bar */}
                <div>
                  <div className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                    {formatCompactInt(g.total)}
                  </div>
                  <div className="h-1.5 bg-[var(--color-hover)] rounded-full overflow-hidden mt-1">
                    <div
                      className={cn(
                        "h-full",
                        STAGE_ACCENT[g.groupKey] ?? "bg-slate-500",
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                  <div>
                    <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                      % Pass
                    </div>
                    <div
                      className={cn(
                        "tabular-nums font-medium",
                        g.successRate >= 92
                          ? "text-emerald-700"
                          : g.successRate >= 85
                            ? "text-amber-700"
                            : "text-red-700",
                      )}
                    >
                      {formatPct(g.successRate, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                      LT TB
                    </div>
                    <div className="tabular-nums font-medium">
                      {g.avgLeadtimeH > 0 ? formatHours(g.avgLeadtimeH) : "—"}
                    </div>
                  </div>
                  {idx > 0 && (
                    <div className="col-span-2">
                      <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                        Drop-off
                      </div>
                      <div
                        className={cn(
                          "tabular-nums",
                          dropPct <= 5
                            ? "text-emerald-700"
                            : dropPct <= 12
                              ? "text-amber-700"
                              : "text-red-700",
                        )}
                      >
                        {formatCompactInt(g.failCount)} đơn · {formatPct(dropPct, 1)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-2">
        Mỗi cột = 1 chặng. Cao = throughput cao. Đọc trái-phải theo flow đơn.
      </div>
    </div>
  );
}

// =============================================================================
// 8 final status grid
// =============================================================================

function FinalStatusGrid({
  mix,
}: {
  mix: ReturnType<typeof getJourneyFinalStatusMix>;
}) {
  // Sort: terminal trước, in_progress cuối
  const sorted = mix
    .slice()
    .sort((a, b) => (a.isTerminal === b.isTerminal ? 0 : a.isTerminal ? -1 : 1));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {sorted.map((m) => (
        <div
          key={m.status}
          className="border border-[var(--color-border)] rounded-md p-3 bg-white"
          style={{ borderLeftWidth: 4, borderLeftColor: m.color }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base" style={{ color: m.color }}>
              {m.icon}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)] truncate">
              {m.label}
            </span>
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--color-text)]">
            {formatPct(m.share, 1)}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
            {formatCompactInt(m.count)} đơn
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Percentile heatmap
// =============================================================================

function PercentileHeatmap({
  rows,
}: {
  rows: ReturnType<typeof getJourneyPercentiles>;
}) {
  // Ngưỡng đèn giao thông cho mỗi metric (phút hoặc h).
  const thresholds: Record<string, { green: number; amber: number; unit: string }> = {
    "Time 1 (scan đơn đầu)": { green: 15, amber: 25, unit: "'" },
    "Time 2 (kết thúc phiên)": { green: 20, amber: 30, unit: "'" },
    "Lead time E2E": { green: 36, amber: 60, unit: "h" },
  };

  const cellColor = (value: number, threshold: { green: number; amber: number }) => {
    if (value <= threshold.green)
      return "bg-emerald-100 text-emerald-900 border-emerald-200";
    if (value <= threshold.amber)
      return "bg-amber-100 text-amber-900 border-amber-200";
    return "bg-red-100 text-red-900 border-red-200";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium px-2 py-1">
              Chỉ số
            </th>
            {(["P50", "P90", "P99"] as const).map((p) => (
              <th
                key={p}
                className="text-center text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium px-2 py-1"
              >
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const t = thresholds[r.metric] ?? { green: 999, amber: 9999, unit: r.unit };
            return (
              <tr key={r.metric}>
                <td className="px-2 py-2 text-sm font-medium">{r.metric}</td>
                {[r.p50, r.p90, r.p99].map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-2 text-center tabular-nums font-semibold border rounded",
                      cellColor(v, t),
                    )}
                  >
                    {formatInt(v)}
                    {r.unit === "h" ? "h" : "'"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-2 flex gap-3">
        <span><span className="inline-block w-2 h-2 bg-emerald-500 rounded mr-1" />Đạt mục tiêu</span>
        <span><span className="inline-block w-2 h-2 bg-amber-500 rounded mr-1" />Cảnh báo</span>
        <span><span className="inline-block w-2 h-2 bg-red-500 rounded mr-1" />Vượt ngưỡng</span>
      </div>
    </div>
  );
}

// =============================================================================
// Drill MVĐ table
// =============================================================================

function OrdersDrillTable({
  rows,
}: {
  rows: ReturnType<typeof getJourneyTopOrders>;
}) {
  const cols: Column<ReturnType<typeof getJourneyTopOrders>[number]>[] = [
    {
      key: "mvd",
      label: "MVĐ",
      sortable: true,
      render: (r) => <span className="font-mono text-xs">{r.mvd}</span>,
    },
    {
      key: "createdAt",
      label: "Tạo lúc",
      render: (r) => (
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatVNDate(r.createdAt.slice(0, 10))} {r.createdAt.slice(11, 16)}
        </span>
      ),
    },
    { key: "province", label: "Tỉnh nhận" },
    {
      key: "channel",
      label: "Nguồn đơn",
      render: (r) => CHANNEL_LABEL_VI[r.channel as ChannelCode] ?? r.channel,
    },
    {
      key: "loaiHang",
      label: "Loại hàng",
      render: (r) => LOAI_HANG_LABEL_VI[r.loaiHang as LoaiHang] ?? r.loaiHang,
    },
    { key: "slaDays", label: "SLA", align: "right", render: (r) => `${r.slaDays}d` },
    {
      key: "currentState",
      label: "Trạng thái hiện tại",
      render: (r) => (
        <span className="text-xs font-mono px-1.5 py-0.5 bg-[var(--color-hover)] rounded">
          {r.currentState}
        </span>
      ),
    },
    {
      key: "finalStatus",
      label: "Kết quả",
      render: (r) => {
        const label = FINAL_STATUS_LABEL_VI[r.finalStatus as keyof typeof FINAL_STATUS_LABEL_VI];
        const color =
          r.finalStatus === "delivered"
            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : r.finalStatus === "in_progress"
              ? "bg-gray-100 text-gray-800 border-gray-200"
              : r.finalStatus.includes("returned")
                ? "bg-amber-100 text-amber-800 border-amber-200"
                : "bg-red-100 text-red-800 border-red-200";
        return (
          <span
            className={cn(
              "inline-block px-2 py-0.5 text-xs font-medium border rounded",
              color,
            )}
          >
            {label ?? r.finalStatus}
          </span>
        );
      },
    },
    {
      key: "leadtimeH",
      label: "LT E2E",
      align: "right",
      sortable: true,
      sortValue: (r) => r.leadtimeH,
      render: (r) => (r.leadtimeH > 0 ? formatHours(r.leadtimeH) : "—"),
    },
  ];
  return (
    <Card
      title="Drill xuống MVĐ — Top 30 đơn gần nhất"
      subtitle="Click cột để sort. Xem MVĐ cụ thể để truy trace pattern lỗi."
    >
      <DataTable
        columns={cols}
        data={rows}
        rowKey={(r) => r.mvd}
        searchable
        searchPlaceholder="Tìm MVĐ, tỉnh, trạng thái..."
        pageSize={15}
      />
    </Card>
  );
}
