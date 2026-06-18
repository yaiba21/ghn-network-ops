import { ArrowDownRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { cn, formatDelta, formatValue } from "@/lib/utils";
import type { KpiDirection, KpiUnit, Status } from "@/lib/types";
import { Sparkline } from "./Sparkline";
import { StatusDot } from "./StatusDot";

type Props = {
  label: string;
  value: number;
  unit: KpiUnit;
  deltaPct: number;
  sparkline?: number[];
  target?: number;
  status: Status;
  direction: KpiDirection;
  hint?: string;
  /** Giải thích công thức — hiện trong tooltip ℹ️ cạnh nhãn. */
  definition?: string;
  className?: string;
  /** Slim variant used inside dense compositional cards (e.g. paired stats). */
  size?: "md" | "sm";
};

/** Icon ℹ️ + tooltip hover hiện công thức/định nghĩa metric. */
function DefinitionTip({ text }: { text: string }) {
  return (
    <span className="group/def relative inline-flex shrink-0">
      <Info
        className="w-3 h-3 text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-help"
        aria-label="Giải thích chỉ số"
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 w-56 -translate-x-1/2 rounded-md border border-[var(--color-border)] bg-white px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-[var(--color-text)] opacity-0 shadow-lg transition-opacity duration-150 group-hover/def:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function KpiCard({
  label,
  value,
  unit,
  deltaPct,
  sparkline,
  target,
  status,
  direction,
  hint,
  definition,
  className,
  size = "md",
}: Props) {
  // Direction-aware coloring for delta: improvement vs regression
  const improving =
    direction === "higher-better" ? deltaPct >= 0 : deltaPct <= 0;
  const deltaColor =
    Math.abs(deltaPct) < 0.05
      ? "text-[var(--color-text-muted)]"
      : improving
        ? "text-emerald-600"
        : "text-red-600";

  const DeltaIcon =
    Math.abs(deltaPct) < 0.05
      ? Minus
      : deltaPct >= 0
        ? ArrowUpRight
        : ArrowDownRight;

  return (
    <div
      className={cn(
        "border border-[var(--color-border)] rounded-md bg-white",
        size === "md" ? "p-4" : "p-3",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
          <span className="truncate">{label}</span>
          {definition && <DefinitionTip text={definition} />}
        </div>
        <StatusDot status={status} />
      </div>

      <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
        <div
          className={cn(
            "font-semibold text-[var(--color-text)]",
            size === "md" ? "text-3xl" : "text-2xl",
          )}
        >
          {formatValue(value, unit)}
        </div>
        {target !== undefined && (
          <div className="text-xs text-[var(--color-text-muted)] truncate">
            mục tiêu {formatValue(target, unit)}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div
          className={cn(
            "flex items-center gap-0.5 text-xs font-medium tabular-nums",
            deltaColor,
          )}
        >
          <DeltaIcon className="w-3 h-3" />
          {formatDelta(deltaPct)}
          <span className="text-[var(--color-text-muted)] ml-1 font-normal">
            vs tuần trước
          </span>
        </div>
        {sparkline && sparkline.length > 0 && (
          <Sparkline
            data={sparkline}
            status={status}
            width={size === "md" ? 96 : 72}
            height={size === "md" ? 28 : 22}
          />
        )}
      </div>

      {hint && (
        <div className="mt-2 text-xs text-[var(--color-text-muted)]">{hint}</div>
      )}
    </div>
  );
}

// Convenience: build directly from a KpiValue object.
import type { KpiValue } from "@/lib/types";

export function KpiCardFrom({
  kpi,
  hint,
  className,
  size,
}: {
  kpi: KpiValue;
  hint?: string;
  className?: string;
  size?: "md" | "sm";
}) {
  return (
    <KpiCard
      label={kpi.label}
      value={kpi.value}
      unit={kpi.unit}
      deltaPct={kpi.deltaPct}
      sparkline={kpi.sparkline}
      target={kpi.target}
      status={kpi.status}
      direction={kpi.direction}
      hint={hint}
      definition={kpi.definition}
      className={className}
      size={size}
    />
  );
}
