import { cn, formatPct } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";
import type { PulseGaugeData } from "@/lib/aggregators";

type Props = {
  data: PulseGaugeData;
  size?: number;
};

/**
 * Simple SVG gauge — semi-circle, fill theo value/max.
 * Hiển thị compact để fit nhiều gauge trong 1 row.
 */
export function PulseGauge({ data, size = 110 }: Props) {
  const radius = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -Math.PI;
  const endAngle = 0;
  const pct = Math.max(0, Math.min(100, data.value));
  const valueAngle = startAngle + ((endAngle - startAngle) * pct) / 100;

  const polarToCartesian = (angle: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const valueEnd = polarToCartesian(valueAngle);

  const arcBg = `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  const arcValue = `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${valueEnd.x} ${valueEnd.y}`;

  const statusStrokeColor =
    data.status === "green"
      ? "#10b981"
      : data.status === "amber"
        ? "#f59e0b"
        : "#ef4444";

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size / 2 + 12 }}>
        <svg width={size} height={size / 2 + 8} viewBox={`0 0 ${size} ${size / 2 + 8}`}>
          <path
            d={arcBg}
            stroke="#E5E7EB"
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={arcValue}
            stroke={statusStrokeColor}
            strokeWidth={8}
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none"
          style={{ bottom: 2 }}
        >
          <div className={cn("text-base font-semibold tabular-nums", STATUS_TOKENS[data.status].text)}>
            {data.unit === "%" ? formatPct(data.value, 1) : data.value}
          </div>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mt-0.5 text-center">
        {data.label}
      </div>
      <div className="text-[9px] text-[var(--color-text-faint)] tabular-nums">
        target {data.unit === "%" ? formatPct(data.target, 0) : data.target}
      </div>
    </div>
  );
}
