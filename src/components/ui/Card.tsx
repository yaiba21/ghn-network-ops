import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  padding?: "sm" | "md" | "none";
};

export function Card({
  title,
  subtitle,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  padding = "md",
}: Props) {
  const padCls = padding === "sm" ? "p-3" : padding === "md" ? "p-4" : "";
  const hasHeader = title !== undefined || actions !== undefined;
  return (
    <div
      className={cn(
        "border border-[var(--color-border)] rounded-md bg-white flex flex-col ghn-fade-in",
        "transition-shadow hover:shadow-sm",
        className,
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b border-[var(--color-border)]",
            padding === "sm" ? "px-3 py-2" : "px-4 py-3",
          )}
        >
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-[var(--color-text)] leading-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={cn(padCls, bodyClassName, "flex-1")}>{children}</div>
      {footer && (
        <div
          className={cn(
            "border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]",
            padding === "sm" ? "px-3 py-2" : "px-4 py-2",
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
