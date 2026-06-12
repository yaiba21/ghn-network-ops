"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type StageTone = "green" | "blue" | "violet" | "amber" | "rose" | "slate";

const STRIP_TONE: Record<StageTone, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

type Props = {
  step: number | string;
  label: string;
  description?: string;
  tone?: StageTone;
  anchorKey?: string;
  linkHref?: string;
  linkLabel?: string;
  actions?: ReactNode;
  className?: string;
};

export function StageHeader({
  step,
  label,
  description,
  tone = "slate",
  anchorKey,
  linkHref,
  linkLabel = "Xem chi tiết",
  actions,
  className,
}: Props) {
  return (
    <div
      id={anchorKey ? `stage-${anchorKey}` : undefined}
      className={cn(
        "scroll-mt-20 flex items-start justify-between gap-4 pt-2",
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className={cn(
            "w-7 h-7 shrink-0 rounded-md text-white font-semibold flex items-center justify-center text-sm",
            STRIP_TONE[tone],
          )}
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {label}
          </h2>
          {description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {linkHref && (
          <Link
            href={linkHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ghn-red)] hover:underline"
          >
            {linkLabel} <ExternalLink className="w-3 h-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
