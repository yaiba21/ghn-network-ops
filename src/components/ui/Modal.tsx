"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  widthClass?: string;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  widthClass = "max-w-4xl",
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "relative bg-white rounded-lg shadow-2xl border border-[var(--color-border)] w-full ghn-fade-in mt-4",
          widthClass,
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-[var(--color-border)] sticky top-0 bg-white rounded-t-lg z-10">
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-semibold text-[var(--color-text)] leading-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="p-1.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
