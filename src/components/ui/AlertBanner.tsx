import { AlertTriangle, Info, XCircle } from "lucide-react";
import { cn, formatInt } from "@/lib/utils";
import type { AlertItem } from "@/lib/types";

const STYLES = {
  info: {
    bar: "bg-sky-50 border-sky-200",
    icon: "text-sky-600",
    text: "text-sky-900",
    Icon: Info,
  },
  warning: {
    bar: "bg-amber-50 border-amber-200",
    icon: "text-amber-600",
    text: "text-amber-900",
    Icon: AlertTriangle,
  },
  critical: {
    bar: "bg-red-50 border-red-200",
    icon: "text-red-600",
    text: "text-red-900",
    Icon: XCircle,
  },
};

export function AlertBanner({
  alerts,
  className,
}: {
  alerts: AlertItem[];
  className?: string;
}) {
  if (!alerts.length) return null;
  return (
    <div className={cn("space-y-2", className)}>
      {alerts.map((a) => {
        const s = STYLES[a.severity];
        return (
          <div
            key={a.id}
            className={cn(
              "flex items-start gap-3 px-3 py-2 border rounded-md text-sm",
              s.bar,
            )}
          >
            <s.Icon className={cn("w-4 h-4 mt-0.5 shrink-0", s.icon)} />
            <div className={cn("flex-1 min-w-0", s.text)}>
              {a.count !== undefined && (
                <span className="font-semibold tabular-nums">
                  {formatInt(a.count)}{" "}
                </span>
              )}
              <span>{a.title}</span>
              {a.hint && (
                <span className="ml-2 text-xs opacity-80">— {a.hint}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
