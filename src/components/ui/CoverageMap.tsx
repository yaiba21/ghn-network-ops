"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  GeoJSON,
  Tooltip as LTooltip,
  useMap,
} from "react-leaflet";
import type { Layer, PathOptions, GeoJSON as LeafletGeoJSON } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CoverageBcLite, TerritoryBc } from "@/lib/aggregators";

type Dvhc = "new" | "old";
export type CoverageMode = "all" | "only";

// Màu polygon khác nhau theo ĐVHC: mới = xanh, cũ = cam
const COLORS: Record<Dvhc, { fill: string; line: string }> = {
  new: { fill: "#3b82f6", line: "#2563eb" },
  old: { fill: "#f97316", line: "#ea580c" },
};
const HILITE = { fill: "#dc2626", line: "#b91c1c" };   // phường được lọc/click
const CLICK = { fill: "#dc2626", line: "#7f1d1d" };    // phường vừa click (đậm nhất)
const BC_DOT = "#1e3a5f";
const BC_SEL = "#dc2626";

type Feat = {
  type: "Feature";
  properties: { wardCode?: string; wardName?: string; provinceName?: string };
  geometry: { type: string; coordinates: number[][][][] };
};
type Geo = { type: "FeatureCollection"; features: Feat[] };

type Assign = {
  wardBc: Map<string, number>;
  cnt: number[];
  area: number[];
  sumLat: number[];
  sumLng: number[];
  wardCount: number;
};

const COVERAGE_R_KM = 15;

function centroidOf(f: Feat): [number, number] {
  const ring = f.geometry.coordinates?.[0]?.[0];
  if (!ring || !ring.length) return [0, 0];
  let sx = 0, sy = 0;
  for (const [lng, lat] of ring) { sx += lat; sy += lng; }
  return [sx / ring.length, sy / ring.length];
}
function ringAreaKm2(ring: number[][]): number {
  if (ring.length < 3) return 0;
  let latSum = 0; for (const p of ring) latSum += p[1];
  const latRef = latSum / ring.length;
  const kx = 111.32 * Math.cos((latRef * Math.PI) / 180), ky = 110.574;
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const p1 = ring[i], p2 = ring[(i + 1) % ring.length];
    s += p1[0] * kx * (p2[1] * ky) - p2[0] * kx * (p1[1] * ky);
  }
  return Math.abs(s) / 2;
}
function featureAreaKm2(f: Feat): number {
  let total = 0;
  for (const poly of f.geometry.coordinates)
    for (let ri = 0; ri < poly.length; ri++) total += (ri === 0 ? 1 : -1) * ringAreaKm2(poly[ri]);
  return Math.max(0, total);
}
function featureBounds(f: Feat): [[number, number], [number, number]] {
  let a = 90, b = -90, c = 180, d = -180;
  for (const poly of f.geometry.coordinates)
    for (const ring of poly)
      for (const [lng, lat] of ring) {
        if (lat < a) a = lat; if (lat > b) b = lat;
        if (lng < c) c = lng; if (lng > d) d = lng;
      }
  return [[a, c], [b, d]];
}
// Gán mỗi phường cho BC GẦN NHẤT theo vị trí địa lý của BC (→ tên BC đúng vùng, không lộn xộn).
function assign(feats: Feat[], bcs: CoverageBcLite[]): Assign {
  const n = feats.length;
  const K = bcs.length;
  const cnt = new Array(K).fill(0), area = new Array(K).fill(0);
  const sumLat = new Array(K).fill(0), sumLng = new Array(K).fill(0);
  const wardBc = new Map<string, number>();
  if (K === 0) return { wardBc, cnt, area, sumLat, sumLng, wardCount: n };
  for (let i = 0; i < n; i++) {
    const p = centroidOf(feats[i]);
    const cosLat = Math.cos((p[0] * Math.PI) / 180);
    let bj = 0, bd = Infinity;
    for (let a = 0; a < K; a++) {
      const dlat = p[0] - bcs[a].lat;
      const dlng = (p[1] - bcs[a].lng) * cosLat;
      const dd = dlat * dlat + dlng * dlng;
      if (dd < bd) { bd = dd; bj = a; }
    }
    wardBc.set(String(feats[i].properties.wardCode ?? i), bj);
    cnt[bj] += 1; area[bj] += featureAreaKm2(feats[i]);
    sumLat[bj] += p[0]; sumLng[bj] += p[1];
  }
  return { wardBc, cnt, area, sumLat, sumLng, wardCount: n };
}

