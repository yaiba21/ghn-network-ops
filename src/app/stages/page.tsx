"use client";

import { useMemo, useState } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getStageBreakdown,
  getStageOverview,
  type StageKey,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn, formatCompactInt, formatHours, formatPct } from "@/lib/utils";

const STAGE_TONE: Record<StageKey, string> = {
  fm: "bg-emerald-500",
  "ktc-fw": "bg-violet-500",
  lm: "bg-amber-500",
  "ktc-ret": "bg-sky-500",
  return: "bg-rose-500",
};

export default function StagesPage() {
  const { filter } = useFilter();
  const stages = useMemo(() => getStageOverview(filter), [filter]);
  const [activeStage, setActiveStage] = useState<StageKey>("fm");
  const breakdown = useMemo(
    () => getStageBreakdown(filter, activeStage),
    [filter, activeStage],
  );
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Các Chặng Vận Hành" },
        ]}
        title="Các Chặng Vận Hành — theo flow"
        subtitle="5 chặng từ first-mile đến hoàn trả. Click 1 chặng để xem breakdown BC/KTC chi tiết."
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

      {/* === 5 chặng card === */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {stages.map((s) => (
          <button
            key={s.stageKey}
            type="button"
            onClick={() => setActiveStage(s.stageKey)}
            className={cn(
              "text-left border rounded-md bg-white overflow-hidden transition-all",
              activeStage === s.stageKey
                ? "border-[var(--color-ghn-red)] shadow-sm ring-2 ring-red-100"
                : "border-[var(--color-border)] hover:border-[var(--color-text-faint)]",
            )}
          >
            <div className={cn("h-1", STAGE_TONE[s.stageKey])} />
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
              <div className="text-[10px] text-[var(--color-text-muted)]">số lượng / kỳ filter</div>
              <div className="mt-2 pt-2 border-t border-[var(--color-border-soft)] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase text-[var(--color-text-muted)]">LT TB</div>
                  <div className="tabular-nums font-medium">{formatHours(s.ltMedianH)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-[var(--color-text-muted)]">Success</div>
                  <div className="tabular-nums font-medium">
                    {formatPct(s.successRate, 1)}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
                ~{formatCompactInt(s.activeNV)} nhân viên active
              </div>
            </div>
          </button>
        ))}
      </section>

      {/* === Breakdown table cho chặng đang chọn === */}
      <Card
        title={`Breakdown ${stages.find((s) => s.stageKey === activeStage)?.stageLabel}`}
        subtitle="Top 50 BC/KTC theo số lượng tại chặng này. Sort cột bất kỳ để tìm node bottleneck."
      >
        <DataTable
          columns={breakdownColumns}
          data={breakdown}
          rowKey={(r) => r.bcOrKtc}
          searchable
          searchPlaceholder="Tìm BC / KTC..."
          pageSize={15}
        />
      </Card>
    </div>
  );
}

const breakdownColumns: Column<ReturnType<typeof getStageBreakdown>[number]>[] = [
  {
    key: "bcOrKtc",
    label: "BC / KTC",
    sortable: true,
    render: (r) => <span className="font-mono text-xs">{r.bcOrKtc}</span>,
  },
  {
    key: "type",
    label: "Loại",
    sortable: true,
  },
  {
    key: "region",
    label: "Vùng",
    sortable: true,
  },
  {
    key: "throughput",
    label: "Số lượng",
    align: "right",
    sortable: true,
    sortValue: (r) => r.throughput,
    render: (r) => formatCompactInt(r.throughput),
  },
  {
    key: "ltMedianH",
    label: "LT TB",
    align: "right",
    sortable: true,
    sortValue: (r) => r.ltMedianH,
    render: (r) => formatHours(r.ltMedianH),
  },
  {
    key: "successRate",
    label: "% Success",
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
