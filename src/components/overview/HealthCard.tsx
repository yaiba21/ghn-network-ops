import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn, formatValue } from "@/lib/utils";
import type { ModuleHealthItem } from "@/lib/types";
import { StatusDot } from "@/components/ui/StatusDot";

const BORDER_BY_STATUS = {
  green: "border-l-emerald-500",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
} as const;

export function HealthCard({ item }: { item: ModuleHealthItem }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group border border-[var(--color-border)] border-l-4 rounded-md bg-white p-3 flex flex-col gap-1.5",
        "hover:bg-[var(--color-hover)] transition-colors",
        BORDER_BY_STATUS[item.status],
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium truncate">
          {item.module}
        </div>
        <StatusDot status={item.status} />
      </div>
      <div className="text-2xl font-semibold tabular-nums text-[var(--color-text)] leading-none">
        {formatValue(item.value, item.unit)}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="truncate">{item.metricLabel}</span>
        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  );
}