type UncWard = { code: string; name: string; prov: string };
// Phường "chưa có BC phụ trách" = xa BC GẦN NHẤT (toàn bộ BC cả nước) > bán kính phục vụ.
// Tính theo allBcs cố định (không phụ thuộc scope) → cộng dồn tỉnh→vùng→cả nước khớp nhau.
function coverage(feats: Feat[], allBcs: CoverageBcLite[]): { uncovered: number; list: UncWard[] } {
  if (!allBcs.length) return { uncovered: feats.length, list: [] };
  const rDeg = COVERAGE_R_KM / 111.32, r2 = rDeg * rDeg;
  let uncovered = 0;
  const list: UncWard[] = [];
  for (const f of feats) {
    const p = centroidOf(f);
    const cosLat = Math.cos((p[0] * Math.PI) / 180);
    let bd = Infinity;
    for (const b of allBcs) {
      const dlat = p[0] - b.lat, dlng = (p[1] - b.lng) * cosLat;
      const dd = dlat * dlat + dlng * dlng;
      if (dd < bd) { bd = dd; if (bd <= r2) break; }
    }
    if (bd > r2) {
      uncovered += 1;
      list.push({ code: String(f.properties.wardCode ?? ""), name: f.properties.wardName ?? "", prov: f.properties.provinceName ?? "" });
    }
  }
  return { uncovered, list };
}

function fetchMerge(srcs: string[]): Promise<Geo> {
  return Promise.all(
    srcs.map((s) => fetch(s).then((r) => (r.ok ? r.json() : null)).catch(() => null)),
  ).then((gs) => ({
    type: "FeatureCollection" as const,
    features: gs.flatMap((g: Geo | null) => (g?.features ?? [])),
  }));
}

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    const fit = () => { map.invalidateSize(); map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 }); };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [bounds, map]);
  return null;
}
function FitWard({ bounds, tick }: { bounds: [[number, number], [number, number]] | null; tick: number }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return null;
}

const STATUS_LABEL: Record<string, string> = { red: "Cần xử lý", amber: "Theo dõi", green: "Ổn" };

export type CoverageStats = {
  newWards: number; newUncovered: number; oldWards: number; oldUncovered: number;
  newUncoveredList: UncWard[]; oldUncoveredList: UncWard[];
} | null;

