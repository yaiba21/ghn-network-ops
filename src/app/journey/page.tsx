"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getJourneyFinalStatusMix,
  getJourneyFunnel,
  getJourneyPercentiles,
  getJourneyStatusGroups,
  getJourneyTopOrders,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Donut } from "@/components/ui/Donut";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatCompactInt, formatPct, formatVND, formatVNDate, formatHours } from "@/lib/utils";
import { CHANNEL_LABEL_VI, LOAI_HANG_LABEL_VI, type ChannelCode, type LoaiHang } from "@/lib/types";

export default function JourneyPage() {
  const { filter } = useFilter();

  const funnel = useMemo(() => getJourneyFunnel(filter), [filter]);
  const groups = useMemo(() => getJourneyStatusGroups(filter), [filter]);
  const percentiles = useMemo(() => getJourneyPercentiles(filter), [filter]);
  const finalMix = useMemo(() => getJourneyFinalStatusMix(filter), [filter]);
  const topOrders = useMemo(() => getJourneyTopOrders(filter, 30), [filter]);
  const updated = dataUpdatedAt();

  const finalMixSlices = finalMix.map((m) => ({
    key: m.status,
    label: m.label,
    value: m.count,
    color: m.color,
  }));
  const totalOrders = finalMix.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Hành Trình Đơn Hàng" },
        ]}
        title="Hành Trình Đơn Hàng — theo trạng thái"
        subtitle="6 nhóm trạng thái từ tạo đơn đến giao thành công (hoặc hoàn). Funnel + percentile lead time + drill xuống MVĐ."
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

      {/* === Funnel theo trạng thái === */}
      <Card
        title="Funnel trạng thái — từ tạo đơn → terminal"
        subtitle="Hồ phễu các mốc chính trong đời đơn. Nhánh thất bại (Huỷ / Thất lạc) tô đỏ."
      >
        <FunnelChart funnel={funnel} />
      </Card>

      {/* === 6 nhóm trạng thái table === */}
      <Card
        title="6 nhóm trạng thái — chỉ số chi tiết"
        subtitle="Throughput · Tỷ lệ thành công · Lead time trung bình · Số đơn fail."
      >
        <StatusGroupTable rows={groups} />
      </Card>

      {/* === Percentile + Final status mix === */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card
            title="Percentile Lead Time — P50 / P90 / P99"
            subtitle="Time 1 (scan đơn đầu) · Time 2 (kết thúc phiên) · Lead time E2E."
          >
            <PercentileTable rows={percentiles} />
          </Card>
        </div>
        <Card
          title="Mix trạng thái cuối"
          subtitle={`Tổng ${formatCompactInt(totalOrders)} đơn — phân phối final_status.`}
        >
          <Donut
            data={finalMixSlices}
            height={200}
            innerRadius={50}
            outerRadius={80}
            valueFormatter={(v) => `${formatCompactInt(v)} đơn`}
            centerLabel={
              <>
                <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Tổng</div>
                <div className="text-base font-semibold tabular-nums">
                  {formatCompactInt(totalOrders)}
                </div>
              </>
            }
          />
          <ul className="mt-3 space-y-1.5">
            {finalMix.map((m) => (
              <li key={m.status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: m.color }} />
                  <span>{m.label}</span>
                </div>
                <span className="font-semibold tabular-nums">{formatPct(m.share, 1)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* === Drill MVĐ === */}
      <OrdersDrillTable rows={topOrders} />
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function FunnelChart({ funnel }: { funnel: ReturnType<typeof getJourneyFunnel> }) {
  const max = Math.max(...funnel.map((n) => n.count));
  return (
    <div className="space-y-1.5">
      {funnel.map((n) => {
        const widthPct = max === 0 ? 0 : (n.count / max) * 100;
        const color = n.isFail
          ? "#ef4444"
          : n.isTerminal
            ? "#10b981"
            : "#1F2937";
        const textColor = n.isFail
          ? "text-red-700"
          : n.isTerminal
            ? "text-emerald-700"
            : "text-[var(--color-text)]";
        return (
          <div key={n.key} className="flex items-center gap-2">
            <div className="w-32 shrink-0 text-xs truncate">{n.label}</div>
            <div className="flex-1 relative h-7 bg-[var(--color-hover)] rounded">
              <div
                className="absolute left-0 top-0 bottom-0 rounded transition-[width] duration-300"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              />
              <div
                className={cn(
                  "absolute left-2 top-0 bottom-0 flex items-center text-xs font-medium tabular-nums",
                  widthPct > 25 ? "text-white" : textColor,
                )}
              >
                {formatCompactInt(n.count)}
              </div>
            </div>
            <div className={cn("w-20 shrink-0 text-right text-xs tabular-nums", textColor)}>
              {formatPct((n.count / Math.max(1, funnel[0].count)) * 100, 1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusGroupTable({ rows }: { rows: ReturnType<typeof getJourneyStatusGroups> }) {
  const cols: Column<ReturnType<typeof getJourneyStatusGroups>[number]>[] = [
    {
      key: "groupLabel",
      label: "Nhóm trạng thái",
      render: (r) => <span className="font-medium">{r.groupLabel}</span>,
    },
    {
      key: "total",
      label: "Throughput",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (r) => formatCompactInt(r.total) + " đơn",
    },
    {
      key: "successRate",
      label: "Tỷ lệ thành công",
      align: "right",
      sortable: true,
      sortValue: (r) => r.successRate,
      render: (r) => (
        <span
          className={
            r.successRate >= 92
              ? "text-emerald-600"
              : r.successRate >= 85
                ? "text-amber-600"
                : "text-red-600"
          }
        >
          {formatPct(r.successRate, 1)}
        </span>
      ),
    },
    {
      key: "avgLeadtimeH",
      label: "Lead time TB",
      align: "right",
      sortable: true,
      sortValue: (r) => r.avgLeadtimeH,
      render: (r) => formatHours(r.avgLeadtimeH),
    },
    {
      key: "failCount",
      label: "Đơn fail",
      align: "right",
      sortable: true,
      sortValue: (r) => r.failCount,
      render: (r) => formatCompactInt(r.failCount),
    },
  ];
  return (
    <DataTable
      columns={cols}
      data={rows}
      rowKey={(r) => r.groupKey}
    />
  );
}

function PercentileTable({ rows }: { rows: ReturnType<typeof getJourneyPercentiles> }) {
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-table-head)]">
          <tr>
            <th className="text-left px-4 py-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
              Chỉ số
            </th>
            <th className="text-right px-4 py-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
              P50
            </th>
            <th className="text-right px-4 py-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
              P90
            </th>
            <th className="text-right px-4 py-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
              P99
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.metric} className="border-t border-[var(--color-border-soft)]">
              <td className="px-4 py-2.5">{r.metric}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                {r.p50}
                {r.unit === "h" ? "h" : "'"}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {r.p90}
                {r.unit === "h" ? "h" : "'"}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {r.p99}
                {r.unit === "h" ? "h" : "'"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
        const status =
          r.finalStatus === "delivered"
            ? "green"
            : r.finalStatus === "returned"
              ? "amber"
              : r.finalStatus === "lost"
                ? "red"
                : "amber";
        return <StatusBadge status={status} label={r.finalStatus} />;
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
