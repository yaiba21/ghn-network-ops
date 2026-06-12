import type { ReactNode } from "react";
import { ChevronRight, Download, RefreshCw } from "lucide-react";
import { formatVNDateTime } from "@/lib/utils";
import { Button } from "./Button";

type Crumb = { label: string; href?: string };

type Props = {
  breadcrumb?: Crumb[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  updatedAt?: Date;
  showDefaultActions?: boolean;
};

export function PageHeader({
  breadcrumb,
  title,
  subtitle,
  actions,
  updatedAt,
  showDefaultActions = true,
}: Props) {
  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-[var(--color-border)]">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          {breadcrumb.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              {c.href ? (
                <a
                  href={c.href}
                  className="hover:text-[var(--color-text)] transition-colors"
                >
                  {c.label}
                </a>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-[var(--color-text)] leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
          {showDefaultActions && (
            <>
              <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
                Tải xuống dữ liệu
              </Button>
              <Button variant="primary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}>
                Cập nhật dữ liệu
              </Button>
            </>
          )}
        </div>
      </div>

      {updatedAt && (
        <div className="text-xs text-[var(--color-text-muted)]">
          Thời gian cập nhật lần cuối: {formatVNDateTime(updatedAt)}
        </div>
      )}
    </div>
  );
}
