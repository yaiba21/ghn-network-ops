import { formatValue } from "@/lib/utils";
import type { OverviewGauge } from "@/lib/types";

const STROKE_BY_STATUS: Record<OverviewGauge["status"], string> = {
  green: "var(--color-status-green)",
  amber: "var(--color-status-amber)",
  red: "var(--color-status-red)",
};

/**
 * Semicircular SVG gauge: 180° arc, 0..1 progress.
 * - Background arc light gray, foreground arc colored by status.
 * - Target tick marker shows where target sits on the arc.
 */
export function Gauge({ gauge }: { gauge: OverviewGauge }) {
  const width = 180;
  const height = 110;
  const cx = width / 2;
  const cy = height - 10;
  const r = 78;

  // Convert progress 0..1 to angle (180° = π).
  const progressAngle = Math.PI * Math.min(1, Math.max(0, gauge.progress));
  // Convert target relative position (1.0 always — target is where we want to land):
  // Place tick at the target percentile = 1.0 → at the rightmost point of arc (angle π).
  // But we want progress vs target shown as a fill ratio; ignore separate tick.

  // Arc endpoints
  function polar(angle: number, radius: number) {
    return {
      x: cx + radius * Math.cos(Math.PI - angle),
      y: cy - radius * Math.sin(Math.PI - angle),
    };
  }
  const bgStart = polar(0, r);
  const bgEnd = polar(Math.PI, r);
  const fgEnd = polar(progressAngle, r);
  const largeArc = progressAngle > Math.PI ? 1 : 0;

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-4 flex flex-col items-center">
      <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium">
        {gauge.label}
      </div>
      <svg width={width} height={height} className="my-2">
        {/* Background arc */}
        <path
          d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 1 1 ${bgEnd.x} ${bgEnd.y}`}
          stroke="#E5E5E5"
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        {progressAngle > 0.001 && (
          <path
            d={`M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 ${largeArc} 1 ${fgEnd.x} ${fgEnd.y}`}
            stroke={STROKE_BY_STATUS[gauge.status]}
            strokeWidth={10}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {/* Center value */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-[var(--color-text)]"
          style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
        >
          {formatValue(gauge.value, gauge.unit)}
        </text>
      </svg>
      <div className="text-[11px] text-[var(--color-text-muted)] tabular-nums">
        Mục tiêu {formatValue(gauge.target, gauge.unit)}
      </div>
    </div>
  );
}