export function CoverageMap({
  srcs,
  otherSrcs,
  dvhc,
  bcs,
  allBcs,
  mode,
  bcCodes,
  wardCodes,
  clickedWard,
  onClickWard,
  onToggleBc,
  profileBcCode,
  selectedProfile,
  wardFocusTick,
  onWardsLoaded,
  onStats,
  scopeLabel,
  height = 640,
}: {
  srcs: string[];
  otherSrcs: string[];
  dvhc: Dvhc;
  bcs: CoverageBcLite[];
  allBcs: CoverageBcLite[];
  mode: CoverageMode;
  bcCodes: string[];
  wardCodes: string[];
  clickedWard: string | null;
  onClickWard: (code: string, additive: boolean) => void;
  onToggleBc: (code: string) => void;
  profileBcCode: string | null;
  selectedProfile: TerritoryBc | null;
  wardFocusTick: number;
  onWardsLoaded: (wards: { code: string; name: string; prov: string }[]) => void;
  onStats: (s: CoverageStats) => void;
  scopeLabel: string;
  height?: number | string;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [otherGeo, setOtherGeo] = useState<Geo | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPolygon, setNoPolygon] = useState(false);
  const geoRef = useRef<LeafletGeoJSON | null>(null);
  const srcKey = srcs.join("|");
  const otherKey = otherSrcs.join("|");

  useEffect(() => {
    let cancel = false;
    setGeo(null); setLoading(true); setNoPolygon(false);
    fetchMerge(srcs).then((g) => {
      if (cancel) return;
      if (!g.features.length) { setNoPolygon(true); setLoading(false); onWardsLoaded([]); return; }
      setGeo(g); setLoading(false);
      onWardsLoaded(
        g.features
          .map((f) => ({ code: String(f.properties.wardCode ?? ""), name: f.properties.wardName ?? "", prov: f.properties.provinceName ?? "" }))
          .sort((a, b) => a.name.localeCompare(b.name, "vi")),
      );
    });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey]);

  useEffect(() => {
    let cancel = false;
    setOtherGeo(null);
    fetchMerge(otherSrcs).then((g) => { if (!cancel) setOtherGeo(g); });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherKey]);

  const active = useMemo(() => (geo ? assign(geo.features, bcs) : null), [geo, bcs]);
  const other = useMemo(() => (otherGeo ? assign(otherGeo.features, bcs) : null), [otherGeo, bcs]);
  // coverage theo allBcs (cố định toàn quốc) → cộng dồn khớp tỉnh→vùng→cả nước
  const activeCov = useMemo(() => (geo ? coverage(geo.features, allBcs) : null), [geo, allBcs]);
  const otherCov = useMemo(() => (otherGeo ? coverage(otherGeo.features, allBcs) : null), [otherGeo, allBcs]);
  const wardMeta = useMemo(() => {
    const m = new Map<string, { name: string; prov: string }>();
    geo?.features.forEach((f) => m.set(String(f.properties.wardCode ?? ""), { name: f.properties.wardName ?? "", prov: f.properties.provinceName ?? "" }));
    return m;
  }, [geo]);

  const markers = useMemo(() => {
    if (!active) return [] as { code: string; name: string; lat: number; lng: number }[];
    const out: { code: string; name: string; lat: number; lng: number }[] = [];
    for (let a = 0; a < active.cnt.length; a++) {
      if (active.cnt[a] === 0) continue;
      out.push({ code: bcs[a].code, name: bcs[a].name, lat: active.sumLat[a] / active.cnt[a], lng: active.sumLng[a] / active.cnt[a] });
    }
    return out;
  }, [active, bcs]);

  // tập highlight: BC (dropdown + BC của phường vừa click) & phường (dropdown + phường vừa click)
  const { hlBc, hlWard, filterActive } = useMemo(() => {
    const hb = new Set(bcCodes);
    const hw = new Set(wardCodes);
    if (clickedWard && active) {
      const bi = active.wardBc.get(clickedWard);
      if (bi != null && bcs[bi]) hb.add(bcs[bi].code);
      hw.add(clickedWard);
    }
    return { hlBc: hb, hlWard: hw, filterActive: hb.size > 0 || hw.size > 0 };
  }, [bcCodes, wardCodes, clickedWard, active, bcs]);

  const bcCodeByIdx = useCallback((code: string) => bcs.find((b) => b.code === code), [bcs]);
  const wardInFilter = useCallback(
    (code: string) => {
      if (hlWard.has(code)) return true;
      const bi = active?.wardBc.get(code);
      return bi != null && hlBc.has(bcs[bi]?.code);
    },
    [hlWard, hlBc, active, bcs],
  );

  // Bảng thống kê (coverage theo allBcs → cộng dồn khớp các cấp)
  useEffect(() => {
    if (!active || !other || !activeCov || !otherCov) { onStats(null); return; }
    const a = { wards: active.wardCount, unc: activeCov.uncovered, list: activeCov.list };
    const o = { wards: other.wardCount, unc: otherCov.uncovered, list: otherCov.list };
    const nw = dvhc === "new" ? a : o;
    const od = dvhc === "new" ? o : a;
    onStats({
      newWards: nw.wards, newUncovered: nw.unc, oldWards: od.wards, oldUncovered: od.unc,
      newUncoveredList: nw.list, oldUncoveredList: od.list,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, other, activeCov, otherCov, dvhc]);

  const styleFn = useCallback(
    (feature?: { properties?: { wardCode?: string } }): PathOptions => {
      const col = COLORS[dvhc];
      const code = String(feature?.properties?.wardCode ?? "");
      if (!filterActive) return { color: col.line, weight: 0.4, fillColor: col.fill, fillOpacity: 0.28 };
      if (code === clickedWard) return { color: CLICK.line, weight: 2.5, fillColor: CLICK.fill, fillOpacity: 0.6 };
      if (wardInFilter(code)) return { color: HILITE.line, weight: 1.4, fillColor: HILITE.fill, fillOpacity: 0.45 };
      // ngoài filter
      if (mode === "only") return { opacity: 0, fillOpacity: 0, weight: 0 };
      return { color: col.line, weight: 0.3, fillColor: col.fill, fillOpacity: 0.12 };
    },
    [dvhc, filterActive, clickedWard, wardInFilter, mode],
  );

  useEffect(() => {
    geoRef.current?.setStyle(styleFn as (f: unknown) => PathOptions);
  }, [styleFn, geo]);

  const onEachFeature = useCallback((feature: Feat, layer: Layer) => {
    const code = String(feature.properties.wardCode ?? "");
    const name = feature.properties.wardName ?? "";
    const prov = feature.properties.provinceName ?? "";
    (layer as Layer & { bindTooltip: (s: string) => void }).bindTooltip(prov ? `${name} · ${prov}` : name);
    // Ctrl/Cmd + click → chọn nhiều phường; click thường → 1 phường + highlight BC
    layer.on("click", (e: { originalEvent?: MouseEvent }) =>
      onClickWard(code, !!(e.originalEvent?.ctrlKey || e.originalEvent?.metaKey)),
    );
  }, [onClickWard]);

  // bounds toàn scope (dùng khi không lọc, hoặc mode "all")
  const scopeBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!geo) return null;
    let a = 90, b = -90, c = 180, d = -180, has = false;
    for (const f of geo.features) {
      const [lat, lng] = centroidOf(f); has = true;
      if (lat < a) a = lat; if (lat > b) b = lat;
      if (lng < c) c = lng; if (lng > d) d = lng;
    }
    return has ? [[a, c], [b, d]] : null;
  }, [geo]);

  // bounds của phần đang highlight (dùng cho mode "only" + zoom theo filter dropdown)
  const filterBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!geo || !active || !filterActive) return null;
    let a = 90, b = -90, c = 180, d = -180, has = false;
    for (const f of geo.features) {
      const code = String(f.properties.wardCode ?? "");
      if (!wardInFilter(code)) continue;
      const [lat, lng] = centroidOf(f); has = true;
      if (lat < a) a = lat; if (lat > b) b = lat;
      if (lng < c) c = lng; if (lng > d) d = lng;
    }
    return has ? [[a, c], [b, d]] : null;
  }, [geo, active, filterActive, wardInFilter]);

  const mainBounds = mode === "only" && filterBounds ? filterBounds : scopeBounds;

  const wardInfo = useMemo(() => {
    if (!clickedWard) return null;
    const meta = wardMeta.get(clickedWard);
    if (!meta) return null;
    const idx = active?.wardBc.get(clickedWard);
    const bc = idx != null ? bcs[idx] : undefined;
    return { code: clickedWard, ...meta, bcName: bc?.name ?? null, bcCode: bc?.code ?? null };
  }, [clickedWard, wardMeta, active, bcs]);

  const selIdx = profileBcCode ? bcs.findIndex((b) => b.code === profileBcCode) : -1;
  const bcWardStats = useMemo(() => {
    if (selIdx < 0 || !active) return null;
    const aC = active.cnt[selIdx] ?? 0, aA = active.area[selIdx] ?? 0;
    const oC = other ? (other.cnt[selIdx] ?? 0) : null;
    const oA = other ? (other.area[selIdx] ?? 0) : null;
    return dvhc === "new" ? { newC: aC, newA: aA, oldC: oC, oldA: oA } : { oldC: aC, oldA: aA, newC: oC, newA: oA };
  }, [selIdx, active, other, dvhc]);

  const shownWards = filterActive
    ? geo?.features.filter((f) => wardInFilter(String(f.properties.wardCode ?? ""))).length ?? 0
    : geo?.features.length ?? 0;

  return (
    <div className="rounded-md overflow-hidden border border-[var(--color-border)] relative" style={{ height, minHeight: 520 }}>
      <MapContainer key={srcKey} center={[16, 107]} zoom={6} scrollWheelZoom preferCanvas style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <FitBounds bounds={mainBounds} />
        <FitWard bounds={filterBounds} tick={wardFocusTick} />

        {geo && (
          <GeoJSON
            key={srcKey}
            ref={geoRef}
            data={geo as unknown as GeoJSON.GeoJsonObject}
            style={styleFn as () => PathOptions}
            onEachFeature={onEachFeature as (f: unknown, l: Layer) => void}
          />
        )}

        {markers.map((m, mi) => {
          const isHl = hlBc.has(m.code);
          if (mode === "only" && filterActive && !isHl) return null;
          return (
            <CircleMarker
              key={`${m.code}-${mi}`}
              center={[m.lat, m.lng]}
              radius={isHl ? 7 : 4}
              pathOptions={{ color: "#fff", fillColor: isHl ? BC_SEL : BC_DOT, fillOpacity: 1, weight: isHl ? 2 : 1.2 }}
              eventHandlers={{ click: () => onToggleBc(m.code) }}
            >
              <LTooltip>{m.name} — bấm để lọc theo BC</LTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 z-[1000] text-xs text-[var(--color-text-muted)]">
          Đang tải ranh giới…
        </div>
      )}
      {noPolygon && !loading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-1.5 text-xs shadow-sm">
          Không có polygon ranh giới cho {scopeLabel}
        </div>
      )}

      <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-[var(--color-border)] rounded-md px-3 py-2 text-[10px] text-[var(--color-text-muted)] shadow-sm space-y-1">
        {geo && (
          <div className="font-medium uppercase tracking-wide">
            {shownWards} phường/xã {filterActive ? "(đang lọc)" : ""}
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[dvhc].fill, opacity: 0.5 }} />
            Phường {dvhc === "new" ? "mới" : "cũ"}
          </span>
          {filterActive && (
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: HILITE.fill, opacity: 0.6 }} />
              Đang chọn
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: BC_DOT }} />
            BC ({markers.length})
          </span>
        </div>
      </div>

      {wardInfo && (
        <div className="absolute top-2 left-2 z-[1000] bg-white border border-[var(--color-border)] rounded-md px-3 py-2 text-xs shadow-md w-60">
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-[var(--color-text)]">{wardInfo.name}</div>
              <div className="text-[var(--color-text-muted)]">{wardInfo.prov}</div>
              <div className="text-[10px] font-mono text-[var(--color-text-faint)]">{wardInfo.code}</div>
            </div>
            <button type="button" onClick={() => onClickWard("", false)} className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Đóng">✕</button>
          </div>
          <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Bưu cục phụ trách (đã highlight)</div>
            {wardInfo.bcName ? (
              <button
                type="button"
                onClick={() => wardInfo.bcCode && onToggleBc(wardInfo.bcCode)}
                className="mt-0.5 text-[var(--color-ghn-red)] font-medium hover:underline text-left"
              >
                {wardInfo.bcName} {bcCodeByIdx(wardInfo.bcCode ?? "") && hlBc.has(wardInfo.bcCode ?? "") ? "✓ lọc" : "+ lọc"}
              </button>
            ) : (
              <div className="text-[var(--color-text-muted)]">—</div>
            )}
          </div>
        </div>
      )}

      {selectedProfile && (
        <BcProfilePanel bc={selectedProfile} wardStats={bcWardStats} onClose={() => onToggleBc(selectedProfile.bcCode)} />
      )}
    </div>
  );
}

