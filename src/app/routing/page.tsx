"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getDoiKhoCompare,
  getRevertReasons,
  getRoutingChannelFlow,
} from "@/lib/aggregators";
import { dataUpdatedAt, getFactOrders } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { Donut } from "@/components/ui/Donut";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { MetricBadge } from "@/components/ui/MetricBadge";
import {
  cn,
  formatCompactInt,
  formatInt,
  formatPct,
  formatVND,
} from "@/lib/utils";

export default function RoutingPage() {
  const { filter } = useFilter();
  const channelFlow = useMemo(() => getRoutingChannelFlow(filter), [filter]);
  const revertReasons = useMemo(() => getRevertReasons(filter), [filter]);
  const doiKho = useMemo(() => getDoiKhoCompare(filter), [filter]);
  const updated = dataUpdatedAt();

  const totalRevert = revertReasons.reduce((a, b) => a + b.count, 0);
  const savingPerRevert = 10_000; // 10k đ/đơn theo spec
  const potentialSaving = Math.round(totalRevert * 0.4 * savingPerRevert); // giả định 40% cải thiện

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Định Tuyến" },
        ]}
        title="Định Tuyến — Routing & Order Allocation"
        subtitle="Phân tuyến đơn theo channel + sort code + KTC. Theo dõi 3 metric đổi kho phân biệt mẫu số."
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

      {/* === 3 metric đổi kho — phân biệt mẫu số === */}
      <Card
        title="3 chỉ số đổi kho — chú ý khác mẫu số"
        subtitle="Đừng trộn 3 chỉ số: overall / new address / old address. Mỗi cái tính trên mẫu số khác nhau."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <DoiKhoStat
            label="Overall"
            value={doiKho.overall}
            denom="Tất cả đơn"
            target={1.5}
            warn={2.3}
          />
          <DoiKhoStat
            label="Địa chỉ mới"
            value={doiKho.newAddress}
            denom="Chỉ đơn địa chỉ mới"
            target={6}
            warn={10}
          />
          <DoiKhoStat
            label="Địa chỉ cũ"
            value={doiKho.oldAddress}
            denom="Chỉ đơn địa chỉ cũ"
            target={2}
            warn={4}
          />
          <DoiKhoStat
            label="HN địa chỉ mới"
            value={doiKho.hnNewAddress}
            denom="Đơn HN địa chỉ mới"
            target={10}
            warn={17}
            hint="HN cao gấp ~2× tỉnh khác"
          />
          <DoiKhoStat
            label="HCM địa chỉ mới"
            value={doiKho.hcmNewAddress}
            denom="Đơn HCM địa chỉ mới"
            target={10}
            warn={14}
            hint="HCM cao gấp ~2× tỉnh khác"
          />
        </div>
      </Card>

      {/* === Channel flow === */}
      <Card
        title="Channel → Routing Layer → KTC (flow)"
        subtitle="Mỗi channel theo polygon layer riêng: SPE = Zone-based · TTS = Phường cũ · SME = Phường mới · B2B = Freight."
      >
        <ChannelFlowTable rows={channelFlow} />
      </Card>

      {/* === Revert reasons + cost impact === */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card
            title="Lý do đổi kho — pie breakdown"
            subtitle="66% là lý do vận hành (có thể fix). 34% còn lại GAP công thức."
            actions={
              <MetricBadge kind="gap" label="34% chưa chốt công thức" />
            }
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
                  <li
                    key={r.key}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="truncate">{r.label}</span>
                    </div>
                    <span className="tabular-nums font-semibold shrink-0">
                      {formatPct(r.share, 1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
        <Card
          title="Chi phí đổi kho"
          subtitle="Chênh lệch ~10k đ/đơn giữa có vs không đổi kho."
        >
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                Tổng đơn đổi kho
              </div>
              <div className="text-2xl font-semibold tabular-nums">
                {formatCompactInt(totalRevert)}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                Chi phí phát sinh (vs ko đổi)
              </div>
              <div className="text-xl font-semibold tabular-nums text-red-600">
                +{formatVND(totalRevert * savingPerRevert, true)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">
                {formatInt(savingPerRevert)} đ/đơn × {formatCompactInt(totalRevert)}
              </div>
            </div>
            <div className="pt-3 border-t border-[var(--color-border-soft)]">
              <div className="text-[10px] uppercase text-[var(--color-text-muted)]">
                Tiềm năng tiết kiệm (giảm 40% đổi kho)
              </div>
              <div className="text-xl font-semibold tabular-nums text-emerald-600">
                {formatVND(potentialSaving, true)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DoiKhoStat({
  label,
  value,
  denom,
  target,
  warn,
  hint,
}: {
  label: string;
  value: number;
  denom: string;
  target: number;
  warn: number;
  hint?: string;
}) {
  const status = value <= target ? "green" : value <= warn ? "amber" : "red";
  const colorCls =
    status === "green"
      ? "text-emerald-600"
      : status === "amber"
        ? "text-amber-600"
        : "text-red-600";
  return (
    <div className="border border-[var(--color-border)] rounded-md p-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", colorCls)}>
        {formatPct(value, 1)}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
        Mẫu số: {denom}
      </div>
      <div className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
        Mục tiêu ≤ {target}% · Cảnh báo &gt; {warn}%
      </div>
      {hint && (
        <div className="text-[10px] text-amber-700 mt-1">{hint}</div>
      )}
    </div>
  );
}

function ChannelFlowTable({
  rows,
}: {
  rows: ReturnType<typeof getRoutingChannelFlow>;
}) {
  const cols: Column<ReturnType<typeof getRoutingChannelFlow>[number]>[] = [
    {
      key: "channelLabel",
      label: "Channel",
      render: (r) => <span className="font-medium">{r.channelLabel}</span>,
    },
    {
      key: "ordersTotal",
      label: "Tổng đơn",
      align: "right",
      sortable: true,
      sortValue: (r) => r.ordersTotal,
      render: (r) => formatCompactInt(r.ordersTotal),
    },
    {
      key: "changedWh",
      label: "Đơn đổi kho",
      align: "right",
      sortable: true,
      sortValue: (r) => r.changedWh,
      render: (r) => formatCompactInt(r.changedWh),
    },
    {
      key: "newAddrChangedWh",
      label: "Trong đó địa chỉ mới",
      align: "right",
      sortable: true,
      sortValue: (r) => r.newAddrChangedWh,
      render: (r) => formatCompactInt(r.newAddrChangedWh),
    },
    {
      key: "_rate",
      label: "% Đổi kho",
      align: "right",
      sortable: true,
      sortValue: (r) =>
        r.ordersTotal > 0 ? (r.changedWh / r.ordersTotal) * 100 : 0,
      render: (r) => {
        const v = r.ordersTotal > 0 ? (r.changedWh / r.ordersTotal) * 100 : 0;
        return (
          <span
            className={
              v <= 2.3
                ? "text-emerald-600"
                : v <= 4
                  ? "text-amber-600"
                  : "text-red-600"
            }
          >
            {formatPct(v, 1)}
          </span>
        );
      },
    },
  ];
  return (
    <DataTable
      columns={cols}
      data={rows}
      rowKey={(r) => r.channel}
    />
  );
}
