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
                    fillColor: b.color,
                    fillOpacity: isSel ? 0.6 : 0.4,
                    weight: isSel ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setActiveBc(b.bcCode) }}
                >
                  <LTooltip>{b.bcName}</LTooltip>
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
        <div className="text-[10px] text-[var(--color-text-muted)] mt-1">
          Bản đồ thật (OpenStreetMap). Mỗi ô = địa bàn 1 BC (không trùng nhau,
          ngăn bởi border — ước lượng kiểu Voronoi). Click ô để xem chi tiết.
          {data.bcs.length} BC tại {data.provinceName}.
        </div>
      </div>

      <div className="xl:w-80 shrink-0">
        {selected ? (
          <BcDetail bc={selected} />
        ) : (
          <div className="border border-dashed border-[var(--color-border)] rounded-md p-6 text-center text-xs text-[var(--color-text-muted)]">
            Click 1 BC trên bản đồ để xem: vùng, diện tích, loại kho, loại hình
            hoạt động, dịch vụ, loại hàng + số liệu đơn & ontime.
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
        <Attr label="Loại hình hoạt động" value={bc.loaiHoatDong} />
        <Attr label="Loại dịch vụ" value={bc.loaiDichVu} />
        <Attr label="Loại hàng" value={bc.loaiHangBc} />
      </div>

      {/* Số liệu */}
      <div className="pt-2 border-t border-[var(--color-border-soft)] grid grid-cols-2 gap-2">
        <Stat label="Đơn lấy" value={bc.donLay} />
        <Stat label="Đơn giao" value={bc.donGiao} />
        <Stat label="Đơn trong kho" value={bc.donTrongKho} />
        <Stat label="Sắp vận chuyển" value={bc.donSapVc} />
      </div>

      {/* Ontime */}
      <div className="pt-2 border-t border-[var(--color-border-soft)] space-y-2">
        <Ontime label="Ontime lấy hàng" value={bc.ontimeLay} />
        <Ontime label="Ontime giao hàng" value={bc.ontimeGiao} />
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