function fmt(n: number) { return n >= 1000 ? `${Math.round(n / 100) / 10}k` : `${n}`; }
function fmtArea(n: number | null | undefined) { return n == null ? "…" : n >= 100 ? `${Math.round(n)}` : `${Math.round(n * 10) / 10}`; }
function Wow({ v, lowerBetter }: { v: number; lowerBetter?: boolean }) {
  if (!v) return <span className="text-[var(--color-text-faint)]">—</span>;
  const good = lowerBetter ? v < 0 : v > 0;
  return <span className={good ? "text-emerald-600" : "text-[var(--color-ghn-red)]"}>{v > 0 ? "▲" : "▼"} {Math.abs(v)}</span>;
}

type WardStats = { newC: number | null; newA: number | null; oldC: number | null; oldA: number | null } | null;

function BcProfilePanel({ bc, wardStats, onClose }: { bc: TerritoryBc; wardStats: WardStats; onClose: () => void }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-text)]">{children}</span>
    </div>
  );
  return (
    <div className="absolute top-2 right-2 z-[1100] bg-white border border-[var(--color-border)] rounded-md p-3 text-xs shadow-lg w-64">
      <div className="flex items-start gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--color-text)] truncate">{bc.bcName}</div>
          <div className="text-[10px] font-mono text-[var(--color-text-faint)]">{bc.bcCode}</div>
        </div>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap">{STATUS_LABEL[bc.status]}</span>
        <button type="button" onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Đóng">✕</button>
      </div>
      <div className="space-y-0.5">
        <Row label="Loại kho">{bc.loaiKho}</Row>
        <Row label="Loại hình">{bc.loaiHoatDong}</Row>
        <Row label="Vùng · KTC">{bc.regionName} · {bc.ktcCode}</Row>
        {wardStats && (
          <>
            <div className="my-1.5 border-t border-[var(--color-border)]" />
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Phạm vi phụ trách</div>
            <Row label="Phường mới"><span className="text-[#2563eb]">{wardStats.newC ?? "…"}</span> · {fmtArea(wardStats.newA)} km²</Row>
            <Row label="Phường cũ"><span className="text-[#ea580c]">{wardStats.oldC ?? "…"}</span> · {fmtArea(wardStats.oldA)} km²</Row>
          </>
        )}
        <div className="my-1.5 border-t border-[var(--color-border)]" />
        <Row label="Đơn lấy / giao">{fmt(bc.donLay)} / {fmt(bc.donGiao)}</Row>
        <Row label="Đơn trong kho">
          {fmt(bc.donTrongKho)}
          {bc.khoOverload && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-red-50 text-[var(--color-ghn-red)] border border-red-200">quá tải</span>}
        </Row>
        <div className="my-1.5 border-t border-[var(--color-border)]" />
        <Row label="%LTC (ontime lấy)">{bc.ontimeLay}% <Wow v={bc.ltcWow} /></Row>
        <Row label="Ontime giao">{bc.ontimeGiao}%</Row>
        <Row label="%GTC">{bc.pctGtc}% <Wow v={bc.gtcWow} /></Row>
        <Row label="Tỷ lệ đổi kho">{bc.doiKho}% <Wow v={bc.doiKhoWow} lowerBetter /></Row>
      </div>
    </div>
  );
}
