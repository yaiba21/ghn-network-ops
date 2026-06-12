"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReactNode } from "react";

export type SeriesType = "line" | "bar" | "area";

export type SeriesConfig = {
  key: string;
  label: string;
  color?: string;
  /** For type="combo" only. */
  type?: SeriesType;
  /** For stacked bars. */
  stackId?: string;
  /** For combo charts with dual axis. */
  yAxisId?: "left" | "right";
};

export type MetricChartProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  type: "line" | "bar" | "area" | "stacked-bar" | "combo";
  data: T[];
  xKey: string;
  series: SeriesConfig[];
  height?: number;
  xTickFormatter?: (v: string | number) => string;
  yTickFormatter?: (v: number) => string;
  tooltipValueFormatter?: (v: number, name: string) => string;
  /** Right Y-axis formatter (combo only). */
  rightYTickFormatter?: (v: number) => string;
  grid?: boolean;
  legend?: boolean;
  className?: string;
};

const DEFAULT_COLORS = [
  "#F97316", // orange (brand neutral)
  "#1F2937", // ink
  "#DC2626", // brand red
  "#0EA5E9", // sky
  "#10B981", // emerald
  "#A855F7", // violet
];

const AXIS_PROPS = {
  stroke: "#9CA3AF",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

type TipEntry = { name?: string | number; value?: number | string; color?: string };

function tooltipContent(
  active: boolean | undefined,
  payload: readonly TipEntry[] | undefined,
  label: string | number | undefined,
  format?: (v: number, name: string) => string,
): ReactNode {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-[var(--color-border)] rounded-md shadow-sm px-3 py-2 text-xs">
      <div className="text-[var(--color-text-muted)] mb-1">{String(label)}</div>
      <ul className="space-y-0.5">
        {payload.map((p, i) => {
          const num = typeof p.value === "number" ? p.value : Number(p.value);
          return (
            <li key={i} className="flex items-center gap-2 text-[var(--color-text)]">
              <span
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[var(--color-text-muted)]">{String(p.name ?? "")}:</span>
              <span className="font-medium tabular-nums">
                {Number.isFinite(num)
                  ? format
                    ? format(num, String(p.name ?? ""))
                    : num.toLocaleString("vi-VN")
                  : "-"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function MetricChart<T extends Record<string, unknown>>({
  type,
  data,
  xKey,
  series,
  height = 240,
  xTickFormatter,
  yTickFormatter,
  rightYTickFormatter,
  tooltipValueFormatter,
  grid = true,
  legend = false,
  className,
}: MetricChartProps<T>) {
  const colorAt = (i: number, override?: string) =>
    override ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];

  const commonAxes = (showRightAxis = false) => (
    <>
      {grid && <CartesianGrid stroke="#F0F0F0" vertical={false} />}
      <XAxis
        dataKey={xKey}
        {...AXIS_PROPS}
        tickFormatter={xTickFormatter as ((v: unknown) => string) | undefined}
        minTickGap={20}
      />
      <YAxis
        yAxisId="left"
        {...AXIS_PROPS}
        tickFormatter={yTickFormatter as ((v: number) => string) | undefined}
        width={50}
      />
      {showRightAxis && (
        <YAxis
          yAxisId="right"
          orientation="right"
          {...AXIS_PROPS}
          tickFormatter={
            (rightYTickFormatter as ((v: number) => string) | undefined) ??
            (yTickFormatter as ((v: number) => string) | undefined)
          }
          width={50}
        />
      )}
      <Tooltip
        cursor={{ stroke: "#E5E5E5", strokeWidth: 1 }}
        content={({ active, payload, label }) =>
          tooltipContent(
            active,
            payload as unknown as readonly TipEntry[] | undefined,
            label as string | number | undefined,
            tooltipValueFormatter,
          )
        }
      />
      {legend && (
        <Legend
          verticalAlign="top"
          align="right"
          height={24}
          iconType="rect"
          iconSize={10}
          wrapperStyle={{ fontSize: 11 }}
        />
      )}
    </>
  );

  return (
    <div className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer>
        {type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {commonAxes(false)}
            {series.map((s, i) => (
              <Line
                key={s.key}
                yAxisId="left"
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={colorAt(i, s.color)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {commonAxes(false)}
            {series.map((s, i) => {
              const color = colorAt(i, s.color);
              return (
                <Area
                  key={s.key}
                  yAxisId="left"
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.16}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              );
            })}
          </AreaChart>
        ) : type === "bar" || type === "stacked-bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {commonAxes(false)}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                yAxisId="left"
                dataKey={s.key}
                name={s.label}
                stackId={type === "stacked-bar" ? (s.stackId ?? "stack") : undefined}
                fill={colorAt(i, s.color)}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        ) : (
          // combo
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {commonAxes(series.some((s) => s.yAxisId === "right"))}
            {series.map((s, i) => {
              const color = colorAt(i, s.color);
              const yId = s.yAxisId ?? "left";
              if (s.type === "bar") {
                return (
                  <Bar
                    key={s.key}
                    yAxisId={yId}
                    dataKey={s.key}
                    name={s.label}
                    fill={color}
                    radius={[2, 2, 0, 0]}
                    isAnimationActive={false}
                  />
                );
              }
              if (s.type === "area") {
                return (
                  <Area
                    key={s.key}
                    yAxisId={yId}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={color}
                    fill={color}
                    fillOpacity={0.16}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                );
              }
              return (
                <Line
                  key={s.key}
                  yAxisId={yId}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
