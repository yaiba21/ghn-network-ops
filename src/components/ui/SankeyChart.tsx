"use client";

import {
  ResponsiveContainer,
  Sankey,
  Tooltip,
  Layer,
  Rectangle,
} from "recharts";
import type { SankeyData } from "@/lib/aggregators";
import { formatCompactInt } from "@/lib/utils";

type Props = {
  data: SankeyData;
  height?: number;
};

// Màu node theo loại (success xanh, fail đỏ, neutral xám/cam)
const NODE_COLOR: Record<string, string> = {
  "Tạo đơn": "#1F2937",
  "Đã lấy": "#0EA5E9",
  Huỷ: "#9CA3AF",
  "Nhập KTC": "#8B5CF6",
  "Tại BC giao": "#F59E0B",
  "Giao thành công": "#10B981",
  "Giao thất bại": "#EF4444",
  "Trả thành công": "#F59E0B",
  "Trả thất bại": "#B91C1C",
  "Thất lạc / Exception": "#7F1D1D",
  "Đang xử lý": "#9CA3AF",
};

type NodeProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
  payload: { name: string; value: number };
  containerWidth?: number;
};

function SankeyNode(props: NodeProps) {
  const { x, y, width, height, payload, containerWidth = 760 } = props;
  const color = NODE_COLOR[payload.name] ?? "#6B7280";
  const isRight = x + width + 180 > containerWidth;
  const labelX = isRight ? x - 6 : x + width + 6;
  const anchor = isRight ? "end" : "start";
  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={Math.max(2, height)}
        fill={color}
        fillOpacity={0.9}
        radius={[2, 2, 2, 2]}
      />
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={11}
        fontWeight={600}
        fill="#1F2937"
      >
        {payload.name}
      </text>
      <text
        x={labelX}
        y={y + height / 2 + 13}
        textAnchor={anchor}
        dominantBaseline="middle"
        fontSize={10}
        fill="#6B7280"
      >
        {formatCompactInt(payload.value)} đơn
      </text>
    </Layer>
  );
}

export function SankeyChart({ data, height = 420 }: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <Sankey
          data={data}
          nodePadding={28}
          nodeWidth={14}
          linkCurvature={0.5}
          margin={{ top: 10, right: 160, bottom: 10, left: 10 }}
          node={(nodeProps: object) => (
            <SankeyNode {...(nodeProps as NodeProps)} />
          )}
          link={{ stroke: "#cbd5e1", strokeOpacity: 0.45 }}
        >
          <Tooltip
            formatter={(v) => [`${formatCompactInt(Number(v))} đơn`, ""]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e5e5e5",
            }}
          />
        </Sankey>
      </ResponsiveContainer>
    </div>
  );
}
