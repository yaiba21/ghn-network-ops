import { cn } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";
import type { Status } from "@/lib/types";

type Props = {
  status: Status;
  size?: 6 | 8 | 10;
  className?: string;
};

const SIZE: Record<number, string> = {
  6: "w-1.5 h-1.5",
  8: "w-2 h-2",
  10: "w-2.5 h-2.5",
};

export function StatusDot({ status, size = 8, className }: Props) {
  return (
    <span
      aria-label={`status ${status}`}
      className={cn(
        "inline-block rounded-full shrink-0",
        SIZE[size],
        STATUS_TOKENS[status].dot,
        className,
      )}
    />
  );
}
