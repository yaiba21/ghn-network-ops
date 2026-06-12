import Link from "next/link";
import { AlertTriangle, Info, XCircle, ArrowRight } from "lucide-react";
import { cn, formatInt } from "@/lib/utils";
import type { AlertItem } from "@/lib/types";

const STYLES = {
  info: {
    Icon: Info,
    iconColor: "text-sky-600",
    dot: "bg-sky-500",
  },
  warning: {
    Icon: AlertTriangle,
    iconColor: "text-amber-600",
    dot: "bg-amber-500",
  },
  critical: {
    Icon: XCircle,
    iconColor: "text-red-600",
    dot: "bg-red-500",
  },
} as const;

/**
 * Compact alert feed — sorted by severity then time.
 * Clicking an alert jumps to the relevant page (via alert.href).
 */
export function AlertFeed({ alerts }: { alerts: AlertItem[] }) {
  if (!alerts.length) {
    return (
      <div className="border border-[var(--color-border)] rounded-md bg-white p-4 text-sm text-[var(--color-text-muted)]">
        Không có cảnh báo trong 24h qua.
      </div>
    );
  }

  // severity order: critical > warning > info
  const sevRank = { critical: 0, warning: 1, info: 2 } as const;
  const sorted = [...alerts].sort(
    (a, b) => sevRank[a.severity] - sevRank[b.severity],
  );

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-soft)]">
        <div className="text-sm font-semibold text-[var(--color-text)]">
          Cảnh báo 24h qua
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)]">
          Click để chuyển sang trang chi tiết
        </div>
      </div>
      <ul className="divide-y divide-[var(--color-border-soft)] max-h-[340px] overflow-y-auto">
        {sorted.map((a) => {
          const s = STYLES[a.severity];
          const Body = (
            <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--color-hover)] cursor-pointer">
              <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", s.dot)} />
              {a.time && (
                <span className="text-xs text-[var(--color-text-muted)] tabular-nums mt-0.5 shrink-0">
                  {a.time}
                </span>
              )}
              <div className="flex-1 min-w-0 text-sm text-[var(--color-text)]">
                {a.count !== undefined && (
                  <span className="font-semibold tabular-nums">
                    {formatInt(a.count)}{" "}
                  </span>
                )}
                <span>{a.title}</span>
                {a.hint && (
                  <span className="text-xs text-[var(--color-text-muted)] ml-2">
                    {a.hint}
                  </span>
                )}
              </div>
              {a.href && (
                <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 mt-1" />
              )}
            </div>
          );

          return (
            <li key={a.id}>
              {a.href ? (
                <Link href={a.href} className="block">
                  {Body}
                </Link>
              ) : (
                Body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
