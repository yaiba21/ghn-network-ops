"use client";

import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Tooltip as LTooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TerritoryBc, TerritoryMapData } from "@/lib/aggregators";
import { cn, formatCompactInt, formatPct } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";

type Props = {
  data: TerritoryMapData;
  height?: number;
};

// Heatmap attention: đỏ = cần xử lý, vàng = theo dõi, xanh = ổn
const ATTN_FILL: Record<string, string> = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#ef4444",
};

export function LeafletTerritoryMap({ data, height = 560 }: Props) {
  const [activeBc, setActiveBc] = useState<string | null>(null);
  const selected = data.bcs.find((b) => b.bcCode === activeBc);

  // Center = trung bình các BC
  const center: [number, number] =
    data.bcs.length > 0
      ? [
          data.bcs.reduce((a, b) => a + b.lat, 0) / data.bcs.length,
          data.bcs.reduce((a, b) => a + b.lng, 0) / data.bcs.length,
        ]
      : [16, 107];

  return (
    <div className="flex flex-col xl:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <div
          className="rounded-md overflow-hidden border border-[var(--color-border)]"
          style={{ height }}
        >
          <MapContainer
            key={data.provinceCode}
            center={center}
            zoom={11}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {data.bcs.map((b) => {
              if (b.cell.length < 3) return null;
              const isSel = activeBc === b.bcCode;
              return (
                <Polygon
                  key={b.bcCode + "-cell"}
                  positions={b.cell}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor: ATTN_FILL[b.status] ?? "#9ca3af",
                    fillOpacity: isSel ? 0.75 : b.status === "green" ? 0.32 : 0.55,
                    weight: isSel ? 3 : 1,
                  }}
                  eventHandlers={{ click: () => setActiveBc(b.bcCode) }}
                >
                  <LTooltip>
                    {b.bcName} —{" "}
                    {b.status === "red"
                      ? "cần xử lý"
                      : b.status === "amber"
                        ? "theo dõi"
                        : "ổn"}
                  </LTooltip>
                </Polygon>
              );
            })}
            {data.bcs.map((b) => (
              <CircleMarker
                key={b.bcCode + "-m"}
                center={[b.lat, b.lng]}
                radius={activeBc === b.bcCode ? 7 : 4.5}
                pathOptions={{
                  color: "#fff",
                  fillColor: "#1e3a5f",
                  fillOpacity: 1,
                  weight: 1.5,
                }}
                eventHandlers={{ click: () => setActiveBc(b.bcCode) }}
              >
                <LTooltip>{b.bcName}</LTooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--color-text-muted)]">
          <span className="font-medium uppercase tracking-wide">
            Mức cần chú ý:
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ background: ATTN_FILL.red, opacity: 0.55 }} />
            Cần xử lý
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ background: ATTN_FILL.amber, opacity: 0.55 }} />
            Theo dõi
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm" style={{ background: ATTN_FILL.green, opacity: 0.4 }} />
            Ổn
          </span>
        </div>
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Bản đồ thật (OpenStreetMap). Mỗi ô = phạm vi 1 BC (không trùng nhau,
          ngăn bởi border — ước lượng kiểu Voronoi), tô màu theo mức cần chú ý.
          Click ô để xem chi tiết. {data.bcs.length} BC tại {data.provinceName}.
        </div>
      </div>

      <div className="xl:w-80 shrink-0">
        {selected ? (
          <BcDetail bc={selected} />
        ) : (
          <div className="border border-dashed border-[var(--color-border)] rounded-md p-6 text-center text-xs text-[var(--color-text-muted)]">
            Click 1 BC trên bản đồ để xem: vùng, diện tích, loại kho, loại hình
            hoạt động, tồn kho (quá tải?) + %LTC / %GTC / đổi kho kèm WoW.
          </div>
        )}
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

