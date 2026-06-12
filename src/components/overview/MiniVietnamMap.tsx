import { cn, formatCompactInt, formatPct, formatVND } from "@/lib/utils";
import type { RegionSnapshotRow, Status } from "@/lib/types";
import { StatusDot } from "@/components/ui/StatusDot";

const FILL_BY_STATUS: Record<Status, string> = {
  green: "#D1FAE5", // emerald-100
  amber: "#FEF3C7", // amber-100
  red: "#FEE2E2", // red-100
};

const STROKE_BY_STATUS: Record<Status, string> = {
  green: "#059669", // emerald-600
  amber: "#D97706", // amber-600
  red: "#DC2626", // red-600
};

/**
 * Simplified Vietnam silhouette split into 3 horizontal bands.
 * Not geographically accurate — purpose is glance recognition + region color.
 */
export function MiniVietnamMap({ rows }: { rows: RegionSnapshotRow[] }) {
  const map: Record<string, RegionSnapshotRow> = {};
  rows.forEach((r) => {
    map[r.regionCode] = r;
  });
  const bac = map["bac"];
  const trung = map["trung"];
  const nam = map["nam"];

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-[var(--color-text)]">
          Bản đồ vùng
        </div>
        <div className="text-[11px] text-[var(--color-text-muted)]">
          Màu theo health vùng (worst-of metric)
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Stylized Vietnam shape — 3 stacked region blobs */}
        <svg width="120" height="220" viewBox="0 0 120 220" className="shrink-0">
          {bac && (
            <>
              <path
                d="M 30 5 Q 55 0 75 12 L 88 38 Q 92 58 80 70 L 30 70 L 18 50 Q 16 25 30 5 Z"
                fill={FILL_BY_STATUS[bac.health]}
                stroke={STROKE_BY_STATUS[bac.health]}
                strokeWidth={1.5}
              />
              <text x="55" y="42" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1F2937">
                Bắc
              </text>
            </>
          )}
          {trung && (
            <>
              <path
                d="M 55 70 Q 70 78 78 90 L 84 130 Q 80 140 70 142 L 50 138 L 42 100 Q 44 80 55 70 Z"
                fill={FILL_BY_STATUS[trung.health]}
                stroke={STROKE_BY_STATUS[trung.health]}
                strokeWidth={1.5}
              />
              <text x="62" y="108" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1F2937">
                Trung
              </text>
            </>
          )}
          {nam && (
            <>
              <path
                d="M 50 142 Q 62 144 80 150 L 96 175 Q 95 200 75 210 L 35 208 Q 20 195 22 175 L 30 155 Q 38 145 50 142 Z"
                fill={FILL_BY_STATUS[nam.health]}
                stroke={STROKE_BY_STATUS[nam.health]}
                strokeWidth={1.5}
              />
              <text x="56" y="182" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1F2937">
                Nam
              </text>
            </>
          )}
        </svg>

        {/* Side table */}
        <div className="flex-1 min-w-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                <th className="text-left font-medium pb-2">Vùng</th>
                <th className="text-right font-medium pb-2">Volume</th>
                <th className="text-right font-medium pb-2">OTD</th>
                <th className="text-right font-medium pb-2">%TC</th>
                <th className="text-right font-medium pb-2">CPP</th>
                <th className="text-center font-medium pb-2">Health</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.regionCode}
                  className="border-t border-[var(--color-border-soft)]"
                >
                  <td className="py-2 font-medium text-[var(--color-text)]">
                    {r.regionName}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatCompactInt(r.volume)}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      r.otdPct < 92 && "text-[var(--color-status-red)] font-medium",
                      r.otdPct >= 92 && r.otdPct < 95 && "text-[var(--color-status-amber)]",
                    )}
                  >
                    {formatPct(r.otdPct)}
                  </td>
                  <td
                    className={cn(
                      "py-2 text-right tabular-nums",
                      r.gtcPct < 85 && "text-[var(--color-status-red)] font-medium",
                    )}
                  >
                    {formatPct(r.gtcPct)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatVND(r.costPerParcel)}
                  </td>
                  <td className="py-2 text-center">
                    <StatusDot status={r.health} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
