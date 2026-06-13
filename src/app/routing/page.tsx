"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getDoiKhoBreakdown,
  getEngineResolveLayers,
  getRevertReasons,
  getRoutingAlerts,
  getRoutingChannelFlow,
  getRoutingHeaderKpis,
  getRoutingRegionComparison,
  getTopRevertBcs,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { Donut } from "@/components/ui/Donut";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MetricBadge } from "@/components/ui/MetricBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { REGION_LABEL_VI } from "@/lib/types";
import {
  cn,
  formatCompactInt,
  formatInt,
  formatPct,
  formatVND,
} from "@/lib/utils";

export default function RoutingPage() {
  const { filter } = useFilter();
  const header = useMemo(() => getRoutingHeaderKpis(filter), [filter]);
  const regionRows = useMemo(() => getRoutingRegionComparison(filter), [filter]);
  const channelFlow = useMemo(() => getRoutingChannelFlow(filter), [filter]);
  const revertReasons = useMemo(() => getRevertReasons(filter), [filter]);
  const topBcs = useMemo(() => getTopRevertBcs(filter, 20), [filter]);
  const doiKhoBreakdown = useMemo(() => getDoiKhoBreakdown(filter), [filter]);
  const engineLayers = useMemo(() => getEngineResolveLayers(filter), [filter]);
  const alerts = useMemo(() => getRoutingAlerts(filter), [filter]);
  const updated = dataUpdatedAt();

  const totalRevert = revertReasons.reduce((a, b) => a + b.count, 0);
  const savingPerRevert = 10_000;
  const potentialSaving = Math.round(totalRevert * 0.4 * savingPerRevert);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Định Tuyến" },
        ]}
        title="Định Tuyến — Routing & Order Allocation"
        subtitle="Phân tuyến đơn theo channel + sort code + KTC. 3 metric đổi kho phân biệt mẫu số, so sánh theo vùng + BC."
        updatedAt={updated}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          channel: true,
          loaiHang: true,
          loaiTuyen: true,
        }}
      />

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* === Header KPI === */}
      <section className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCardFrom kpi={header.phanTuyenDung} size="sm" />
        <KpiCardFrom kpi={header.doiKhoOverall} size="sm" />
        <KpiCardFrom kpi={header.doiKhoNewAddr} size="sm" />
        <div className="border border-[var(--color-border)] rounded-md bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Tổng đơn đổi kho
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {formatCompactInt(header.totalRevert)}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">đơn / kỳ filter</div>
        </div>
        <div className="border border-[var(--color-border)] rounded-md bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Chi phí phát sinh
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-red-600">
            {formatVND(header.costImpact, true)}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)]">
            10k đ/đơn đổi kho
          </div>
        </div>
      </section>

      {/* === Đổi kho breakdown: overall + HCM/HN × phường mới/cũ === */}
      <Card
        title="Tỷ lệ đổi kho — breakdown từ overall"
        subtitle="Overall toàn bộ, rồi tách theo HCM/HN × phường mới/cũ. HN & HCM phường mới cao nhất."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {doiKhoBreakdown.map((d) => (
            <DoiKhoStat key={d.key} item={d} />
          ))}
        </div>
      </Card>

      {/* === Engine resolve ở bước nào + So sánh vùng === */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Card
          title="Engine resolve ở bước nào"
          subtitle="ORS phân giải đơn ở layer nào khi tạo đơn."
        >
          <div className="space-y-3">
            {engineLayers.map((l) => (
              <div key={l.key} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-sm text-[var(--color-text)]">
                  {l.label}
                </div>
                <div className="flex-1 h-3 bg-[var(--color-border-soft)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${l.pct}%`, backgroundColor: l.color }}
                  />
                </div>
                <div className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {formatPct(l.pct, 0)}
                </div>
              </div>
            ))}
            <div className="text-xs text-[var(--color-text-muted)] pt-1">
              % &quot;mặc định&quot; cao = thiếu config BC → nguồn revert sớm
            </div>
          </div>
        </Card>

        <div className="xl:col-span-2">
          <Card
            title={`So sánh ${regionRows.length} vùng — phân tuyến + đổi kho`}
            subtitle="Vùng nào đổi kho cao nhất / phân tuyến đúng thấp nhất. Sort cột để tìm vùng cần ưu tiên xây rule."
          >
            <DataTable columns={regionColumns} data={regionRows} rowKey={(r) => r.regionCode} />
          </Card>
        </div>
      </div>

      {/* === Channel flow — 3 cột đổi kho === */}
      <Card
        title="Channel → Routing Layer → đổi kho"
        subtitle="Mỗi channel theo polygon layer riêng: SPE = Zone-based · TTS = Phường cũ · SME = Phường mới · B2B = Freight. 3 cột đổi kho phân biệt mẫu số."
      >
        <DataTable columns={channelColumns} data={channelFlow} rowKey={(r) => r.channel} />
      </Card>

      {/* === Top BC đổi kho + lý do === */}
      <Card
        title="Top 20 BC đổi kho cao nhất + lý do"
        subtitle="BC nào đang đổi kho nhiều nhất, lý do chủ đạo. Ưu tiên xử lý các BC đỏ."
      >
        <DataTable
          columns={topBcColumns}
          data={topBcs}
          rowKey={(r) => r.bcCode}
          searchable
          searchPlaceholder="Tìm BC, tỉnh, lý do..."
          pageSize={10}
        />
      </Card>

      {/* === Revert reasons + cost impact === */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card
            title="Lý do đổi kho — pie breakdown"
            subtitle="66% là lý do vận hành (có thể fix). 34% còn lại GAP công thức."
            actions={<MetricBadge kind="gap" label="34% chưa chốt công thức" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              <Donut
                data={revertReasons.map((r) => ({
                  key: r.key,
                  label: r.label,
                  value: r.count,
                  color: r.color,
                }))}
                height={220}
                innerRadius={56}
                outerRadius={90}
                centerLabel={
                  <>
                    <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                      Tổng đổi kho
                    </div>
                    <div className="text-base font-semibold tabular-nums">
                      {formatCompactInt(totalRevert)}
                    </div>
                  </>
                }
              />
              <ul className="space-y-1.5">
                {revertReasons.map((r) => (
                  <li key={r.key} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="truncate">{r.label}</span>
                    </div>
                    <span className="tabular-nums font-semibold shrink-0">{formatPct(r.share, 1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
        <Card title="Tác động chi phí đổi kho" subtitle="Chênh lệch ~10k đ/đơn giữa có vs không đổi kho.">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Tổng đơn đổi kho</div>
              <div className="text-2xl font-semibold tabular-nums">{formatCompactInt(totalRevert)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Chi phí phát sinh (vs ko đổi)</div>
              <div className="text-xl font-semibold tabular-nums text-red-600">+{formatVND(totalRevert * savingPerRevert, true)}</div>
              <div className="text-[10px] text-[var(--color-text-muted)]">{formatInt(savingPerRevert)} đ/đơn × {formatCompactInt(totalRevert)}</div>
            </div>
            <div className="pt-3 border-t border-[var(--color-border-soft)]">
              <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Tiềm năng tiết kiệm (giảm 40% đổi kho)</div>
              <div className="text-xl font-semibold tabular-nums text-emerald-600">{formatVND(potentialSaving, true)}</div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DoiKhoStat({
  item,
}: {
  item: ReturnType<typeof getDoiKhoBreakdown>[number];
}) {
  const colorCls =
    item.status === "green"
      ? "text-emerald-600"
      : item.status === "amber"
        ? "text-amber-600"
        : "text-red-600";
  return (
    <div className="border border-[var(--color-border)] rounded-md p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {item.label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", colorCls)}>
        {formatPct(item.rate, 1)}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-1 tabular-nums">
        {formatCompactInt(item.count)} / {formatCompactInt(item.segmentTotal)} đơn
      </div>
    </div>
  );
}

const regionColumns: Column<ReturnType<typeof getRoutingRegionComparison>[number]>[] = [
  { key: "regionName", label: "Vùng", render: (r) => <span className="font-medium">{r.regionName}</span> },
  { key: "orders", label: "Lượng đơn", align: "right", sortable: true, sortValue: (r) => r.orders, render: (r) => formatCompactInt(r.orders) },
  {
    key: "phanTuyenDung", label: "% Phân tuyến đúng", align: "right", sortable: true, sortValue: (r) => r.phanTuyenDung,
    render: (r) => <span className={r.phanTuyenDung >= 98.5 ? "text-emerald-600" : r.phanTuyenDung >= 95 ? "text-amber-600" : "text-red-600"}>{formatPct(r.phanTuyenDung, 1)}</span>,
  },
  {
    key: "doiKhoOverall", label: "% Đổi kho overall", align: "right", sortable: true, sortValue: (r) => r.doiKhoOverall,
    render: (r) => <span className={r.doiKhoOverall <= 1.5 ? "text-emerald-600" : r.doiKhoOverall <= 2.3 ? "text-amber-600" : "text-red-600"}>{formatPct(r.doiKhoOverall, 1)}</span>,
  },
  {
    key: "doiKhoNewAddr", label: "% Đổi kho địa chỉ mới", align: "right", sortable: true, sortValue: (r) => r.doiKhoNewAddr,
    render: (r) => <span className={r.doiKhoNewAddr <= 6 ? "text-emerald-600" : r.doiKhoNewAddr <= 10 ? "text-amber-600" : "text-red-600"}>{formatPct(r.doiKhoNewAddr, 1)}</span>,
  },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];

const channelColumns: Column<ReturnType<typeof getRoutingChannelFlow>[number]>[] = [
  { key: "channelLabel", label: "Channel", render: (r) => <span className="font-medium">{r.channelLabel}</span> },
  { key: "ordersTotal", label: "Lượng đơn", align: "right", sortable: true, sortValue: (r) => r.ordersTotal, render: (r) => formatCompactInt(r.ordersTotal) },
  {
    key: "doiKhoOverall", label: "Đổi kho overall", align: "right", sortable: true, sortValue: (r) => r.doiKhoOverall,
    render: (r) => <span className={r.doiKhoOverall <= 2.3 ? "text-emerald-600" : r.doiKhoOverall <= 4 ? "text-amber-600" : "text-red-600"}>{formatPct(r.doiKhoOverall, 1)}</span>,
  },
  {
    key: "doiKhoNewAddr", label: "Đổi kho phường MỚI", align: "right", sortable: true, sortValue: (r) => r.doiKhoNewAddr,
    render: (r) => <span className={r.doiKhoNewAddr <= 6 ? "text-emerald-600" : r.doiKhoNewAddr <= 10 ? "text-amber-600" : "text-red-600"}>{formatPct(r.doiKhoNewAddr, 1)}</span>,
  },
  {
    key: "doiKhoOldAddr", label: "Đổi kho phường CŨ", align: "right", sortable: true, sortValue: (r) => r.doiKhoOldAddr,
    render: (r) => <span className={r.doiKhoOldAddr <= 2 ? "text-emerald-600" : r.doiKhoOldAddr <= 4 ? "text-amber-600" : "text-red-600"}>{formatPct(r.doiKhoOldAddr, 1)}</span>,
  },
];

const topBcColumns: Column<ReturnType<typeof getTopRevertBcs>[number]>[] = [
  { key: "bcName", label: "Bưu cục", render: (r) => <span className="font-medium truncate">{r.bcName}</span> },
  { key: "region", label: "Vùng", sortable: true, render: (r) => REGION_LABEL_VI[r.region] ?? r.region },
  { key: "totalOrders", label: "Lượng đơn", align: "right", sortable: true, sortValue: (r) => r.totalOrders, render: (r) => formatCompactInt(r.totalOrders) },
  { key: "revertCount", label: "Số đổi kho", align: "right", sortable: true, sortValue: (r) => r.revertCount, render: (r) => formatCompactInt(r.revertCount) },
  {
    key: "revertRate", label: "% Đổi kho", align: "right", sortable: true, sortValue: (r) => r.revertRate,
    render: (r) => <span className={r.revertRate <= 2.3 ? "text-emerald-600" : r.revertRate <= 4 ? "text-amber-600" : "text-red-600"}>{formatPct(r.revertRate, 1)}</span>,
  },
  { key: "topReason", label: "Lý do chủ đạo", render: (r) => <span className="text-xs px-2 py-0.5 bg-[var(--color-hover)] rounded">{r.topReason}</span> },
  { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
];
