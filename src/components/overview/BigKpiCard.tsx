import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, formatDelta, formatValue } from "@/lib/utils";
import type { KpiValue } from "@/lib/types";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusDot } from "@/components/ui/StatusDot";

const STATUS_LABEL: Record<KpiValue["status"], string> = {
  green: "On target",
  amber: "At risk",
  red: "Off target",
};

const STATUS_PILL: Record<KpiValue["status"], string> = {
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
};

type Props = {
  kpi: KpiValue;
  /** Optional second-line context (e.g. "Mục tiêu 95%"). */
  hint?: string;
};

/** Page 0 north-star card. Value font is ~48px, comes with 14-day sparkline + target pill. */
export function BigKpiCard({ kpi, hint }: Props) {
  const improving =
    kpi.direction === "higher-better" ? kpi.deltaPct >= 0 : kpi.deltaPct <= 0;
  const deltaColor =
    Math.abs(kpi.deltaPct) < 0.05
      ? "text-[var(--color-text-muted)]"
      : improving
        ? "text-emerald-600"
        : "text-red-600";
  const DeltaIcon =
    Math.abs(kpi.deltaPct) < 0.05
      ? Minus
      : kpi.deltaPct >= 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
          {kpi.label}
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wide font-medium border rounded",
            STATUS_PILL[kpi.status],
          )}
        >
          <StatusDot status={kpi.status} />
          {STATUS_LABEL[kpi.status]}
        </span>
      </div>

      <div className="text-[44px] leading-none font-semibold tabular-nums text-[var(--color-text)]">
        {formatValue(kpi.value, kpi.unit)}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "flex items-center gap-1 text-sm font-medium tabular-nums",
            deltaColor,
          )}
        >
          <DeltaIcon className="w-4 h-4" />
          {formatDelta(kpi.deltaPct)}
          <span className="text-[var(--color-text-muted)] ml-1 font-normal text-xs">
            vs kỳ trước
          </span>
        </div>
        <Sparkline data={kpi.sparkline} status={kpi.status} width={120} height={34} />
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
        <span>Mục tiêu {formatValue(kpi.target, kpi.unit)}</span>
        {hint && <span className="truncate">{hint}</span>}
      </div>
    </div>
  );
}
