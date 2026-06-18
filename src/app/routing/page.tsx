"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getDoiKhoBreakdown,
  getDoiKhoByChannelAddr,
  getEngineResolveLayers,
  getRevertReasons,
  getRoutingAlerts,
  getRoutingCargoComparison,
  getRoutingChannelFlow,
  getRoutingHeaderKpis,
  getRoutingRegionComparison,
  getRoutingWowMetrics,
  getTopRevertBcs,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { MetricChart } from "@/components/ui/MetricChart";
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
  const doiKhoByChannel = useMemo(() => getDoiKhoByChannelAddr(filter), [filter]);
  const wowMetrics = useMemo(() => getRoutingWowMetrics(filter), [filter]);
  const engineLayers = useMemo(() => getEngineResolveLayers(filter), [filter]);
  const cargoRows = useMemo(() => getRoutingCargoComparison(filter), [filter]);
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
        title="Định Tuyến (Order Allocation)"
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

      {/* === Header KPI (key metrics) === */}
      <section className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCardFrom kpi={header.chiDinhKho} size="sm" />
        <KpiCardFrom kpi={header.khongChiDinh} size="sm" />
        <KpiCardFrom kpi={header.doiKhoOverall} size="sm" />
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

      {/* === WoW chart cho tất cả key metrics === */}
      <Card
        title="So sánh WoW — key metrics định tuyến"
        subtitle="Tuần trước (7 ngày) vs Tuần này (7 ngày gần nhất). Cột càng chênh = biến động càng lớn tuần qua."
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <MetricChart
              type="bar"
              data={wowMetrics}
              xKey="label"
              height={240}
              series={[
                { key: "lastWeek", label: "Tuần trước", color: "#CBD5E1" },
                { key: "thisWeek", label: "Tuần này", color: "#F97316" },
              ]}
              yTickFormatter={(v) => `${v}%`}
              tooltipValueFormatter={(v) => `${v.toFixed(1)}%`}
              legend
            />
          </div>
          <div className="space-y-2">
            {wowMetrics.map((m) => (
              <WowDeltaRow key={m.key} row={m} />
            ))}
          </div>
        </div>
      </Card>

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

      {/* === Tỷ lệ đổi kho toàn quốc theo nguồn đơn × phường (+ WoW) === */}
      <Card
        title="Tỷ lệ đổi kho toàn quốc — theo nguồn đơn × phường mới/cũ"
        subtitle="Overall + SPE / TTS / SME, tách phường mới vs cũ. Cột WoW = chênh lệch điểm % tuần này vs tuần trước (↑ đỏ = xấu đi, ↓ xanh = cải thiện)."
      >
        <DataTable
          columns={doiKhoAddrColumns}
          data={doiKhoByChannel}
          rowKey={(r) => r.key}
        />
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

      {/* === So sánh theo loại hàng — BC lấy/giao === */}
      <Card
        title="So sánh theo loại hàng — BC lấy / BC giao"
        subtitle="Tiêu chuẩn / Cồng kềnh / Nặng: lượng đơn lấy & giao, % đổi kho, % phân tuyến đúng, ontime giao. Hàng cồng kềnh/nặng thường đổi kho + trễ nhiều hơn."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cargoRows.map((c) => (
            <div
              key={c.loaiHang}
              className="border border-[var(--color-border)] rounded-md overflow-hidden"
            >
              <div className="h-1" style={{ backgroundColor: c.color }} />
              <div className="p-3">
                <div className="text-sm font-semibold text-[var(--color-text)] mb-2">
                  {c.label}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[var(--color-hover)] rounded p-2">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      Đơn BC lấy
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {formatCompactInt(c.donLay)}
                    </div>
                  </div>
                  <div className="bg-[var(--color-hover)] rounded p-2">
                    <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                      Đơn BC giao
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {formatCompactInt(c.donGiao)}
                    </div>
                  </div>
                </div>
                <CargoBar label="% Đổi kho" value={c.doiKho} good={c.doiKho <= 2.3} lowerBetter />
                <CargoBar label="% Phân tuyến đúng" value={c.phanTuyenDung} good={c.phanTuyenDung >= 98.5} />
                <CargoBar label="Ontime giao" value={c.ontimeGiao} good={c.ontimeGiao >= 90} />
              </div>
            </div>
          ))}
        </div>
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