function BcDetail({ bc }: { bc: TerritoryBc }) {
  return (
    <div className="border border-[var(--color-border)] rounded-md p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-sm shrink-0"
          style={{ backgroundColor: bc.color }}
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--color-text)] truncate">
            {bc.bcName}
          </div>
          <div className="text-[10px] text-[var(--color-text-muted)] font-mono">
            {bc.bcCode}
          </div>
        </div>
        <span className={cn("ml-auto w-2 h-2 rounded-full", STATUS_TOKENS[bc.status].dot)} />
      </div>

      {/* Thuộc tính kho */}
      <div className="space-y-1.5 text-xs">
        <Attr label="Vùng" value={bc.regionName} />
        <Attr label="Kho trực thuộc" value={bc.ktcCode} mono />
        <Attr label="Diện tích hoạt động" value={`${bc.areaKm2} km²`} />
        <Attr label="Loại kho" value={bc.loaiKho} />
        <Attr label="Loại hình" value={bc.loaiHoatDong} />
      </div>

      {/* Số liệu */}
      <div className="pt-2 border-t border-[var(--color-border-soft)] grid grid-cols-2 gap-2">
        <Stat label="Đơn lấy" value={bc.donLay} />
        <Stat label="Đơn giao" value={bc.donGiao} />
        <Stat label="Sắp vận chuyển" value={bc.donSapVc} />
        <KhoStat
          value={bc.donTrongKho}
          loadPct={bc.khoLoadPct}
          overload={bc.khoOverload}
        />
      </div>

      {/* Metrics + WoW */}
      <div className="pt-2 border-t border-[var(--color-border-soft)] space-y-1.5">
        <MetricWoW label="%LTC (ontime lấy)" value={bc.ontimeLay} wow={bc.ltcWow} />
        <MetricWoW label="%GTC" value={bc.pctGtc} wow={bc.gtcWow} />
        <MetricWoW label="Tỷ lệ đổi kho" value={bc.doiKho} wow={bc.doiKhoWow} lowerBetter />
      </div>

      {/* Ontime giao */}
      <div className="pt-2 border-t border-[var(--color-border-soft)]">
        <Ontime label="Ontime giao hàng" value={bc.ontimeGiao} />
      </div>
    </div>
  );
}

// Đơn trong kho + cảnh báo quá tải
function KhoStat({
  value,
  loadPct,
  overload,
}: {
  value: number;
  loadPct: number;
  overload: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded p-2",
        overload ? "bg-red-50 border border-red-200" : "bg-[var(--color-hover)]",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
          Đơn trong kho
        </span>
        <span
          className={cn(
            "text-[9px] font-semibold px-1 py-px rounded",
            overload
              ? "bg-red-600 text-white"
              : "bg-emerald-100 text-emerald-700",
          )}
        >
          {overload ? "Quá tải" : "Bình thường"}
        </span>
      </div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          overload ? "text-red-600" : "text-[var(--color-text)]",
        )}
      >
        {formatCompactInt(value)}
        <span className="ml-1 text-[10px] font-normal text-[var(--color-text-muted)]">
          {formatPct(loadPct, 0)} tồn
        </span>
      </div>
    </div>
  );
}

// 1 metric + chênh lệch WoW (điểm %)
function MetricWoW({
  label,
  value,
  wow,
  lowerBetter,
}: {
  label: string;
  value: number;
  wow: number;
  lowerBetter?: boolean;
}) {
  const improving = Math.abs(wow) < 0.05 ? null : lowerBetter ? wow < 0 : wow > 0;
  const wowColor =
    improving === null
      ? "text-[var(--color-text-muted)]"
      : improving
        ? "text-emerald-600"
        : "text-red-600";
  const arrow = Math.abs(wow) < 0.05 ? "→" : wow > 0 ? "▲" : "▼";
  const sign = wow > 0 ? "+" : wow < 0 ? "−" : "";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="font-semibold">{formatPct(value, 1)}</span>
        <span className={cn("text-[10px] font-medium w-16 text-right", wowColor)}>
          {arrow} {sign}
          {Math.abs(wow).toFixed(1).replace(".", ",")} pp
        </span>
      </div>
    </div>
  );
}

function Attr({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={cn("font-medium text-right", mono && "font-mono text-[11px]")}>
        {value}
      </span>
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

function Ontime({ label, value }: { label: string; value: number }) {
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
