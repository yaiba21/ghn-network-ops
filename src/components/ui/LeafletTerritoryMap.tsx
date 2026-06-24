"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  CircleMarker,
  Tooltip as LTooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TerritoryBc, TerritoryMapData } from "@/lib/aggregators";
import { cn, formatCompactInt, formatPct } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";

type Props = {
  data: TerritoryMapData;
  height?: number | string;
};

// Heatmap attention: đỏ = cần xử lý, vàng = theo dõi, xanh = ổn
const ATTN_FILL: Record<string, string> = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#ef4444",
};

type Ward = {
  code: string;
  name: string;
  positions: [number, number][][][]; // MultiPolygon [poly][ring][pt] = [lat,lng]
  cLat: number;
  cLng: number;
};

// Parse GeoJSON FeatureCollection (MultiPolygon, [lng,lat]) → Ward[] (Leaflet [lat,lng]).
function parseWards(geo: {
  features: {
    properties: { wardCode?: string; wardName?: string };
    geometry: { coordinates: number[][][][] };
  }[];
}): Ward[] {
  return geo.features.map((f) => {
    let sLat = 0, sLng = 0, n = 0;
    const positions = f.geometry.coordinates.map((poly) =>
      poly.map((ring) =>
        ring.map(([lng, lat]) => {
          sLat += lat; sLng += lng; n += 1;
          return [lat, lng] as [number, number];
        }),
      ),
    );
    return {
      code: String(f.properties.wardCode ?? ""),
      name: f.properties.wardName ?? "",
      positions,
      cLat: n ? sLat / n : 0,
      cLng: n ? sLng / n : 0,
    };
  });
}

// Gán mỗi ward về 1 BC: chọn K anchor (farthest-point) trên centroid ward,
// mỗi anchor = 1 BC, rồi ward → BC anchor gần nhất. Cho ranh giới thật mà vẫn
// thể hiện "phạm vi BC" + tô theo mức cần chú ý của BC đó.
function assignWardsToBcs(wards: Ward[], bcs: TerritoryBc[]) {
  const K = Math.min(bcs.length, wards.length);
  if (K === 0) return null;
  const d2 = (a: number, b: number) =>
    (wards[a].cLat - wards[b].cLat) ** 2 + (wards[a].cLng - wards[b].cLng) ** 2;
  const chosen = [0];
  const minD = wards.map((_, i) => d2(i, 0));
  while (chosen.length < K) {
    let far = -1, fd = -1;
    for (let i = 0; i < wards.length; i++) {
      if (minD[i] > fd) { fd = minD[i]; far = i; }
    }
    chosen.push(far);
    for (let i = 0; i < wards.length; i++) {
      const d = d2(i, far);
      if (d < minD[i]) minD[i] = d;
    }
  }
  const anchors = chosen.map((wi, a) => ({
    bc: bcs[a],
    lat: wards[wi].cLat,
    lng: wards[wi].cLng,
  }));
  const wardBc = new Map<string, TerritoryBc>();
  for (const w of wards) {
    let best = 0, bd = Infinity;
    for (let a = 0; a < anchors.length; a++) {
      const d = (w.cLat - anchors[a].lat) ** 2 + (w.cLng - anchors[a].lng) ** 2;
      if (d < bd) { bd = d; best = a; }
    }
    wardBc.set(w.code, anchors[best].bc);
  }
  return { anchors, wardBc };
}

// Auto-fit bản đồ vào phạm vi ward thật (đúng vị trí địa lý, bất kể PROVINCE_GEO).
function FitToWards({ wards }: { wards: Ward[] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!wards || wards.length === 0) return;
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const w of wards) {
      for (const poly of w.positions)
        for (const ring of poly)
          for (const [lat, lng] of ring) {
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
          }
    }
    map.fitBounds(
      [
        [minLat, minLng],
        [maxLat, maxLng],
      ],
      { padding: [16, 16] },
    );
  }, [wards, map]);
  return null;
}

