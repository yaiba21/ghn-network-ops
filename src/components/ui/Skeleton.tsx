import { cn } from "@/lib/utils";

/** Khối skeleton shimmer cơ bản. */
export function Skeleton({
  className,
}: {
  className?: string;
}) {
  return <div className={cn("ghn-skeleton", className)} />;
}

/** Skeleton cho 1 KPI card. */
export function KpiCardSkeleton() {
  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-4 space-y-2">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

/** Skeleton cho 1 Card có header + body. */
export function CardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white">
      <div className="px-4 py-3 border-b border-[var(--color-border)] space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className="p-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton trang dashboard — header + filter + KPI strip + 2 card. */
export function PageSkeleton({ kpis = 6 }: { kpis?: number }) {
  return (
    <div className="space-y-4">
      {/* header */}
      <div className="space-y-2 pb-4 border-b border-[var(--color-border)]">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-80" />
        <Skeleton className="h-3 w-96" />
      </div>
      {/* filter bar */}
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-36" />
        ))}
      </div>
      {/* kpi strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: kpis }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      {/* cards */}
      <CardSkeleton rows={6} />
      <CardSkeleton rows={4} />
    </div>
  );
}
