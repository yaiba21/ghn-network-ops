"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption<V extends string = string> = {
  value: V;
  label: string;
  hint?: string;
};

type Props<V extends string> = {
  value: V | undefined;
  options: SelectOption<V>[];
  onChange: (v: V) => void;
  placeholder?: string;
  label?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  searchable?: boolean;
  disabled?: boolean;
  align?: "left" | "right";
  width?: number | string;
  maxVisible?: number; // giới hạn số option render (list lớn) — gõ để tìm thêm
};

export function Select<V extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Chọn...",
  label,
  size = "md",
  className,
  searchable = false,
  disabled = false,
  align = "left",
  width,
  maxVisible,
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filteredAll = q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;
  const truncated = maxVisible != null && filteredAll.length > maxVisible;
  const filtered = truncated ? filteredAll.slice(0, maxVisible) : filteredAll;

  const heightCls = size === "sm" ? "h-8 text-xs" : "h-9 text-sm";

  return (
    <div className={cn("relative", className)} ref={rootRef} style={{ width }}>
      {label && (
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          {label}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 rounded-md bg-white border border-[var(--color-border)]",
          "hover:border-[var(--color-text-faint)] focus:outline-none focus:border-[var(--color-ghn-red)]",
          "disabled:bg-[var(--color-hover)] disabled:cursor-not-allowed",
          heightCls,
        )}
      >
        <span
          className={cn(
            "truncate text-left",
            selected ? "text-[var(--color-text)]" : "text-[var(--color-text-faint)]",
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-[2000] mt-1 min-w-full max-h-72 overflow-auto bg-white border border-[var(--color-border)] rounded-md shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {searchable && (
            <div className="p-2 border-b border-[var(--color-border)]">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm..."
                className="w-full h-8 px-2 text-sm border border-[var(--color-border)] rounded outline-none focus:border-[var(--color-ghn-red)]"
              />
            </div>
          )}
          <ul role="listbox" className="py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                Không có kết quả
              </li>
            ) : (
              filtered.map((o) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQ("");
                    }}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer",
                      isSelected
                        ? "bg-[var(--color-row-selected)] text-[var(--color-ghn-red)]"
                        : "text-[var(--color-text)] hover:bg-[var(--color-hover)]",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 shrink-0" />
                    ) : o.hint ? (
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                        {o.hint}
                      </span>
                    ) : null}
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
