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

type Dvhc = "new" | "old";
export type CoverageMode = "all" | "only";
export type PickType = "DELIVERY" | "PICK" | "RETURN";

export type BcInfo = {
  id: string; name: string; type: string; region: string; province: string;
  wardCode: string; wardName: string; address: string; lat: number | null; lng: number | null;
};
export type CoverageStats = {
  newWards: number; newUncovered: number; oldWards: number; oldUncovered: number;
  newUncoveredList: UncWard[]; oldUncoveredList: UncWard[];
} | null;

const COLORS: Record<Dvhc, { fill: string; line: string }> = {
  new: { fill: "#3b82f6", line: "#2563eb" },
  old: { fill: "#f97316", line: "#ea580c" },
};
const NO_BC = { fill: "#9ca3af", line: "#6b7280" };   // phường chưa có BC phụ trách
const HILITE = { fill: "#dc2626", line: "#b91c1c" };
const CLICK = { fill: "#dc2626", line: "#7f1d1d" };
const BC_DOT = "#1e3a5f";
const BC_SEL = "#dc2626";

type Feat = {
  type: "Feature";
  properties: { wardCode?: string; wardName?: string; provinceName?: string };
  geometry: { type: string; coordinates: number[][][][] };
};
type Geo = { type: "FeatureCollection"; features: Feat[] };
type WardMap = Record<string, string>; // wardCode → bcId
type UncWard = { code: string; name: string; prov: string };

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
function fetchMerge(srcs: string[]): Promise<Geo> {
  return Promise.all(srcs.map((s) => fetch(s).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
    .then((gs) => ({ type: "FeatureCollection" as const, features: gs.flatMap((g: Geo | null) => g?.features ?? []) }));
}
function fetchMaps(srcs: string[]): Promise<WardMap> {
  return Promise.all(srcs.map((s) => fetch(s).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
    .then((ms) => Object.assign({}, ...ms.map((m) => m ?? {})));
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

export function CoverageMap({
  srcs, otherSrcs, mapSrcs, otherMapSrcs, bcById, dvhc, mode,
  bcCodes, wardCodes, clickedWard, onClickWard, onToggleBc,
  selectedBc, wardFocusTick, onWardsLoaded, onStats, onBcsInScope,
  scopeLabel, height = 640,
}: {
  srcs: string[]; otherSrcs: string[]; mapSrcs: string[]; otherMapSrcs: string[];
  bcById: Record<string, BcInfo>;
  dvhc: Dvhc; mode: CoverageMode;
  bcCodes: string[]; wardCodes: string[]; clickedWard: string | null;
  onClickWard: (code: string, additive: boolean) => void;
  onToggleBc: (code: string) => void;
  selectedBc: BcInfo | null;
  wardFocusTick: number;
  onWardsLoaded: (wards: { code: string; name: string; prov: string }[]) => void;
  onStats: (s: CoverageStats) => void;
  onBcsInScope: (ids: string[]) => void;
  scopeLabel: string;
  height?: number | string;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [otherGeo, setOtherGeo] = useState<Geo | null>(null);
  const [wmap, setWmap] = useState<WardMap | null>(null);
  const [otherMap, setOtherMap] = useState<WardMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPolygon, setNoPolygon] = useState(false);
  const geoRef = useRef<LeafletGeoJSON | null>(null);
  const srcKey = srcs.join("|");

  useEffect(() => {
    let cancel = false;
    setGeo(null); setLoading(true); setNoPolygon(false);
    fetchMerge(srcs).then((g) => {
      if (cancel) return;
      if (!g.features.length) { setNoPolygon(true); setLoading(false); onWardsLoaded([]); return; }
      setGeo(g); setLoading(false);
      onWardsLoaded(g.features.map((f) => ({
        code: String(f.properties.wardCode ?? ""), name: f.properties.wardName ?? "", prov: f.properties.provinceName ?? "",
      })).sort((a, b) => a.name.localeCompare(b.name, "vi")));
    });
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcKey]);

  useEffect(() => { let c = false; setOtherGeo(null); fetchMerge(otherSrcs).then((g) => { if (!c) setOtherGeo(g); }); return () => { c = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherSrcs.join("|")]);
  useEffect(() => { let c = false; setWmap(null); fetchMaps(mapSrcs).then((m) => { if (!c) setWmap(m); }); return () => { c = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapSrcs.join("|")]);
  useEffect(() => { let c = false; setOtherMap(null); fetchMaps(otherMapSrcs).then((m) => { if (!c) setOtherMap(m); }); return () => { c = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherMapSrcs.join("|")]);

  const wardMeta = useMemo(() => {
    const m = new Map<string, { name: string; prov: string }>();
    geo?.features.forEach((f) => m.set(String(f.properties.wardCode ?? ""), { name: f.properties.wardName ?? "", prov: f.properties.provinceName ?? "" }));
    return m;
  }, [geo]);

  // BC phục vụ các phường đang hiển thị (theo map thật) → marker + báo về page cho dropdown
  const markers = useMemo(() => {
    if (!geo || !wmap) return [] as { id: string; name: string; lat: number; lng: number }[];
    const ids = new Set<string>();
    for (const f of geo.features) { const id = wmap[String(f.properties.wardCode ?? "")]; if (id) ids.add(id); }
    const out: { id: string; name: string; lat: number; lng: number }[] = [];
    ids.forEach((id) => { const b = bcById[id]; if (b && b.lat != null && b.lng != null) out.push({ id, name: b.name, lat: b.lat, lng: b.lng }); });
    return out;
  }, [geo, wmap, bcById]);

  useEffect(() => { onBcsInScope(markers.map((m) => m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  // thống kê: phường + phường chưa có BC (theo map thật, cố định per phường → cộng dồn khớp)
  useEffect(() => {
    if (!geo || !otherGeo || !wmap || !otherMap) { onStats(null); return; }
    const calc = (g: Geo, m: WardMap) => {
      let unc = 0; const list: UncWard[] = [];
      for (const f of g.features) {
        const wc = String(f.properties.wardCode ?? "");
        if (!m[wc]) { unc++; list.push({ code: wc, name: f.properties.wardName ?? "", prov: f.properties.provinceName ?? "" }); }
      }
      return { wards: g.features.length, unc, list };
    };
    const a = calc(geo, wmap), o = calc(otherGeo, otherMap);
    const nw = dvhc === "new" ? a : o, od = dvhc === "new" ? o : a;
    onStats({ newWards: nw.wards, newUncovered: nw.unc, oldWards: od.wards, oldUncovered: od.unc, newUncoveredList: nw.list, oldUncoveredList: od.list });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, otherGeo, wmap, otherMap, dvhc]);

  const selId = selectedBc?.id ?? null;
  const { hlBc, hlWard, filterActive } = useMemo(() => {
    const hb = new Set(bcCodes); const hw = new Set(wardCodes);
    if (clickedWard && wmap) { const id = wmap[clickedWard]; if (id) hb.add(id); hw.add(clickedWard); }
    return { hlBc: hb, hlWard: hw, filterActive: hb.size > 0 || hw.size > 0 };
  }, [bcCodes, wardCodes, clickedWard, wmap]);

  const wardInFilter = useCallback((code: string) => {
    if (hlWard.has(code)) return true;
    const id = wmap?.[code];
    return !!id && hlBc.has(id);
  }, [hlWard, hlBc, wmap]);

  const styleFn = useCallback((feature?: { properties?: { wardCode?: string } }): PathOptions => {
    const col = COLORS[dvhc];
    const code = String(feature?.properties?.wardCode ?? "");
    const hasBc = !!wmap?.[code];
    if (!filterActive) {
      return hasBc
        ? { color: col.line, weight: 0.4, fillColor: col.fill, fillOpacity: 0.3 }
        : { color: NO_BC.line, weight: 0.4, fillColor: NO_BC.fill, fillOpacity: 0.4 };
    }
    if (code === clickedWard) return { color: CLICK.line, weight: 2.5, fillColor: CLICK.fill, fillOpacity: 0.6 };
    if (wardInFilter(code)) return { color: HILITE.line, weight: 1.4, fillColor: HILITE.fill, fillOpacity: 0.5 };
    if (mode === "only") return { opacity: 0, fillOpacity: 0, weight: 0 };
    return hasBc
      ? { color: col.line, weight: 0.3, fillColor: col.fill, fillOpacity: 0.12 }
      : { color: NO_BC.line, weight: 0.3, fillColor: NO_BC.fill, fillOpacity: 0.15 };
  }, [dvhc, filterActive, clickedWard, wardInFilter, mode, wmap]);

  useEffect(() => { geoRef.current?.setStyle(styleFn as (f: unknown) => PathOptions); }, [styleFn, geo]);

  const onEachFeature = useCallback((feature: Feat, layer: Layer) => {
    const code = String(feature.properties.wardCode ?? "");
    const name = feature.properties.wardName ?? "", prov = feature.properties.provinceName ?? "";
    (layer as Layer & { bindTooltip: (s: string) => void }).bindTooltip(prov ? `${name} · ${prov}` : name);
    layer.on("click", (e: { originalEvent?: MouseEvent }) =>
      onClickWard(code, !!(e.originalEvent?.ctrlKey || e.originalEvent?.metaKey)));
  }, [onClickWard]);

  const scopeBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!geo) return null;
    let a = 90, b = -90, c = 180, d = -180, has = false;
    for (const f of geo.features) { const [lat, lng] = centroidOf(f); has = true;
      if (lat < a) a = lat; if (lat > b) b = lat; if (lng < c) c = lng; if (lng > d) d = lng; }
    return has ? [[a, c], [b, d]] : null;
  }, [geo]);
  const filterBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!geo || !filterActive) return null;
    let a = 90, b = -90, c = 180, d = -180, has = false;
    for (const f of geo.features) {
      if (!wardInFilter(String(f.properties.wardCode ?? ""))) continue;
      const [lat, lng] = centroidOf(f); has = true;
      if (lat < a) a = lat; if (lat > b) b = lat; if (lng < c) c = lng; if (lng > d) d = lng;
    }
    return has ? [[a, c], [b, d]] : null;
  }, [geo, filterActive, wardInFilter]);
  const mainBounds = mode === "only" && filterBounds ? filterBounds : scopeBounds;

  const wardInfo = useMemo(() => {
    if (!clickedWard) return null;
    const meta = wardMeta.get(clickedWard); if (!meta) return null;
    const id = wmap?.[clickedWard]; const bc = id ? bcById[id] : undefined;
    return { code: clickedWard, ...meta, bcName: bc?.name ?? null, bcId: bc?.id ?? null };
  }, [clickedWard, wardMeta, wmap, bcById]);

  // phường cũ/mới + diện tích cho BC đang chọn (từ map thật)
  const bcWardStats = useMemo(() => {
    if (!selId || !geo || !wmap) return null;
    const countFor = (g: Geo | null, m: WardMap | null) => {
      if (!g || !m) return { c: null as number | null, a: null as number | null };
      let c = 0, ar = 0;
      for (const f of g.features) if (m[String(f.properties.wardCode ?? "")] === selId) { c++; ar += featureAreaKm2(f); }
      return { c, a: ar };
    };
    const act = countFor(geo, wmap), oth = countFor(otherGeo, otherMap);
    return dvhc === "new" ? { newC: act.c, newA: act.a, oldC: oth.c, oldA: oth.a } : { oldC: act.c, oldA: act.a, newC: oth.c, newA: oth.a };
  }, [selId, geo, wmap, otherGeo, otherMap, dvhc]);

  const shownWards = filterActive
    ? geo?.features.filter((f) => wardInFilter(String(f.properties.wardCode ?? ""))).length ?? 0
    : geo?.features.length ?? 0;
  const noBcCount = useMemo(() => {
    if (!geo || !wmap) return 0;
    return geo.features.reduce((n, f) => n + (wmap[String(f.properties.wardCode ?? "")] ? 0 : 1), 0);
  }, [geo, wmap]);

  return (
    <div className="rounded-md overflow-hidden border border-[var(--color-border)] relative" style={{ height, minHeight: 520 }}>
      <MapContainer key={srcKey} center={[16, 107]} zoom={6} scrollWheelZoom preferCanvas style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <FitBounds bounds={mainBounds} />
        <FitWard bounds={filterBounds} tick={wardFocusTick} />
        {geo && (
          <GeoJSON key={srcKey} ref={geoRef} data={geo as unknown as GeoJSON.GeoJsonObject}
            style={styleFn as () => PathOptions} onEachFeature={onEachFeature as (f: unknown, l: Layer) => void} />
        )}
        {markers.map((m, mi) => {
          const isHl = hlBc.has(m.id);
          if (mode === "only" && filterActive && !isHl) return null;
          return (
            <CircleMarker key={`${m.id}-${mi}`} center={[m.lat, m.lng]} radius={isHl ? 7 : 4}
              pathOptions={{ color: "#fff", fillColor: isHl ? BC_SEL : BC_DOT, fillOpacity: 1, weight: isHl ? 2 : 1.2 }}
              eventHandlers={{ click: () => onToggleBc(m.id) }}>
              <LTooltip>{m.name} — bấm để lọc theo BC</LTooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 z-[1000] text-xs text-[var(--color-text-muted)]">Đang tải ranh giới…</div>
      )}
      {noPolygon && !loading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-1.5 text-xs shadow-sm">Không có polygon ranh giới cho {scopeLabel}</div>
      )}

      <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-[var(--color-border)] rounded-md px-3 py-2 text-[10px] text-[var(--color-text-muted)] shadow-sm space-y-1">
        {geo && (<div className="font-medium uppercase tracking-wide">{shownWards} phường/xã {filterActive ? "(đang lọc)" : ""}</div>)}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[dvhc].fill, opacity: 0.5 }} />Có BC ({dvhc === "new" ? "mới" : "cũ"})</span>
          {!filterActive && noBcCount > 0 && (<span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: NO_BC.fill, opacity: 0.6 }} />Chưa có BC ({noBcCount})</span>)}
          {filterActive && (<span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: HILITE.fill, opacity: 0.6 }} />Đang chọn</span>)}
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: BC_DOT }} />BC ({markers.length})</span>
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
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Bưu cục phụ trách</div>
            {wardInfo.bcName ? (
              <button type="button" onClick={() => wardInfo.bcId && onToggleBc(wardInfo.bcId)}
                className="mt-0.5 text-[var(--color-ghn-red)] font-medium hover:underline text-left">{wardInfo.bcName} →</button>
            ) : (<div className="text-[var(--color-ghn-red)]">Chưa có BC phụ trách</div>)}
          </div>
        </div>
      )}

      {selectedBc && <BcProfilePanel bc={selectedBc} wardStats={bcWardStats} onClose={() => onToggleBc(selectedBc.id)} />}
    </div>
  );
}

