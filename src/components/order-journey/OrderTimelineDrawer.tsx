"use client";

import { useEffect } from "react";
import { X, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { cn, formatVNDateTime, formatHours } from "@/lib/utils";
import type { OrderTimeline } from "@/lib/types";

type Props = {
  timeline: OrderTimeline | null;
  onClose: () => void;
};

/** Slide-from-right drawer with full order timeline. */
export function OrderTimelineDrawer({ timeline, onClose }: Props) {
  // ESC to close.
  useEffect(() => {
    if (!timeline) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [timeline, onClose]);

  if (!timeline) return null;
  const { order, events, plannedPath, actualPath } = timeline;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Order timeline"
        className="fixed right-0 top-0 bottom-0 w-[480px] max-w-[100vw] z-50 bg-white border-l border-[var(--color-border)] shadow-xl flex flex-col"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)]">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              MVĐ {order.mvd}
            </div>
            <div className="text-lg font-semibold text-[var(--color-text)] truncate">
              {order.shop}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] tabular-nums mt-0.5">
              Tạo {formatVNDateTime(new Date(order.createdAt))} ·{" "}
              {order.serviceType.toUpperCase()}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-muted)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Status banner */}
        <div className="px-5 py-3 border-b border-[var(--color-border-soft)] flex items-center justify-between bg-[var(--color-table-head)]">
          <div className="text-xs text-[var(--color-text-muted)]">
            Trạng thái hiện tại
          </div>
          <div className="text-sm font-medium text-[var(--color-text)] font-mono">
            {order.currentState}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Planned vs actual paths */}
          <section className="px-5 py-4 border-b border-[var(--color-border-soft)]">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
              Planned vs actual path
            </div>
            <PathRow label="Planned" path={plannedPath} planned />
            <PathRow label="Actual" path={actualPath} />
          </section>

          {/* Vertical timeline of events */}
          <section className="px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] mb-3">
              Timeline ({events.length} sự kiện)
            </div>
            <ol className="relative pl-5 space-y-3">
              {events.map((e, i) => {
                const ts = new Date(e.ts);
                const plannedTs = e.plannedTs ? new Date(e.plannedTs) : null;
                const diffMin = plannedTs
                  ? (ts.getTime() - plannedTs.getTime()) / 60000
                  : null;
                const onTime = diffMin === null || Math.abs(diffMin) < 30;
                const Icon = e.failureReason
                  ? AlertTriangle
                  : onTime
                    ? CheckCircle2
                    : Clock;
                const iconColor = e.failureReason
                  ? "text-red-600"
                  : onTime
                    ? "text-emerald-600"
                    : "text-amber-600";
                return (
                  <li key={i} className="relative">
                    {/* Connector line */}
                    {i < events.length - 1 && (
                      <span
                        className="absolute -left-3.5 top-5 bottom-[-12px] w-px bg-[var(--color-border)]"
                        aria-hidden
                      />
                    )}
                    <Icon
                      className={cn(
                        "w-4 h-4 absolute -left-5 top-0.5",
                        iconColor,
                      )}
                    />
                    <div className="text-sm font-medium text-[var(--color-text)] font-mono">
                      {e.state}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {e.node}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] tabular-nums mt-0.5 flex items-center gap-2">
                      <span>{formatVNDateTime(ts)}</span>
                      {diffMin !== null && Math.abs(diffMin) >= 5 && (
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium",
                            diffMin > 0
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {diffMin > 0 ? "+" : ""}
                          {formatHours(diffMin / 60)} vs plan
                        </span>
                      )}
                    </div>
                    {e.failureReason && (
                      <div className="text-xs text-red-700 mt-1 bg-red-50 px-2 py-1 rounded">
                        {e.failureReason}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </aside>
    </>
  );
}

function PathRow({
  label,
  path,
  planned,
}: {
  label: string;
  path: string[];
  planned?: boolean;
}) {
  return (
    <div className="flex items-start gap-2 mb-1.5 last:mb-0">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mt-1 shrink-0 w-14">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 flex-1">
        {path.map((n, i) => (
          <span
            key={i}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
              planned
                ? "bg-[var(--color-hover)] text-[var(--color-text-muted)]"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200",
            )}
          >
            {n}
            {i < path.length - 1 && (
              <span className="text-[var(--color-text-faint)] ml-1">→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
