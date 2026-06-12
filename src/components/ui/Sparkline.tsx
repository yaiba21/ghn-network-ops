import type { KpiDirection, Status } from "@/lib/types";

type Props = {
  data: number[];
  width?: number;
  height?: number;
  direction?: KpiDirection;
  status?: Status;
  className?: string;
};

const STATUS_STROKE: Record<Status, string> = {
  green: "var(--color-status-green)",
  amber: "var(--color-status-amber)",
  red: "var(--color-status-red)",
};

// Pure-SVG sparkline. No deps, server-renderable.
export function Sparkline({
  data,
  width = 96,
  height = 28,
  status,
  className,
}: Props) {
  if (data.length < 2) {
    return <div style={{ width, height }} className={className} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const stroke = status ? STATUS_STROKE[status] : "#6B7280";

  // Closed area path for subtle fill.
  const areaPath = `M0,${height} L${points
    .split(" ")
    .map((p) => p)
    .join(" L")} L${width},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="sparkline"
    >
      <path d={areaPath} fill={stroke} fillOpacity={0.08} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