export function LeafletTerritoryMap({ data, height = 560 }: Props) {
  const [activeBc, setActiveBc] = useState<string | null>(null);
  const [wards, setWards] = useState<Ward[] | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = data.bcs.find((b) => b.bcCode === activeBc);

  // Tải ranh giới phường thật của tỉnh (public/wards/{code}.geojson).
  useEffect(() => {
    let cancelled = false;
    setWards(null);
    setLoading(true);
    fetch(`/wards/${data.provinceCode}.geojson`)
      .then((r) => (r.ok ? r.json() : null))
      .then((geo) => {
        if (cancelled) return;
        setWards(geo ? parseWards(geo) : null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) { setWards(null); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [data.provinceCode]);

  const assign = useMemo(
    () => (wards ? assignWardsToBcs(wards, data.bcs) : null),
    [wards, data.bcs],
  );
  const useReal = !!(wards && assign);

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
          className="rounded-md overflow-hidden border border-[var(--color-border)] relative"
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
            {useReal && <FitToWards wards={wards} />}

            {/* Ranh giới phường THẬT, tô theo BC phụ trách */}
            {useReal &&
              wards!.map((w) => {
                const bc = assign!.wardBc.get(w.code);
                const isSel = !!bc && bc.bcCode === activeBc;
                return (
                  <Polygon
                    key={"w-" + w.code}
                    positions={w.positions}
                    pathOptions={{
                      color: "#ffffff",
                      fillColor: bc ? ATTN_FILL[bc.status] ?? "#9ca3af" : "#cbd5e1",
                      fillOpacity: isSel ? 0.8 : bc?.status === "green" ? 0.35 : 0.6,
                      weight: isSel ? 2 : 0.6,
                    }}
                    eventHandlers={{ click: () => bc && setActiveBc(bc.bcCode) }}
                  >
                    <LTooltip>
                      {w.name}
                      {bc ? ` · ${bc.bcName}` : ""}
                    </LTooltip>
                  </Polygon>
                );
              })}

            {/* Fallback: Voronoi cells (khi chưa/không có ward thật) */}
            {!useReal &&
              data.bcs.map((b) => {
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
                      {b.status === "red" ? "cần xử lý" : b.status === "amber" ? "theo dõi" : "ổn"}
                    </LTooltip>
                  </Polygon>
                );
              })}

            {/* BC markers (anchor ward thật nếu có, không thì vị trí ước lượng) */}
            {(useReal
              ? assign!.anchors.map((a) => ({ bc: a.bc, lat: a.lat, lng: a.lng }))
              : data.bcs.map((b) => ({ bc: b, lat: b.lat, lng: b.lng }))
            ).map(({ bc, lat, lng }) => (
              <CircleMarker
                key={bc.bcCode + "-m"}
                center={[lat, lng]}
                radius={activeBc === bc.bcCode ? 7 : 4}
                pathOptions={{ color: "#fff", fillColor: "#1e3a5f", fillOpacity: 1, weight: 1.5 }}
                eventHandlers={{ click: () => setActiveBc(bc.bcCode) }}
              >
                <LTooltip>{bc.bcName}</LTooltip>
              </CircleMarker>
            ))}
          </MapContainer>

          {loading && (
            <div className="absolute top-2 right-2 z-[1000] bg-white/90 border border-[var(--color-border)] rounded px-2 py-1 text-[10px] text-[var(--color-text-muted)]">
              Đang tải ranh giới phường…
            </div>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[var(--color-text-muted)]">
          <span className="font-medium uppercase tracking-wide">Mức cần chú ý:</span>
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
          {useReal
            ? `Ranh giới phường THẬT (${wards!.length} phường tại ${data.provinceName}), gán về BC phụ trách & tô theo mức cần chú ý. Click 1 phường để xem BC.`
            : `Bản đồ thật (OpenStreetMap). Phạm vi BC ước lượng kiểu Voronoi (chưa có ranh giới phường cho tỉnh này). ${data.bcs.length} BC tại ${data.provinceName}.`}
        </div>
      </div>

      <div className="xl:w-80 shrink-0">
        {selected ? (
          <BcDetail bc={selected} />
        ) : (
          <div className="border border-dashed border-[var(--color-border)] rounded-md p-6 text-center text-xs text-[var(--color-text-muted)]">
            Click 1 phường/BC trên bản đồ để xem: vùng, diện tích, loại kho, loại hình
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

      {/* Ontime lấy + giao */}
      <div className="pt-2 border-t border-[var(--color-border-soft)] space-y-2">
        <Ontime label="Ontime lấy hàng" value={bc.ontimeLay} />
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
