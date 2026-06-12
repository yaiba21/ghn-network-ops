import { cn, formatCompactInt, formatPct } from "@/lib/utils";
import type { SankeyEdge } from "@/lib/types";

type Props = {
  edges: SankeyEdge[];
  className?: string;
};

/**
 * Simplified Sankey-like flow viz.
 * - Nodes auto-positioned in topological order (column = depth from any source).
 * - Edge thickness ∝ value.
 * - Failure edges rendered red.
 *
 * Not a proper layout-engine Sankey (no overlap avoidance), but readable for
 * GHN's ~10 states / linear order flow.
 */
export function Sankey({ edges, className }: Props) {
  // 1. Build nodes + assign column index by BFS from "ORDER_CREATED".
  const nodes = new Map<string, { col: number; inFlow: number; outFlow: number }>();
  for (const e of edges) {
    if (!nodes.has(e.source))
      nodes.set(e.source, { col: 0, inFlow: 0, outFlow: 0 });
    if (!nodes.has(e.target))
      nodes.set(e.target, { col: 0, inFlow: 0, outFlow: 0 });
  }
  // BFS: ORDER_CREATED at col 0, propagate max col.
  const adj: Record<string, string[]> = {};
  for (const e of edges) {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
  }
  const queue: [string, number][] = [["ORDER_CREATED", 0]];
  const seen = new Set<string>();
  while (queue.length) {
    const [n, depth] = queue.shift()!;
    const cur = nodes.get(n)!;
    if (depth > cur.col) cur.col = depth;
    if (seen.has(n + ":" + depth)) continue;
    seen.add(n + ":" + depth);
    for (const next of adj[n] ?? []) {
      queue.push([next, depth + 1]);
    }
  }

  // 2. Compute in/out flow per node.
  for (const e of edges) {
    nodes.get(e.source)!.outFlow += e.value;
    nodes.get(e.target)!.inFlow += e.value;
  }

  // 3. Group nodes by column for vertical layout.
  const cols: Record<number, string[]> = {};
  for (const [name, info] of nodes) {
    if (!cols[info.col]) cols[info.col] = [];
    cols[info.col].push(name);
  }
  const colKeys = Object.keys(cols)
    .map(Number)
    .sort((a, b) => a - b);

  // 4. Build positions.
  const width = 900;
  const height = 360;
  const colCount = colKeys.length;
  const padX = 70;
  const colWidth = (width - padX * 2) / (colCount - 1 || 1);

  const maxFlow = Math.max(
    ...[...nodes.values()].map((n) => Math.max(n.inFlow, n.outFlow)),
  );
  const minBar = 16;
  const maxBar = 220;
  const sizeFor = (flow: number) =>
    Math.max(minBar, (flow / maxFlow) * maxBar);

  const positions: Record<
    string,
    { x: number; y: number; h: number }
  > = {};
  for (const col of colKeys) {
    const names = cols[col];
    // Sort: failure-target nodes go to bottom.
    names.sort((a, b) => {
      const aIsFail = ["RETURNED", "LOST", "Cancelled"].includes(a) ? 1 : 0;
      const bIsFail = ["RETURNED", "LOST", "Cancelled"].includes(b) ? 1 : 0;
      return aIsFail - bIsFail;
    });
    let cursor = 30;
    for (const name of names) {
      const info = nodes.get(name)!;
      const flow = Math.max(info.inFlow, info.outFlow);
      const h = sizeFor(flow);
      const x = padX + col * colWidth;
      positions[name] = { x, y: cursor, h };
      cursor += h + 14;
    }
  }

  // 5. Draw.
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ minWidth: 800, height }}
        role="img"
        aria-label="Sankey order flow"
      >
        {/* Edges */}
        {edges.map((e, i) => {
          const s = positions[e.source];
          const t = positions[e.target];
          if (!s || !t) return null;
          const sx = s.x + 14;
          const tx = t.x;
          const cx = (sx + tx) / 2;
          const sy = s.y + s.h / 2;
          const ty = t.y + t.h / 2;
          const thickness = Math.max(2, (e.value / maxFlow) * 24);
          const stroke = e.isFailure
            ? "#DC2626"
            : e.value / maxFlow > 0.6
              ? "#1F2937"
              : "#9CA3AF";
          return (
            <path
              key={i}
              d={`M ${sx} ${sy} C ${cx} ${sy}, ${cx} ${ty}, ${tx} ${ty}`}
              stroke={stroke}
              strokeWidth={thickness}
              strokeOpacity={e.isFailure ? 0.7 : 0.4}
              fill="none"
            />
          );
        })}

        {/* Nodes */}
        {Object.entries(positions).map(([name, p]) => {
          const isFail = ["RETURNED", "LOST", "Cancelled"].includes(name);
          const info = nodes.get(name)!;
          const flow = Math.max(info.inFlow, info.outFlow);
          return (
            <g key={name}>
              <rect
                x={p.x}
                y={p.y}
                width={14}
                height={p.h}
                fill={isFail ? "#DC2626" : "#1F2937"}
                rx={2}
              />
              <text
                x={p.x + 22}
                y={p.y + p.h / 2 + 4}
                fontSize="10"
                fontWeight="500"
                fill="#1F2937"
              >
                {name}
              </text>
              <text
                x={p.x + 22}
                y={p.y + p.h / 2 + 16}
                fontSize="9"
                fill="#6B7280"
                className="tabular-nums"
              >
                {formatCompactInt(flow)} đơn
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
