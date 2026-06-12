import { cn, formatHours } from "@/lib/utils";
import type { LeadTimeBox } from "@/lib/types";

type Props = {
  rows: LeadTimeBox[];
  className?: string;
};

/**
 * Horizontal box plot — one row per stage.
 * Visualizes P10/P50/P90/P99 + outlier dots, with SLA target line.
 * Render is pure SVG, no library.
 */
export function BoxPlot({ rows, className }: Props) {
  if (!rows.length) return null;

  // Common scale across all rows = max of (p99, sla, outliers).
  const max = Math.max(
    ...rows.flatMap((r) => [r.p99, r.sla, ...(r.outliers ?? [0])]),
  );
  const padded = max * 1.08;

  const labelWidth = 180;
  const valueWidth = 110;
  const rowHeight = 36;
  const plotPaddingX = 8;
  const totalHeight = rows.length * rowHeight + 24;

  return (
    <div className={cn("w-full", className)}>
      <svg
        viewBox={`0 0 800 ${totalHeight}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: totalHeight }}
        role="img"
        aria-label="Lead time per stage box plot"
      >
        {/* Axis ticks at top */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const xPlot = labelWidth + plotPaddingX + (800 - labelWidth - valueWidth - 2 * plotPaddingX) * t;
          const label = formatHours(padded * t);
          return (
            <g key={t}>
              <line
                x1={xPlot}
                x2={xPlot}
                y1={20}
                y2={totalHeight - 4}
                stroke="#F3F4F6"
                strokeWidth={1}
              />
              <text x={xPlot} y={14} textAnchor="middle" fontSize="9" fill="#9CA3AF">
                {label}
              </text>
            </g>
          );
        })}

        {rows.map((r, i) => {
          const y = 24 + i * rowHeight;
          const yMid = y + rowHeight / 2;
          const plotMinX = labelWidth + plotPaddingX;
          const plotMaxX = 800 - valueWidth - plotPaddingX;
          const plotWidth = plotMaxX - plotMinX;

          const scale = (v: number) => plotMinX + (v / padded) * plotWidth;

          const x10 = scale(r.p10);
          const x50 = scale(r.p50);
          const x90 = scale(r.p90);
          const x99 = scale(r.p99);
          const xSla = scale(r.sla);

          // Box covers p10..p90, with median at p50.
          const boxColor =
            r.p90 <= r.sla ? "#10B981" : r.p50 <= r.sla ? "#F59E0B" : "#EF4444";

          return (
            <g key={r.stage}>
              {/* Label */}
              <text
                x={labelWidth - 8}
                y={yMid + 4}
                textAnchor="end"
                fontSize="11"
                fill="#1F2937"
                fontWeight="500"
              >
                {r.stage}
              </text>

              {/* Whisker line p10..p99 */}
              <line
                x1={x10}
                x2={x99}
                y1={yMid}
                y2={yMid}
                stroke="#9CA3AF"
                strokeWidth={1}
              />
              {/* Whisker caps */}
              <line x1={x10} x2={x10} y1={yMid - 5} y2={yMid + 5} stroke="#9CA3AF" />
              <line x1={x99} x2={x99} y1={yMid - 5} y2={yMid + 5} stroke="#9CA3AF" />

              {/* Box p10..p90 */}
              <rect
                x={x10}
                y={yMid - 8}
                width={x90 - x10}
                height={16}
                fill={boxColor}
                fillOpacity={0.18}
                stroke={boxColor}
                strokeWidth={1.5}
                rx={2}
              />
              {/* Median tick */}
              <line
                x1={x50}
                x2={x50}
                y1={yMid - 9}
                y2={yMid + 9}
                stroke={boxColor}
                strokeWidth={2}
              />

              {/* SLA marker — dashed vertical */}
              <line
                x1={xSla}
                x2={xSla}
                y1={y + 4}
                y2={y + rowHeight - 4}
                stroke="#DC2626"
                strokeWidth={1}
                strokeDasharray="3,2"
              />

              {/* Outlier dots */}
              {(r.outliers ?? []).map((o, k) => (
                <circle
                  key={k}
                  cx={scale(o)}
                  cy={yMid}
                  r={2.5}
                  fill="#DC2626"
                  fillOpacity={0.6}
                />
              ))}

              {/* P50 value text right side */}
              <text
                x={800 - plotPaddingX}
                y={yMid + 4}
                textAnchor="end"
                fontSize="11"
                fill="#1F2937"
                fontWeight="500"
                className="tabular-nums"
              >
                P50 {formatHours(r.p50)} · P90 {formatHours(r.p90)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 bg-emerald-200 border border-emerald-500 rounded-sm" />
          P90 ≤ SLA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 bg-amber-200 border border-amber-500 rounded-sm" />
          P50 ≤ SLA &lt; P90
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 bg-red-200 border border-red-500 rounded-sm" />
          P50 &gt; SLA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 border-t-2 border-dashed border-red-600" />
          SLA target
        </span>
      </div>
    </div>
  );
}
