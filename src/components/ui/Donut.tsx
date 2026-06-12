"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ReactNode } from "react";

type Slice = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type Props = {
  data: Slice[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  /** Renders inside the donut hole — typically total + caption. */
  centerLabel?: ReactNode;
  valueFormatter?: (v: number) => string;
};

export function Donut({
  data,
  height = 220,
  innerRadius = 60,
  outerRadius = 95,
  centerLabel,
  valueFormatter = (v) => v.toLocaleString("vi-VN"),
}: Props) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            stroke="#ffffff"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0];
              const v = typeof p.value === "number" ? p.value : Number(p.value);
              return (
                <div className="bg-white border border-[var(--color-border)] rounded-md shadow-sm px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 text-[var(--color-text)]">
                    <span
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: (p as { payload: Slice }).payload.color }}
                    />
                    <span className="text-[var(--color-text-muted)]">
                      {(p as { payload: Slice }).payload.label}:
                    </span>
                    <span className="font-medium tabular-nums">
                      {valueFormatter(v)}
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel}
        </div>
      )}
    </div>
  );
}
