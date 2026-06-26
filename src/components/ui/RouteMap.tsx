"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LTooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type RouteStop = { id: string; name: string | null; lat: number | null; lng: number | null };
export type TransportRoute = { code: string; region: string; stops: RouteStop[]; total: number; plottable: number };
export type BcPt = { id: string; name: string; lat: number | null; lng: number | null; loai?: string | null };

// bảng màu cho nhiều tuyến
const PALETTE = ["#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#0d9488", "#9333ea", "#0284c7"];

// phân loại BC (phân loại BC) → nhóm màu (theo yêu cầu nghiệp vụ)
export type LoaiGroup = "g1" | "g2" | "g3" | "g4" | "g5" | "g0";
const LOAI_TO_GROUP: Record<string, LoaiGroup> = {
  "Bưu cục": "g1",
  "Kho/Điểm giao hàng nặng": "g2", "Kho B2B": "g2", "Kho/Điểm Ahamove (AHM)": "g2",
  "Kho chuyển tiếp": "g3", "Kho trung chuyển": "g3", "Sorting Team / Kho Sort": "g3", "Điểm/Kho xử lý hàng & ngoại lệ": "g3", "Linehaul Team": "g3",
  "Điểm nhận hàng": "g4", "Điểm/Kho lấy hàng": "g4",
  "Kho đối tác / Brand": "g5", "Key Account Warehouse": "g5",
};
export function loaiGroup(loai?: string | null): LoaiGroup { return (loai && LOAI_TO_GROUP[loai]) || "g0"; }
export const LOAI_GROUP_COLOR: Record<LoaiGroup, string> = { g1: "#2563eb", g2: "#ea580c", g3: "#7c3aed", g4: "#16a34a", g5: "#db2777", g0: "#94a3b8" };
export const LOAI_GROUP_LABEL: Record<LoaiGroup, string> = {
  g1: "Bưu cục", g2: "Giao nặng / B2B / AHM", g3: "Trung chuyển / Sort / Xử lý / Linehaul", g4: "Nhận / Lấy hàng", g5: "Đối tác / Brand", g0: "Khác",
};
const LOAI_GROUP_ORDER: LoaiGroup[] = ["g1", "g2", "g3", "g4", "g5", "g0"];

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    const fit = () => { map.invalidateSize(); map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 }); };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [bounds, map]);
  return null;
}

export function RouteMap({
  routes, bcMarkers, focusCode, onPickRoute, height = 640, prominentBc = false,
}: {
  routes: TransportRoute[];
  bcMarkers: BcPt[];
  focusCode: string | null;
  onPickRoute: (code: string) => void;
  height?: number | string;
  prominentBc?: boolean; // true = BC là chủ thể (chấm to, màu) thay vì nền mờ
}) {
  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    const pts: [number, number][] = [];
    if (routes.length) for (const r of routes) for (const s of r.stops) if (s.lat != null) pts.push([s.lat, s.lng!]);
    if (!pts.length) for (const m of bcMarkers) if (m.lat != null) pts.push([m.lat, m.lng!]);
    if (!pts.length) return null;
    let a = 90, b = -90, c = 180, d = -180;
    for (const [lat, lng] of pts) { if (lat < a) a = lat; if (lat > b) b = lat; if (lng < c) c = lng; if (lng > d) d = lng; }
    return [[a, c], [b, d]];
  }, [routes, bcMarkers]);

  const showStops = focusCode != null || routes.length <= 3;

  // đếm BC theo nhóm loại (cho legend)
  const groupCounts = useMemo(() => {
    const c: Record<LoaiGroup, number> = { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g0: 0 };
    for (const m of bcMarkers) if (m.lat != null) c[loaiGroup(m.loai)]++;
    return c;
  }, [bcMarkers]);

  return (
    <div className="rounded-md overflow-hidden border border-[var(--color-border)] relative" style={{ height, minHeight: 480 }}>
      <MapContainer center={[16, 107]} zoom={6} scrollWheelZoom preferCanvas style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <FitBounds bounds={bounds} />

        {/* Vị trí BC — tô màu theo loại (phân loại BC). prominent = chủ thể (to), không = nền (nhỏ) */}
        {bcMarkers.map((m) => {
          if (m.lat == null) return null;
          const col = LOAI_GROUP_COLOR[loaiGroup(m.loai)];
          return (
            <CircleMarker key={`bc-${m.id}`} center={[m.lat, m.lng!]} radius={prominentBc ? 4 : 2.8}
              pathOptions={prominentBc
                ? { color: "#fff", weight: 1, fillColor: col, fillOpacity: 0.9 }
                : { color: col, weight: 0.4, fillColor: col, fillOpacity: 0.7 }}>
              <LTooltip>{m.id} - {m.name}{m.loai ? ` · ${m.loai}` : ""}</LTooltip>
            </CircleMarker>
          );
        })}

        {/* Tuyến tải */}
        {routes.flatMap((r, ri) => {
          const color = PALETTE[ri % PALETTE.length];
          const dim = focusCode != null && focusCode !== r.code;
          const line = r.stops.filter((s) => s.lat != null).map((s) => [s.lat!, s.lng!] as [number, number]);
          const els: React.ReactNode[] = [];
          if (line.length >= 2)
            els.push(<Polyline key={`${r.code}-line`} positions={line}
              pathOptions={{ color, weight: focusCode === r.code ? 4 : 2.5, opacity: dim ? 0.12 : 0.8 }}
              eventHandlers={{ click: () => onPickRoute(r.code) }} />);
          if (showStops && !dim) {
            let seq = 0;
            for (const s of r.stops) {
              if (s.lat == null) continue;
              seq += 1;
              const label = `${seq}. ${s.id}${s.name ? ` - ${s.name}` : ""}`;
              els.push(
                <CircleMarker key={`${r.code}-${s.id}-${seq}`} center={[s.lat, s.lng!]} radius={5}
                  pathOptions={{ color: "#fff", weight: 1.5, fillColor: color, fillOpacity: 1 }}
                  eventHandlers={{ click: () => onPickRoute(r.code) }}>
                  <LTooltip permanent={focusCode === r.code && r.plottable <= 14} direction="top" offset={[0, -5]}>
                    <span style={{ fontSize: 10 }}>{label}</span>
                  </LTooltip>
                </CircleMarker>,
              );
            }
          }
          return els;
        })}
      </MapContainer>

      {/* Legend loại BC (theo nhóm màu) */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-[var(--color-border)] rounded-md px-2.5 py-2 text-[10px] shadow-sm space-y-0.5 max-w-[230px]">
        <div className="font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-0.5">Loại địa điểm BC</div>
        {LOAI_GROUP_ORDER.filter((g) => groupCounts[g] > 0).map((g) => (
          <div key={g} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: LOAI_GROUP_COLOR[g] }} />
            <span className="text-[var(--color-text)]">{LOAI_GROUP_LABEL[g]}</span>
            <span className="ml-auto tabular-nums text-[var(--color-text-muted)]">{groupCounts[g].toLocaleString("vi-VN")}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
