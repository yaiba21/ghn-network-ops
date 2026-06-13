"use client";

import { useMemo } from "react";
import type { NetworkGraphEdge, NetworkGraphNode } from "@/lib/aggregators";
import { formatCompactInt } from "@/lib/utils";

type Props = {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
  height?: number;
};

const EDGE_COLOR: Record<string, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

/**
 * Network graph đơn giản — KTC nodes xếp vòng tròn, lane edges nối.
 * Node size = throughput, edge color = ontime status, edge width = số trip.
 */
export function NetworkGraph({ nodes, edges, height = 420 }: Props) {
  const width = 760;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) / 2 - 70;

  const layout = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const n = nodes.length || 1;
    nodes.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      pos.set(node.code, {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });
    });
    return pos;
  }, [nodes, cx, cy, radius]);

  const maxThroughput = Math.max(1, ...nodes.map((n) => n.throughput));
  const maxTrips = Math.max(1, ...edges.map((e) => e.trips));

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[700px]"
      >
        {/* Edges */}
        {edges.map((e, i) => {
          const a = layout.get(e.from);
          const b = layout.get(e.to);
          if (!a || !b) return null;
          const w = 0.5 + (e.trips / maxTrips) * 3;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={EDGE_COLOR[e.status]}
              strokeWidth={w}
              strokeOpacity={0.45}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const p = layout.get(node.code);
          if (!p) return null;
          const r = 6 + (node.throughput / maxThroughput) * 18;
          return (
            <g key={node.code}>
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill="#F97316"
                fillOpacity={0.85}
                stroke="#fff"
                strokeWidth={1.5}
              />
              <text
                x={p.x}
                y={p.y - r - 4}
                textAnchor="middle"
                fontSize={9}
                fill="#1F2937"
                fontWeight={600}
              >
                {node.code.replace("-KTC", "·")}
              </text>
              <text
                x={p.x}
                y={p.y + 3}
                textAnchor="middle"
                fontSize={8}
                fill="#fff"
                fontWeight={600}
              >
                {formatCompactInt(node.throughput)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-[#F97316]" /> KTC (size = throughput)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5" style={{ background: EDGE_COLOR.green }} /> Lane ontime ≥95%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5" style={{ background: EDGE_COLOR.amber }} /> 90–95%
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-0.5" style={{ background: EDGE_COLOR.red }} /> &lt;90%
        </span>
      </div>
    </div>
  );
}