function fmtArea(n: number | null | undefined) { return n == null ? "…" : n >= 100 ? `${Math.round(n)}` : `${Math.round(n * 10) / 10}`; }
type WS = { newC: number | null; newA: number | null; oldC: number | null; oldA: number | null } | null;

function BcProfilePanel({ bc, wardStats, onClose }: { bc: BcInfo; wardStats: WS; onClose: () => void }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="font-medium text-[var(--color-text)] text-right">{children}</span>
    </div>
  );
  return (
    <div className="absolute top-2 right-2 z-[1100] bg-white border border-[var(--color-border)] rounded-md p-3 text-xs shadow-lg w-64">
      <div className="flex items-start gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-semibold text-[var(--color-text)]">{bc.name}</div>
          <div className="text-[10px] font-mono text-[var(--color-text-faint)]">ID {bc.id} · {bc.type}</div>
        </div>
        <button type="button" onClick={onClose} className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text)]" aria-label="Đóng">✕</button>
      </div>
      <div className="space-y-0.5">
        <Row label="Vùng">{bc.region}</Row>
        <Row label="Tỉnh">{bc.province}</Row>
        <Row label="Phường trú">{bc.wardName}</Row>
        <Row label="Địa chỉ"><span className="text-[11px]">{bc.address}</span></Row>
        {bc.lat != null && <Row label="Toạ độ"><span className="font-mono text-[10px]">{bc.lat.toFixed(4)}, {bc.lng!.toFixed(4)}</span></Row>}
        {wardStats && (
          <>
            <div className="my-1.5 border-t border-[var(--color-border)]" />
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Phạm vi phụ trách (theo hình thức)</div>
            <Row label="Phường mới"><span className="text-[#2563eb]">{wardStats.newC ?? "…"}</span> · {fmtArea(wardStats.newA)} km²</Row>
            <Row label="Phường cũ"><span className="text-[#ea580c]">{wardStats.oldC ?? "…"}</span> · {fmtArea(wardStats.oldA)} km²</Row>
          </>
        )}
      </div>
    </div>
  );
}
