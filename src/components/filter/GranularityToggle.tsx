"use client";

import { cn } from "@/lib/utils";
import type { Granularity } from "@/lib/types";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "daily", label: "Theo ngày" },
  { value: "weekly", label: "Theo tuần" },
  { value: "monthly", label: "Theo tháng" },
];

type Props = {
  value: Granularity;
  onChange: (v: Granularity) => void;
  className?: string;
};

export function GranularityToggle({ value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "inline-flex bg-white border border-[var(--color-border)] rounded-md p-0.5",
        className,
      )}
      role="tablist"
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 h-7 text-xs font-medium rounded transition-colors",
              active
                ? "bg-[var(--color-ghn-red-soft)] text-[var(--color-ghn-red)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
