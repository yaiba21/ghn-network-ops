"use client";

import { useState } from "react";
import type { TerritoryBc, TerritoryMapData } from "@/lib/aggregators";
import { cn, formatCompactInt, formatPct } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";

type Props = {
  data: TerritoryMapData;
  height?: number;
};

export function TerritoryMap({ data, height = 520 }: Props) {
  const W = 640;
  const H = height;
  const [activeBc, setActiveBc] = useState<string | null>(null);
  const selected: TerritoryBc | undefined =
    data.bcs.find((b) => b.bcCode === activeBc) ?? undefined;

  const toPath = (poly: { x: number; y: number }[]) =>
    poly
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x * W} ${p.y * H}`)
      .join(" ") + " Z";

  return (
    <div className="flex flex-col xl:flex-row gap-4">
      {/* Map */}
      <div className="flex-1 min-w-0">
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          className="border border-[var(--color-border)] rounded-md bg-[#eef2f6]"
          style={{ maxHeight: H }}
        >
          {/* Coverage polygons */}
          {data.bcs.map((b) => {
            const dim = activeBc && activeBc !== b.bcCode;
            const isSel = activeBc === b.bcCode;
            return (
              <path
                key={b.bcCode}
                d={toPath(b.polygon)}
                fill={b.color}
                fillOpacity={dim ? 0.12 : isSel ? 0.55 : 0.32}
                stroke={b.color}
                strokeWidth={isSel ? 2.5 : 1}
                strokeOpacity={dim ? 0.3 : 0.9}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setActiveBc(b.bcCode)}
              />
            );
          })}
          {/* Pins */}
          {data.bcs.map((b) => {
            const isSel = activeBc === b.bcCode;
            return (
              <g
                key={b.bcCode}
                className="cursor-pointer"
                onMouseEnter={() => setActiveBc(b.bcCode)}
              >
                <circle
                  cx={b.cx * W}
                  cy={b.cy * H}
                  r={isSel ? 6 : 4}
                  fill="#1e3a5f"
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              </g>
            );
          })}
        </svg>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Bản đồ phân chia địa bàn (schematic) — mỗi vùng màu = phạm vi hoạt động 1 BC.
          Hover để xem chi tiết. {data.bcs.length} BC tại {data.provinceName}.
        </div>
      </div>

      {/* Detail panel */}
      <div className="xl:w-80 shrink-0">
        {selected ? (
          <div className="border border-[var(--color-border)] rounded-md p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: selected.color }}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--color-text)] truncate">
                  {selected.bcName}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
                  {selected.bcCode}
                </div>
              </div>
              <span
                className={cn(
                  "ml-auto w-2 h-2 rounded-full",
                  STATUS_TOKENS[selected.status].dot,
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Đơn lấy" value={selected.donLay} />
              <Stat label="Đơn giao" value={selected.donGiao} />
              <Stat label="Đơn trong kho" value={selected.donTrongKho} />
              <Stat label="Sắp vận chuyển" value={selected.donSapVc} />
            </div>

            <div className="pt-2 border-t border-[var(--color-border-soft)] space-y-2">
              <OntimeRow label="Ontime lấy hàng" value={selected.ontimeLay} />
              <OntimeRow label="Ontime giao hàng" value={selected.ontimeGiao} />
            </div>
          </div>
        ) : (
          <div className="border border-dashed border-[var(--color-border)] rounded-md p-6 text-center text-xs text-[var(--color-text-muted)]">
            Hover 1 vùng / pin trên bản đồ để xem:
            <div className="mt-2 text-left inline-block space-y-0.5">
              <div>• Số đơn lấy / giao trong khu vực</div>
              <div>• Số đơn trong kho</div>
              <div>• Số đơn sắp được vận chuyển</div>
              <div>• Tỷ lệ ontime lấy + giao</div>
            </div>
          </div>
        )}

        {/* Tổng tỉnh */}
        <div className="mt-3 border border-[var(--color-border)] rounded-md p-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Tổng toàn {data.provinceName}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Đơn lấy" value={data.totalLay} />
            <Stat label="Đơn giao" value={data.totalGiao} />
            <Stat label="Trong kho" value={data.totalKho} />
            <Stat label="Sắp VC" value={data.totalSapVc} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--color-hover)] rounded p-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="text-lg font-semibold tabular-nums text-[var(--color-text)]">
        {formatCompactInt(value)}
      </div>
    </div>
  );
}

function OntimeRow({ label, value }: { label: string; value: number }) {
  const color =
    value >= 90 ? "text-emerald-600" : value >= 85 ? "text-amber-600" : "text-red-600";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className={cn("font-semibold tabular-nums", color)}>
          {formatPct(value, 1)}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--color-hover)] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            value >= 90
              ? "bg-[var(--color-status-green)]"
              : value >= 85
                ? "bg-[var(--color-status-amber)]"
                : "bg-[var(--color-status-red)]",
          )}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}
