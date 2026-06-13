import { AlertTriangle, Clock, FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Badge gắn vào KPI khi dữ liệu KHÔNG đủ tin cậy để hiển thị số.
 *
 * - `gap`     → công thức chưa chốt, KHÔNG được bịa số
 * - `conflict`→ 2 định nghĩa song song, đang chờ chốt
 * - `sample`  → số minh hoạ, sẽ thay bằng query thật
 */
export type MetricBadgeKind = "gap" | "conflict" | "sample";

type Props = {
  kind: MetricBadgeKind;
  label?: string;
  className?: string;
  size?: "xs" | "sm";
};

const TOKENS: Record<
  MetricBadgeKind,
  { bg: string; border: string; text: string; Icon: typeof Clock; defaultLabel: string }
> = {
  gap: {
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-700",
    Icon: Clock,
    defaultLabel: "chờ chốt công thức",
  },
  conflict: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    text: "text-amber-800",
    Icon: AlertTriangle,
    defaultLabel: "có 2 định nghĩa",
  },
  sample: {
    bg: "bg-sky-50",
    border: "border-sky-300",
    text: "text-sky-800",
    Icon: FileQuestion,
    defaultLabel: "số mẫu",
  },
};

export function MetricBadge({ kind, label, className, size = "xs" }: Props) {
  const t = TOKENS[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border font-medium",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs",
        t.bg,
        t.border,
        t.text,
        className,
      )}
      title={t.defaultLabel}
    >
      <t.Icon className="w-2.5 h-2.5 shrink-0" />
      <span className="truncate">{label ?? t.defaultLabel}</span>
    </span>
  );
}
