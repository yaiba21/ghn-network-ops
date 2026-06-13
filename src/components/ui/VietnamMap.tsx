"use client";

import { useState } from "react";
import type { MapNode, MapTripRoute } from "@/lib/aggregators";
import { cn } from "@/lib/utils";

type Props = {
  nodes: MapNode[];
  routes: MapTripRoute[];
  height?: number;
};

const ROUTE_COLOR: Record<string, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

// Bounding box VN (xấp xỉ) để project lat/lng → toạ độ SVG
const LAT_MAX = 23.4; // cực Bắc
const LAT_MIN = 8.5; // cực Nam
const LNG_MIN = 102; // cực Tây
const LNG_MAX = 110; // cực Đông

export function VietnamMap({ nodes, routes, height = 560 }: Props) {
  const width = 360;
  const pad = 30;

  const project = (lat: number, lng: number) => {
    const x =
      pad + ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * (width - 2 * pad);
    const y =
      pad + ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * (height - 2 * pad);
    return { x, y };
  };

  const [activeTrip, setActiveTrip] = useState<string | null>(null);
  const maxTp = Math.max(1, ...nodes.map((n) => n.throughput));

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Map SVG */}
      <div className="shrink-0">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="border border-[var(--color-border)] rounded-md bg-[#f8fafc]"
        >
          {/* khung toạ độ mờ */}
          <text x={pad} y={16} fontSize={9} fill="#9ca3af">
            Bắc ↑
          </text>
          <text x={pad} y={height - 8} fontSize={9} fill="#9ca3af">
            Nam ↓
          </text>

          {/* Routes (edges) */}
          {routes.map((r) => {
            const dim = activeTrip && activeTrip !== r.tripId;
            return (
              <g key={r.tripId} opacity={dim ? 0.12 : 1}>
                {r.stops.slice(0, -1).map((s, i) => {
                  const a = project(s.lat, s.lng);
                  const b = project(r.stops[i + 1].lat, r.stops[i + 1].lng);
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={ROUTE_COLOR[r.status]}
                      strokeWidth={activeTrip === r.tripId ? 2.5 : 1.3}
                      strokeOpacity={0.7}
                      markerEnd="url(#arrow)"
                    />
                  );
                })}
                {/* Stop points */}
                {r.stops.map((s) => {
                  const p = project(s.lat, s.lng);
                  return (
                    <circle
                      key={s.code + s.order}
                      cx={p.x}
                      cy={p.y}
                      r={activeTrip === r.tripId ? 4 : 2.5}
                      fill={ROUTE_COLOR[r.status]}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* KTC nodes */}
          {nodes.map((n) => {
            const p = project(n.lat, n.lng);
            const r = 3 + (n.throughput / maxTp) * 9;
            return (
              <g key={n.code}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill="#F97316"
                  fillOpacity={0.85}
                  stroke="#fff"
                  strokeWidth={1}
                />
              </g>
            );
          })}

          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>
        </svg>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#F97316]" /> KTC
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-[#10b981]" /> ontime
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-0.5 bg-[#ef4444]" /> trễ
          </span>
        </div>
      </div>

      {/* Trip list — hover/click để highlight tuyến */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
          {routes.length} tuyến linehaul (KTC ↔ KTC) — hover để highlight
        </div>
        <div className="space-y-1 max-h-[520px] overflow-auto pr-1">
          {routes.map((r) => (
            <button
              key={r.tripId}
              type="button"
              onMouseEnter={() => setActiveTrip(r.tripId)}
              onMouseLeave={() => setActiveTrip(null)}
              className={cn(
                "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded border text-xs text-left transition-colors",
                activeTrip === r.tripId
                  ? "border-[var(--color-ghn-red)] bg-[var(--color-row-selected)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-hover)]",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: ROUTE_COLOR[r.status] }}
                />
                <span className="font-mono text-[11px] truncate">
                  {r.stops[0].code} → {r.stops[r.stops.length - 1].code}
                </span>
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 font-mono">
                {r.tripId.slice(-8)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
