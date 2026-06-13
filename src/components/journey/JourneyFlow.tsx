"use client";

import { ChevronRight } from "lucide-react";
import { cn, formatCompactInt, formatPct } from "@/lib/utils";
import { StatusDot } from "@/components/ui/StatusDot";
import type { JourneyStageSummary } from "@/lib/types";

const TONE: Record<
  JourneyStageSummary["tone"],
  { bg: string; border: string; step: string; chip: string }
> = {
  green: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    step: "bg-emerald-600 text-white",
    chip: "bg-white border-emerald-200 text-emerald-800",
  },
  blue: {
    bg: "bg-sky-50",
    border: "border-sky-200",
    step: "bg-sky-600 text-white",
    chip: "bg-white border-sky-200 text-sky-800",
  },
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-200",
    step: "bg-violet-600 text-white",
    chip: "bg-white border-violet-200 text-violet-800",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    step: "bg-amber-600 text-white",
    chip: "bg-white border-amber-200 text-amber-800",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200",
    step: "bg-rose-600 text-white",
    chip: "bg-white border-rose-200 text-rose-800",
  },
};

type Props = {
  stages: JourneyStageSummary[];
  className?: string;
};

export function JourneyFlow({ stages, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-stretch gap-2 overflow-x-auto pb-1",
        className,
      )}
    >
      {stages.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1 shrink-0">
          <a
            href={`#stage-${s.key}`}
            className={cn(
              "block min-w-[200px] xl:min-w-[220px] border rounded-md p-3 hover:shadow-sm transition-shadow",
              TONE[s.tone].bg,
              TONE[s.tone].border,
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className={cn(
                  "w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center",
                  TONE[s.tone].step,
                )}
              >
                {s.step}
              </span>
              <span className="text-xs font-medium text-[var(--color-text)] truncate">
                {s.shortLabel}
              </span>
              <StatusDot status={s.status} className="ml-auto" />
            </div>
            <div className="text-xl font-semibold tabular-nums text-[var(--color-text)]">
              {formatPct(s.successRate)}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)] mt-1 tabular-nums">
              ~{formatCompactInt(s.throughput)} đơn/ngày (số lượng)
            </div>
          </a>
          {i < stages.length - 1 && (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-faint)] shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
