"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SERVICE_LABEL_VI, type ServiceType } from "@/lib/types";

const ALL: ServiceType[] = ["standard", "bulky", "express"];

type Props = {
  value: ServiceType[];
  onChange: (v: ServiceType[]) => void;
  className?: string;
};

export function ServiceTypeMulti({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const isAll = value.length === 0 || value.length === ALL.length;
  const buttonLabel = isAll
    ? "Tất cả dịch vụ"
    : value.map((s) => SERVICE_LABEL_VI[s]).join(", ");

  function toggle(s: ServiceType) {
    if (isAll) {
      // start fresh with just this one
      onChange([s]);
      return;
    }
    if (value.includes(s)) {
      const next = value.filter((x) => x !== s);
      onChange(next.length === 0 ? [] : next);
    } else {
      const next = [...value, s];
      onChange(next.length === ALL.length ? [] : next);
    }
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
        Loại dịch vụ
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 inline-flex items-center justify-between gap-2 bg-white border border-[var(--color-border)] rounded-md hover:border-[var(--color-text-faint)] text-sm"
      >
        <span className="truncate text-[var(--color-text)]">{buttonLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
      </button>
      {open && (
        <ul className="absolute z-50 mt-1 left-0 min-w-full bg-white border border-[var(--color-border)] rounded-md shadow-lg py-1">
          {ALL.map((s) => {
            const active = isAll || value.includes(s);
            return (
              <li
                key={s}
                onClick={() => toggle(s)}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer",
                  active
                    ? "text-[var(--color-ghn-red)] bg-[var(--color-row-selected)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
                )}
              >
                <span>{SERVICE_LABEL_VI[s]}</span>
                {active && <Check className="w-3.5 h-3.5" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
