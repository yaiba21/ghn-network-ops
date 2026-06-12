import { cn, formatInt, formatPct } from "@/lib/utils";
import type { FunnelStep } from "@/lib/types";

type Props = {
  steps: FunnelStep[];
  className?: string;
};

const STEP_COLOR = ["#1F2937", "#374151", "#4B5563", "#6B7280", "#9CA3AF"];

export function Funnel({ steps, className }: Props) {
  if (!steps.length) return null;
  const max = Math.max(...steps.map((s) => s.count));

  return (
    <div className={cn("space-y-2", className)}>
      {steps.map((s, i) => {
        const pct = max === 0 ? 0 : (s.count / max) * 100;
        const color = STEP_COLOR[Math.min(i, STEP_COLOR.length - 1)];
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-xs text-[var(--color-text)] truncate">
              {s.label}
            </div>
            <div className="flex-1 relative h-7 bg-[var(--color-hover)] rounded">
              <div
                className="absolute left-0 top-0 bottom-0 rounded transition-[width] duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
              <div
                className="absolute left-2 top-0 bottom-0 flex items-center text-xs font-medium tabular-nums"
                style={{
                  color: pct > 30 ? "white" : "var(--color-text)",
                }}
              >
                {formatInt(s.count)}
              </div>
            </div>
            <div className="w-24 shrink-0 text-right text-xs tabular-nums">
              {s.dropoffPct !== undefined ? (
                <span className="text-red-600">−{formatPct(s.dropoffPct)}</span>
              ) : (
                <span className="text-[var(--color-text-muted)]">khởi điểm</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
