"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiOption = { value: string; label: string };

type Props = {
  label?: string;
  values: string[];
  options: MultiOption[];
  onChange: (v: string[]) => void;
  emptyLabel?: string; // hiển thị khi chưa chọn gì (= tất cả)
  width?: number | string;
  searchable?: boolean;
  maxVisible?: number;
};

// Multi-select cho list lớn: search, checkbox, cap số dòng render. Rỗng = "tất cả".
export function MultiSelect({
  label,
  values,
  options,
  onChange,
  emptyLabel = "Tất cả",
  width = 220,
  searchable,
  maxVisible,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);

  const sel = new Set(values);
  const filteredAll = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const truncated = maxVisible != null && filteredAll.length > maxVisible;
  const filtered = truncated ? filteredAll.slice(0, maxVisible) : filteredAll;

  const buttonLabel = values.length === 0 ? emptyLabel : `${values.length} đã chọn`;

  const toggle = (v: string) => {
    onChange(sel.has(v) ? values.filter((x) => x !== v) : [...values, v]);
  };

  return (
    <div className="relative" ref={ref} style={{ width }}>
      {label && (
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">{label}</div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 inline-flex items-center justify-between gap-2 bg-white border border-[var(--color-border)] rounded-md hover:border-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-ghn-red)] text-sm"
      >
        <span className={cn("truncate text-left", values.length ? "text-[var(--color-text)]" : "text-[var(--color-text-faint)]")}>
          {buttonLabel}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
      </button>

      {open && (
        <div className="absolute z-[2000] mt-1 left-0 min-w-full max-h-72 overflow-auto bg-white border border-[var(--color-border)] rounded-md shadow-lg">
          {searchable && (
            <div className="p-2 border-b border-[var(--color-border)] sticky top-0 bg-white">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm..."
                className="w-full h-8 px-2 text-sm border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-ghn-red)]"
              />
            </div>
          )}
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] border-b border-[var(--color-border)]"
            >
              Bỏ chọn tất cả ({values.length})
            </button>
          )}
          <ul role="listbox" aria-multiselectable className="py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">Không có kết quả</li>
            ) : (
              filtered.map((o) => {
                const on = sel.has(o.value);
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(o.value)}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer",
                      on ? "bg-[var(--color-row-selected)] text-[var(--color-ghn-red)]" : "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {on && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </li>
                );
              })
            )}
            {truncated && (
              <li className="px-3 py-2 text-[11px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]">
                Hiển thị {maxVisible}/{filteredAll.length} — gõ để tìm thêm
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
