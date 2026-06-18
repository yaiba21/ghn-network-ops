"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getJourneyAlerts,
  getJourneyFinalStatusMix,
  getJourneySankey,
  getJourneyStatusGroups,
  getJourneyTopOrders,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { SankeyChart } from "@/components/ui/SankeyChart";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  cn,
  formatCompactInt,
  formatHours,
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
  const finalMix = useMemo(() => getJourneyFinalStatusMix(filter), [filter]);
  const topOrders = useMemo(() => getJourneyTopOrders(filter, 30), [filter]);
  const sankey = useMemo(() => getJourneySankey(filter), [filter]);
  const alerts = useMemo(() => getJourneyAlerts(filter), [filter]);
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
        subtitle="Theo dõi performance theo hành trình đơn hàng"
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

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* === Bảng 6 nhóm trạng thái + metrics === */}
      <Card
        title="Bảng trạng thái đơn hàng"
        subtitle={`${formatCompactInt(totalOrders)} đơn qua 6 chặng. Mỗi nhóm trạng thái: số lượng · % thành công · lead time TB · tỷ lệ đúng cut-off.`}
      >
        <StatusGroupTable groups={groups} />
      </Card>

      {/* === Sankey flow đơn (luồng trạng thái đầy đủ) === */}
      <Card
        title="Sankey — luồng đơn theo trạng thái"
        subtitle="Độ dày luồng = số đơn. Tạo đơn → Lấy → Phân loại KTC → Linehaul → BC giao → Phát → GTC / Phát thất bại → Hoàn / Thất lạc / Exception."
      >
        <SankeyChart data={sankey} height={560} />
      </Card>

      {/* === Các final status của đơn hàng === */}
      <Card
        title="Các final status của đơn hàng"
        subtitle="Kết quả cuối của đơn hàng"
      >
        <FinalStatusGrid mix={finalMix} />
      </Card>

      {/* === Drill down xuống đơn hàng === */}
      <OrdersDrillTable rows={topOrders} />
    </div>
  );
}

// =============================================================================
// Status group table — 6 nhóm trạng thái + metrics
// =============================================================================

function StatusGroupTable({
  groups,
}: {
  groups: ReturnType<typeof getJourneyStatusGroups>;
}) {
  const cols: Column<ReturnType<typeof getJourneyStatusGroups>[number]>[] = [
    {
      key: "groupLabel",
      label: "Nhóm trạng thái",
      render: (r) => <span className="font-medium">{r.groupLabel}</span>,
    },
    {
      key: "total",
      label: "Số lượng",
      align: "right",
      sortable: true,
      sortValue: (r) => r.total,
      render: (r) => formatCompactInt(r.total) + " đơn",
    },
    {
      key: "successRate",
      label: "% Thành công",
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
      render: (r) => (r.avgLeadtimeH > 0 ? formatHours(r.avgLeadtimeH) : "—"),
    },
    {
      key: "cutoffRate",
      label: "Tỷ lệ đúng cut-off",
      align: "right",
      sortable: true,
      sortValue: (r) => r.cutoffRate,
      render: (r) => (
        <span
          className={
            r.cutoffRate >= 90
              ? "text-emerald-600"
              : r.cutoffRate >= 80
                ? "text-amber-600"
                : "text-red-600"
          }
        >
          {formatPct(r.cutoffRate, 1)}
        </span>
      ),
    },
  ];
  return <DataTable columns={cols} data={groups} rowKey={(r) => r.groupKey} />;
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
// Drill down xuống đơn hàng
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
      title="Drill down xuống đơn hàng"
      subtitle="Click cột để sort, hoặc search mã vận đơn (Order ID)"
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