// Chênh lệch điểm % WoW (pp): màu theo hướng tốt/xấu của metric.
function WowPP({ value, lowerBetter }: { value: number; lowerBetter?: boolean }) {
  if (Math.abs(value) < 0.05) {
    return <span className="text-xs tabular-nums text-[var(--color-text-muted)]">→ 0,0</span>;
  }
  const improving = lowerBetter ? value < 0 : value > 0;
  const color = improving ? "text-emerald-600" : "text-red-600";
  const arrow = value > 0 ? "▲" : "▼";
  const sign = value > 0 ? "+" : "−";
  return (
    <span className={cn("text-xs font-medium tabular-nums", color)}>
      {arrow} {sign}
      {Math.abs(value).toFixed(1).replace(".", ",")} pp
    </span>
  );
}

function WowDeltaRow({
  row,
}: {
  row: ReturnType<typeof getRoutingWowMetrics>[number];
}) {
  const delta = row.thisWeek - row.lastWeek;
  return (
    <div className="border border-[var(--color-border)] rounded-md p-2.5">
      <div className="text-[11px] text-[var(--color-text-muted)] truncate">{row.label}</div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums">{formatPct(row.thisWeek, 1)}</span>
        <WowPP value={delta} lowerBetter={!row.higherBetter} />
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
        tuần trước {formatPct(row.lastWeek, 1)}
      </div>
    </div>
  );
}

const doiKhoRateCls = (v: number, green: number, amber: number) =>
  v <= green ? "text-emerald-600" : v <= amber ? "text-amber-600" : "text-red-600";

const doiKhoAddrColumns: Column<ReturnType<typeof getDoiKhoByChannelAddr>[number]>[] = [
  {
    key: "label",
    label: "Nguồn đơn",
    render: (r) => (
      <span className={cn("font-medium", r.key === "overall" && "text-[var(--color-text)]")}>
        {r.label}
      </span>
    ),
  },
  {
    key: "newRate",
    label: "Phường MỚI",
    align: "right",
    sortable: true,
    sortValue: (r) => r.newRate,
    render: (r) => (
      <span className={doiKhoRateCls(r.newRate, 10, 14)}>{formatPct(r.newRate, 1)}</span>
    ),
  },
  {
    key: "newWow",
    label: "Phường MỚI · WoW",
    align: "right",
    sortable: true,
    sortValue: (r) => r.newWow,
    render: (r) => <WowPP value={r.newWow} lowerBetter />,
  },
  {
    key: "oldRate",
    label: "Phường CŨ",
    align: "right",
    sortable: true,
    sortValue: (r) => r.oldRate,
    render: (r) => (
      <span className={doiKhoRateCls(r.oldRate, 2, 4)}>{formatPct(r.oldRate, 1)}</span>
    ),
  },
  {
    key: "oldWow",
    label: "Phường CŨ · WoW",
    align: "right",
    sortable: true,
    sortValue: (r) => r.oldWow,
    render: (r) => <WowPP value={r.oldWow} lowerBetter />,
  },
];

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

function CargoBar({
  label,
  value,
  good,
  lowerBetter,
}: {
  label: string;
  value: number;
  good: boolean;
  lowerBetter?: boolean;
}) {
  const color = good ? "#10b981" : "#f59e0b";
  // width: với lower-better, scale ngược cho dễ đọc (đầy = tốt)
  const width = lowerBetter ? Math.max(8, 100 - value * 6) : Math.min(100, value);
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className="font-semibold tabular-nums">{formatPct(value, 1)}</span>
      </div>
      <div className="h-1.5 bg-[var(--color-hover)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

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
