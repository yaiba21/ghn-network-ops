import { cn } from "@/lib/utils";
import { STATUS_LABEL_VI, STATUS_TOKENS } from "@/lib/kpi-config";
import type { Status } from "@/lib/types";
import { StatusDot } from "./StatusDot";

type Props = {
  status: Status;
  label?: string;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
};

export function StatusBadge({
  status,
  label,
  size = "sm",
  showDot = true,
  className,
}: Props) {
  const tokens = STATUS_TOKENS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        tokens.bg,
        tokens.border,
        tokens.text,
        className,
      )}
    >
      {showDot && <StatusDot status={status} size={6} />}
      <span className="truncate">{label ?? STATUS_LABEL_VI[status]}</span>
    </span>
  );
}
