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

// Màu node theo loại (success xanh, fail đỏ, neutral xám/cam, trung chuyển tím)
const NODE_COLOR: Record<string, string> = {
  // Đầu vào / lấy hàng
  "Tạo đơn": "#1F2937",
  "Đã lấy": "#0EA5E9",
  "Huỷ đơn": "#9CA3AF",
  "Lấy thất bại": "#F87171",
  // Trung chuyển KTC + linehaul
  "Phân loại KTC": "#8B5CF6",
  "Vận chuyển LH": "#6366F1",
  "KTC đích": "#7C3AED",
  "Về BC giao": "#F59E0B",
  // Giao hàng
  "Đang phát": "#FB923C",
  "Giao TC": "#10B981",
  "Phát thất bại": "#EF4444",
  "Đang xử lý": "#9CA3AF",
  // Hoàn / exception
  "Lưu kho hoàn": "#D97706",
  "Giao TB (GTB)": "#DC2626",
  "Trả TC": "#F59E0B",
  "Trả TB": "#B91C1C",
  "Thất lạc": "#7F1D1D",
  Exception: "#A855F7",
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
  const cy = y + height / 2;
  // Node sát mép phải (terminal) → nhãn bên trái; còn lại → nhãn PHÍA TRÊN node
  // (canh giữa) để không đè ngang sang cột kế bên.
  const isRight = x + width + 150 > containerWidth;
  const rect = (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={Math.max(2, height)}
      fill={color}
      fillOpacity={0.9}
      radius={[2, 2, 2, 2]}
    />
  );

  if (isRight) {
    return (
      <Layer>
        {rect}
        <text x={x - 6} y={cy} textAnchor="end" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#1F2937">
          {payload.name}
        </text>
        <text x={x - 6} y={cy + 13} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6B7280">
          {formatCompactInt(payload.value)} đơn
        </text>
      </Layer>
    );
  }

  // Nhãn phía trên node, canh giữa theo trục x của node.
  const cx = x + width / 2;
  const topY = Math.max(16, y); // tránh tràn lên mép trên
  return (
    <Layer>
      {rect}
      <text x={cx} y={topY - 15} textAnchor="middle" fontSize={11} fontWeight={600} fill="#1F2937">
        {payload.name}
      </text>
      <text x={cx} y={topY - 4} textAnchor="middle" fontSize={9.5} fill="#6B7280">
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
          nodePadding={34}
          nodeWidth={14}
          linkCurvature={0.5}
          margin={{ top: 26, right: 120, bottom: 14, left: 14 }}
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
