"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar } from "lucide-react";
import { cn, formatVNDate } from "@/lib/utils";
import { presetToRange } from "@/lib/filter";
import type { TimePreset } from "@/lib/types";

const PRESET_OPTIONS: { value: TimePreset; label: string }[] = [
  { value: "today", label: "Hôm nay" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
  { value: "custom", label: "Tuỳ chỉnh" },
];

type Props = {
  preset: TimePreset;
  from: string;
  to: string;
  onChange: (next: { preset: TimePreset; from: string; to: string }) => void;
  className?: string;
};

export function DateRangePicker({ preset, from, to, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const buttonLabel =
    preset === "custom"
      ? `${formatVNDate(from)} → ${formatVNDate(to)}`
      : (PRESET_OPTIONS.find((p) => p.value === preset)?.label ?? "Khoảng thời gian");

  return (
    <div className={cn("relative", className)} ref={ref}>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
        Khoảng thời gian
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 inline-flex items-center justify-between gap-2 bg-white border border-[var(--color-border)] rounded-md hover:border-[var(--color-text-faint)] focus:outline-none text-sm"
      >
        <span className="inline-flex items-center gap-2 truncate">
          <Calendar className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span className="truncate text-[var(--color-text)]">{buttonLabel}</span>
        </span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 right-0 min-w-[320px] bg-white border border-[var(--color-border)] rounded-md shadow-lg p-3">
          <div className="grid grid-cols-2 gap-1 mb-3">
            {PRESET_OPTIONS.map((opt) => {
              const active = opt.value === preset;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (opt.value === "custom") {
                      onChange({ preset: "custom", from, to });
                    } else {
                      const r = presetToRange(opt.value);
                      onChange({ preset: opt.value, from: r.from, to: r.to });
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    "h-8 px-3 text-sm rounded border text-left",
                    active
                      ? "bg-[var(--color-row-selected)] border-[var(--color-ghn-red)] text-[var(--color-ghn-red)]"
                      : "border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-hover)]",
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className={preset === "custom" ? "" : "opacity-50 pointer-events-none"}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) =>
                    onChange({ preset: "custom", from: e.target.value, to })
                  }
                  className="mt-1 w-full h-8 px-2 text-sm border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-ghn-red)]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) =>
                    onChange({ preset: "custom", from, to: e.target.value })
                  }
                  className="mt-1 w-full h-8 px-2 text-sm border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-ghn-red)]"
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 px-3 text-xs font-medium bg-[var(--color-ghn-red)] text-white rounded hover:opacity-90"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
