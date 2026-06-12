import { Card } from "@/components/ui/Card";
import { cn, formatCompactInt, formatPct } from "@/lib/utils";
import type { ProvinceCoverageRow, RegionCode, Status } from "@/lib/types";

type Props = { rows: ProvinceCoverageRow[] };

const REGION_NAME: Record<RegionCode, string> = {
  bac: "Miền Bắc",
  trung: "Miền Trung",
  nam: "Miền Nam",
};

const STATUS_BG: Record<Status, string> = {
  green: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
  amber: "bg-amber-50 border-amber-200 hover:bg-amber-100",
  red: "bg-red-50 border-red-200 hover:bg-red-100",
};

const STATUS_TEXT: Record<Status, string> = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
};

/**
 * Province-level coverage display, grouped by region.
 * Replaces the full GeoJSON choropleth with a compact grid that still reads
 * geographically (region rows top → bottom). Click province → drill.
 */
export function ProvinceCoverageGrid({ rows }: Props) {
  const byRegion: Record<RegionCode, ProvinceCoverageRow[]> = {
    bac: [],
    trung: [],
    nam: [],
  };
  for (const r of rows) byRegion[r.regionCode].push(r);
  for (const key of Object.keys(byRegion) as RegionCode[]) {
    byRegion[key].sort((a, b) => a.coveredPct - b.coveredPct);
  }

  const totals: Record<RegionCode, { totalOrders: number; weightedCovered: number }> = {
    bac: { totalOrders: 0, weightedCovered: 0 },
    trung: { totalOrders: 0, weightedCovered: 0 },
    nam: { totalOrders: 0, weightedCovered: 0 },
  };
  for (const r of rows) {
    totals[r.regionCode].totalOrders += r.totalOrders;
    totals[r.regionCode].weightedCovered += r.coveredPct * r.totalOrders;
  }

  return (
    <Card
      title="Service coverage theo tỉnh"
      subtitle="% đơn có rule routing chuẩn (không phải fallback). Đỏ = cần ưu tiên xây rule. Hover xem chi tiết."
    >
      <div className="space-y-4">
        {(["bac", "trung", "nam"] as RegionCode[]).map((region) => {
          const provinces = byRegion[region];
          const regionTotalOrders = totals[region].totalOrders;
          const regionCoverage =
            regionTotalOrders > 0
              ? totals[region].weightedCovered / regionTotalOrders
              : 0;
          return (
            <div key={region}>
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
                  {REGION_NAME[region]} ·{" "}
                  <span className="normal-case text-[var(--color-text)] font-semibold tabular-nums">
                    {formatPct(regionCoverage)} TB
                  </span>
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                  {formatCompactInt(regionTotalOrders)} đơn/ngày
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {provinces.map((p) => (
                  <button
                    key={p.provinceCode}
                    type="button"
                    className={cn(
                      "text-left p-2.5 border rounded transition-colors",
                      STATUS_BG[p.status],
                    )}
                    title={`${p.provinceName} — ${formatPct(p.coveredPct)} coverage, ${formatPct(p.fallbackPct)} fallback`}
                  >
                    <div className="text-xs font-medium text-[var(--color-text)] truncate">
                      {p.provinceName}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold tabular-nums",
                        STATUS_TEXT[p.status],
                      )}
                    >
                      {formatPct(p.coveredPct)}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                      Fallback {formatPct(p.fallbackPct)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
