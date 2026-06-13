import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn, formatPct, formatVND, formatInt } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";
import type { ModuleHealth } from "@/lib/aggregators";
import { StatusDot } from "./StatusDot";

type Props = {
  module: ModuleHealth;
  /** URL drill-down khi click. */
  href?: string;
};

const TONE: Record<ModuleHealth["key"], { stripe: string; accent: string }> = {
  "first-mile": { stripe: "bg-emerald-500", accent: "text-emerald-700" },
  "middle-mile": { stripe: "bg-violet-500", accent: "text-violet-700" },
  "last-mile": { stripe: "bg-amber-500", accent: "text-amber-700" },
  routing: { stripe: "bg-sky-500", accent: "text-sky-700" },
  transport: { stripe: "bg-rose-500", accent: "text-rose-700" },
};

function formatSub(value: number, format?: string, unit?: string): string {
  if (format === "vnd") return formatVND(value);
  if (format === "min") return `${formatInt(value)}'`;
  if (format === "pct") return formatPct(value, 1);
  return `${value}${unit ?? ""}`;
}

export function ModuleHealthCard({ module: m, href }: Props) {
  const tone = TONE[m.key];
  const card = (
    <div className="border border-[var(--color-border)] rounded-md bg-white overflow-hidden group">
      <div className={cn("h-1", tone.stripe)} />
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <StatusDot status={m.status} />
            <span className="text-sm font-semibold text-[var(--color-text)] truncate">
              {m.name}
            </span>
          </div>
          {href && (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-faint)] group-hover:text-[var(--color-text-muted)]" />
          )}
        </div>
        <div className="space-y-1.5">
          {m.subMetrics.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-[var(--color-text-muted)] truncate">
                {s.label}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    STATUS_TOKENS[s.status].text,
                  )}
                >
                  {formatSub(s.value, s.format, s.unit)}
                </span>
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    STATUS_TOKENS[s.status].dot,
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:shadow-sm transition-shadow">
      {card}
    </Link>
  ) : (
    card
  );
}
