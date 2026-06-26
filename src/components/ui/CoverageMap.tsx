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
import { cn } from "@/lib/utils";

type Dvhc = "new" | "old";
export type CoverageMode = "all" | "only";
export type PickType = "DELIVERY" | "PICK" | "RETURN";

type AreaCell = { nC: number; nA: number; oC: number; oA: number };
export type BcInfo = {
  id: string; name: string; type: string; region: string; province: string;
  wardCode?: string; wardName: string; address?: string; lat: number | null; lng: number | null;
  area?: Record<PickType, AreaCell>;
  sets?: string[]; // bộ chỉ định (khác GHNExpress) BC này phục vụ; rỗng = chỉ bộ mặc định
  customers?: string[]; // khách hàng cụ thể của các bộ chỉ định
};
export type BcLite = { id: string; name: string; prov: string };
export type CoverageStats = {
  newWards: number; newUncovered: number; oldWards: number; oldUncovered: number;
  newUncoveredList: UncWard[]; oldUncoveredList: UncWard[];
  bcCount: number; bcNoNew: number; bcNoOld: number;
  bcNoNewList: BcLite[]; bcNoOldList: BcLite[];
} | null;

// Loại hình vận hành BC (suy từ DELIVERY/PICK/RETURN theo phường mới/cũ)
export type BcKind = "D" | "P" | "R" | "MIX" | "COV" | "NONE";
const KIND_COLOR: Record<BcKind, { fill: string; line: string }> = {
  D: { fill: "#2563eb", line: "#1d4ed8" },     // Chuyên Giao
  P: { fill: "#16a34a", line: "#15803d" },     // Chuyên Lấy
  R: { fill: "#f59e0b", line: "#d97706" },     // Chuyên Trả
  MIX: { fill: "#7c3aed", line: "#6d28d9" },   // Hỗn hợp (Giao + Lấy)
  COV: { fill: "#0ea5e9", line: "#0284c7" },   // được bộ phủ (BC không có loại GHNExpress — bộ chỉ định)
  NONE: { fill: "#9ca3af", line: "#6b7280" },  // chưa có BC phụ trách
};
export const KIND_LABEL: Record<BcKind, string> = {
  D: "Chuyên Giao", P: "Chuyên Lấy", R: "Chuyên Trả", MIX: "Hỗn hợp", COV: "Được phủ", NONE: "Chưa có BC",
};
// tỉ lệ BC mạng chuẩn (GHNEXPRESS) đã có coverage phường — panel nhỏ góc map
const COV_ROWS: { label: string; key: string }[] = [
  { label: "Cũ · Giao", key: "DELIVERY_old" }, { label: "Cũ · Lấy", key: "PICK_old" }, { label: "Cũ · Trả", key: "RETURN_old" },
  { label: "Mới · Giao", key: "DELIVERY_new" }, { label: "Mới · Lấy", key: "PICK_new" }, { label: "Mới · Trả", key: "RETURN_new" },
];
// BC có cả Giao & Lấy → Hỗn hợp; có Lấy (kể cả +Trả) → Chuyên Lấy; có Giao → Chuyên Giao; chỉ Trả → Chuyên Trả
function bcKindOf(bc: BcInfo | undefined, dvhc: Dvhc): BcKind {
  if (!bc?.area) return "NONE";
  const k = dvhc === "new" ? "nC" : "oC";
  const hasD = bc.area.DELIVERY[k] > 0, hasP = bc.area.PICK[k] > 0, hasR = bc.area.RETURN[k] > 0;
  if (hasD && hasP) return "MIX";
  if (hasP) return "P";
  if (hasD) return "D";
  if (hasR) return "R";
  return "NONE";
}
// loại hình BC theo HỒ SƠ chung (cả phường mới + cũ) — dùng cho marker/legend, không phụ thuộc ĐVHC đang xem
function bcKindAny(bc: BcInfo | undefined): BcKind {
  if (!bc?.area) return "NONE";
  const hasD = bc.area.DELIVERY.nC > 0 || bc.area.DELIVERY.oC > 0;
  const hasP = bc.area.PICK.nC > 0 || bc.area.PICK.oC > 0;
  const hasR = bc.area.RETURN.nC > 0 || bc.area.RETURN.oC > 0;
  if (hasD && hasP) return "MIX";
  if (hasP) return "P";
  if (hasD) return "D";
  if (hasR) return "R";
  return "NONE";
}
// màu phường = loại hình BC phụ trách (theo hồ sơ chung). Có BC nhưng không có loại GHNExpress (bộ chỉ định) → "COV"; không có BC → NONE
function wardKind(id: string | undefined, bcById: Record<string, BcInfo>): BcKind {
  if (!id) return "NONE";
  const k = bcKindAny(bcById[id]);
  return k === "NONE" ? "COV" : k;
}
const HILITE = { fill: "#dc2626", line: "#b91c1c" };
const CLICK = { fill: "#dc2626", line: "#7f1d1d" };
const BC_SEL = "#dc2626";

type Ring = number[][];
type Feat = {
  type: "Feature";
  properties: { wardCode?: string; wardName?: string; provinceName?: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
};
type Geo = { type: "FeatureCollection"; features: Feat[] };
type WardMap = Record<string, string>; // wardCode → bcId
type UncWard = { code: string; name: string; prov: string };

// Chuẩn hoá: trả về list polygon (mỗi polygon = list ring), xử lý cả Polygon & MultiPolygon (mapshaper xuất cả 2)
function polysOf(geom: { type: string; coordinates: number[][][] | number[][][][] }): Ring[][] {
  return geom.type === "MultiPolygon" ? (geom.coordinates as Ring[][]) : [geom.coordinates as Ring[]];
}
function centroidOf(f: Feat): [number, number] {
  const ring = polysOf(f.geometry)?.[0]?.[0];
  if (!ring || !ring.length) return [0, 0];
  let sx = 0, sy = 0;
  for (const [lng, lat] of ring) { sx += lat; sy += lng; }
  return [sx / ring.length, sy / ring.length];
}
function ringAreaKm2(ring: Ring): number {
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
  for (const poly of polysOf(f.geometry))
    for (let ri = 0; ri < poly.length; ri++) total += (ri === 0 ? 1 : -1) * ringAreaKm2(poly[ri]);
  return Math.max(0, total);
}
function featureBounds(f: Feat): [[number, number], [number, number]] {
  let a = 90, b = -90, c = 180, d = -180;
  for (const poly of polysOf(f.geometry))
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

export function CoverageMap({
  srcs, otherSrcs, mapSrcs, otherMapSrcs, bcById, dvhc, mode, setMeta, coverageStats,
  bcCodes, wardCodes, clickedWard, onClickWard, onToggleBc,
  selectedBc, wardFocusTick, focusWard, focusBc, focusTick, onWardsLoaded, onStats, onBcsInScope,
  scopeLabel, height = 640,
}: {
  srcs: string[]; otherSrcs: string[]; mapSrcs: string[]; otherMapSrcs: string[];
  bcById: Record<string, BcInfo>;
  dvhc: Dvhc; mode: CoverageMode;
  setMeta?: Record<string, { nhom: string; khachHang: string | null }>;
  coverageStats?: { ghnBcCount: number; coverage: Record<string, number> } | null;
  bcCodes: string[]; wardCodes: string[]; clickedWard: string | null;
  onClickWard: (code: string, additive: boolean) => void;
  onToggleBc: (code: string) => void;
  selectedBc: BcInfo | null;
  wardFocusTick: number;
  focusWard: string | null;
  focusBc: string | null;
  focusTick: number;
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
  const [kindFilter, setKindFilter] = useState<BcKind[]>([]); // lọc theo loại hình BC (bấm legend)
  const [showCov, setShowCov] = useState(false); // panel tỉ lệ coverage mạng chuẩn (góc, thu gọn)
  const geoRef = useRef<LeafletGeoJSON | null>(null);
  const srcKey = srcs.join("|");
  const kindActive = kindFilter.length > 0;
  const toggleKind = (k: BcKind) => setKindFilter((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

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

  // BC phục vụ phường trong scope — TÍNH CHUNG cả cũ + mới (BC đếm 1 lần dù chưa gán bộ nào)
  const bcSets = useMemo(() => {
    const active = new Set<string>(), other = new Set<string>();
    if (geo && wmap) for (const f of geo.features) { const id = wmap[String(f.properties.wardCode ?? "")]; if (id) active.add(id); }
    if (otherGeo && otherMap) for (const f of otherGeo.features) { const id = otherMap[String(f.properties.wardCode ?? "")]; if (id) other.add(id); }
    const bcsNew = dvhc === "new" ? active : other;
    const bcsOld = dvhc === "new" ? other : active;
    const union = new Set<string>([...bcsNew, ...bcsOld]);
    return { union, bcsNew, bcsOld };
  }, [geo, wmap, otherGeo, otherMap, dvhc]);

  // marker bộ MẶC ĐỊNH = BC phục vụ phường (theo ward map), tại vị trí thật, màu theo loại hình
  const defaultMarkers = useMemo(() => {
    const out: { id: string; name: string; lat: number; lng: number; kind: BcKind; special: boolean }[] = [];
    bcSets.union.forEach((id) => { const b = bcById[id]; if (b && b.lat != null && b.lng != null) { const k = bcKindAny(b); out.push({ id, name: b.name, lat: b.lat, lng: b.lng, kind: k === "NONE" ? "COV" : k, special: !!b.sets?.length }); } });
    return out;
  }, [bcSets, bcById, dvhc]);

  useEffect(() => { onBcsInScope([...bcSets.union]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bcSets]);

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
    const total = bcSets.union.size;
    const noNewIds = [...bcSets.union].filter((id) => !bcSets.bcsNew.has(id));
    const noOldIds = [...bcSets.union].filter((id) => !bcSets.bcsOld.has(id));
    const mk = (ids: string[]): BcLite[] => ids.map((id) => { const b = bcById[id]; return { id, name: b?.name ?? id, prov: b?.province ?? "" }; })
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
    onStats({ newWards: nw.wards, newUncovered: nw.unc, oldWards: od.wards, oldUncovered: od.unc,
      newUncoveredList: nw.list, oldUncoveredList: od.list, bcCount: total, bcNoNew: noNewIds.length, bcNoOld: noOldIds.length,
      bcNoNewList: mk(noNewIds), bcNoOldList: mk(noOldIds) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, otherGeo, wmap, otherMap, dvhc, bcSets, bcById]);

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

  // màu phường = loại hình BC phụ trách (Chuyên Giao/Lấy/Trả/Hỗn hợp), xám = chưa có BC
  const styleFn = useCallback((feature?: { properties?: { wardCode?: string } }): PathOptions => {
    const code = String(feature?.properties?.wardCode ?? "");
    const id = wmap?.[code];
    const kind = wardKind(id, bcById);
    const col = KIND_COLOR[kind];
    const HIDE: PathOptions = { opacity: 0, fillOpacity: 0, weight: 0 };
    const dim: PathOptions = mode === "only" ? HIDE
      : { color: col.line, weight: 0.3, fillColor: col.fill, fillOpacity: 0.1 };
    if (kindActive && !kindFilter.includes(kind)) return dim;        // lọc theo loại hình BC
    if (code === clickedWard) return { color: CLICK.line, weight: 2.5, fillColor: CLICK.fill, fillOpacity: 0.6 };
    if (filterActive) {
      if (wardInFilter(code)) return { color: HILITE.line, weight: 1.4, fillColor: HILITE.fill, fillOpacity: 0.55 };
      return dim;
    }
    return { color: col.line, weight: 0.4, fillColor: col.fill, fillOpacity: kind === "NONE" ? 0.4 : 0.5 };
  }, [wmap, bcById, dvhc, filterActive, clickedWard, wardInFilter, mode, kindActive, kindFilter]);

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

  // bbox các phường ĐƯỢC BỘ ĐANG XEM PHỦ (có BC) → fit về đúng vùng hoạt động của bộ (GHNEXPRESS ≈ scope)
  const coveredBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!geo || !wmap) return null;
    let a = 90, b = -90, c = 180, d = -180, has = false;
    for (const f of geo.features) {
      if (!wmap[String(f.properties.wardCode ?? "")]) continue;
      const [lat, lng] = centroidOf(f); has = true;
      if (lat < a) a = lat; if (lat > b) b = lat; if (lng < c) c = lng; if (lng > d) d = lng;
    }
    return has ? [[a, c], [b, d]] : null;
  }, [geo, wmap]);

  // marker = BC phục vụ phường của bộ đang xem (union). Cờ special = BC còn phục vụ bộ chỉ định khác → viền cam.
  const markers = defaultMarkers;
  const specialCount = useMemo(() => markers.filter((m) => m.special).length, [markers]);

  // bounds chỉ dựa trên LỰA CHỌN TỪ DROPDOWN (bcCodes/wardCodes) — KHÔNG tính clickedWard
  // → bấm polygon trên map không làm đổi zoom (fix lỗi zoom out khi click)
  const dropdownActive = bcCodes.length > 0 || wardCodes.length > 0;
  const filterBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!geo || !dropdownActive) return null;
    const wset = new Set(wardCodes); const bset = new Set(bcCodes);
    let a = 90, b = -90, c = 180, d = -180, has = false;
    for (const f of geo.features) {
      const code = String(f.properties.wardCode ?? "");
      const id = wmap?.[code];
      if (!(wset.has(code) || (id && bset.has(id)))) continue;
      const [lat, lng] = centroidOf(f); has = true;
      if (lat < a) a = lat; if (lat > b) b = lat; if (lng < c) c = lng; if (lng > d) d = lng;
    }
    return has ? [[a, c], [b, d]] : null;
  }, [geo, dropdownActive, wardCodes, bcCodes, wmap]);
  // 1 nguồn fit duy nhất (tránh ResizeObserver đè): ưu tiên phường focus (bấm từ list) > filter (mode chỉ lọc) > scope
  const targetBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (focusWard && geo) {
      const f = geo.features.find((x) => String(x.properties.wardCode ?? "") === focusWard);
      if (f) return featureBounds(f);
    }
    if (focusBc && geo && wmap) {
      let a = 90, b = -90, c = 180, d = -180, has = false;
      for (const f of geo.features) {
        if (wmap[String(f.properties.wardCode ?? "")] !== focusBc) continue;
        const [lat, lng] = centroidOf(f); has = true;
        if (lat < a) a = lat; if (lat > b) b = lat; if (lng < c) c = lng; if (lng > d) d = lng;
      }
      if (has) return [[a, c], [b, d]];
      const bc = bcById[focusBc];
      if (bc?.lat != null) return [[bc.lat - 0.05, bc.lng! - 0.05], [bc.lat + 0.05, bc.lng! + 0.05]];
    }
    if (mode === "only" && dropdownActive && filterBounds) return filterBounds;
    return coveredBounds ?? scopeBounds; // fit về vùng phủ của bộ đang xem (cả nước + bộ → zoom đúng vùng hoạt động)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusWard, focusBc, geo, wmap, bcById, mode, dropdownActive, filterBounds, coveredBounds, scopeBounds, focusTick, wardFocusTick]);

  const wardInfo = useMemo(() => {
    if (!clickedWard) return null;
    const meta = wardMeta.get(clickedWard); if (!meta) return null;
    const id = wmap?.[clickedWard]; const bc = id ? bcById[id] : undefined;
    return { code: clickedWard, ...meta, bcName: bc?.name ?? null, bcId: bc?.id ?? null, bcKind: bc ? bcKindOf(bc, dvhc) : null };
  }, [clickedWard, wardMeta, wmap, bcById]);

  const shownBc = useMemo(
    () => (kindActive ? markers.filter((m) => kindFilter.includes(m.kind)).length : markers.length),
    [markers, kindActive, kindFilter],
  );
  // số lượng BC theo loại hình (cho legend — chỉ đếm BC, không đếm phường)
  const bcKindCounts = useMemo(() => {
    const c: Record<BcKind, number> = { MIX: 0, D: 0, P: 0, R: 0, COV: 0, NONE: 0 };
    for (const m of markers) c[m.kind]++;
    return c;
  }, [markers]);
  const noBcCount = useMemo(() => {
    if (!geo || !wmap) return 0;
    return geo.features.reduce((n, f) => n + (wmap[String(f.properties.wardCode ?? "")] ? 0 : 1), 0);
  }, [geo, wmap]);

  return (
    <div className="rounded-md overflow-hidden border border-[var(--color-border)] relative" style={{ height, minHeight: 520 }}>
      <MapContainer key={srcKey} center={[16, 107]} zoom={6} scrollWheelZoom preferCanvas style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <FitBounds bounds={targetBounds} />
        {geo && (
          <GeoJSON key={srcKey} ref={geoRef} data={geo as unknown as GeoJSON.GeoJsonObject}
            style={styleFn as () => PathOptions} onEachFeature={onEachFeature as (f: unknown, l: Layer) => void} />
        )}
        {markers.map((m, mi) => {
          if (kindActive && !kindFilter.includes(m.kind)) return null;
          const isHl = hlBc.has(m.id);
          if (mode === "only" && filterActive && !isHl) return null;
          // BC chỉ định: viền vàng cam nổi bật + to hơn
          const ring = m.special ? "#b45309" : "#fff";
          return (
            <CircleMarker key={`${m.id}-${mi}`} center={[m.lat, m.lng]} radius={isHl ? 7 : m.special ? 5.5 : 4}
              pathOptions={{ color: isHl ? BC_SEL : ring, fillColor: m.special ? "#f59e0b" : KIND_COLOR[m.kind].line, fillOpacity: 1, weight: m.special ? 2.5 : isHl ? 2 : 1.2 }}
              eventHandlers={{ click: () => onToggleBc(m.id) }}>
              <LTooltip>{m.name}{m.special ? " — BC CHỈ ĐỊNH" : ` — ${KIND_LABEL[m.kind]}`} — bấm để lọc</LTooltip>
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

      <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-[var(--color-border)] rounded-md px-3 py-2 text-[10px] text-[var(--color-text-muted)] shadow-sm space-y-1 max-w-[260px]">
        {geo && (<div className="font-medium uppercase tracking-wide">{shownBc} BC {filterActive || kindActive ? "(đang lọc)" : ""}</div>)}
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wide">Loại hình BC — bấm để lọc</span>
          {kindActive && <button type="button" onClick={() => setKindFilter([])} className="text-[9px] text-[var(--color-ghn-red)] hover:underline">bỏ lọc</button>}
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {(["MIX", "D", "P", "R", "COV"] as BcKind[]).filter((k) => bcKindCounts[k] > 0).map((k) => {
            const on = kindFilter.includes(k);
            return (
              <button key={k} type="button" onClick={() => toggleKind(k)}
                className={cn("inline-flex items-center gap-1 px-1 rounded text-left hover:bg-[var(--color-hover)]",
                  on && "ring-1 ring-[var(--color-ghn-red)] bg-[var(--color-row-selected)] font-medium",
                  kindActive && !on && "opacity-40")}>
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: KIND_COLOR[k].fill, opacity: 0.85 }} />
                {KIND_LABEL[k]} ({bcKindCounts[k]} BC)
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1 pt-0.5 border-t border-[var(--color-border)]">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#f59e0b", border: "1.5px solid #b45309" }} />
          BC có bộ chỉ định ({specialCount}) — chấm viền cam
        </div>
      </div>

      {coverageStats?.ghnBcCount ? (
        <div className="absolute bottom-2 right-2 z-[1000] text-[10px]">
          <button type="button" onClick={() => setShowCov((v) => !v)}
            className="bg-white/95 border border-[var(--color-border)] rounded-md px-2 py-1 shadow-sm text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] flex items-center gap-1">
            <span className="font-medium">Coverage mạng chuẩn</span> <span className="text-[var(--color-text-faint)]">N={coverageStats.ghnBcCount.toLocaleString("vi-VN")}</span> <span>{showCov ? "▾" : "▸"}</span>
          </button>
          {showCov && (
            <div className="mt-1 bg-white/95 border border-[var(--color-border)] rounded-md p-2 shadow-md w-[206px] space-y-1">
              {COV_ROWS.map((r) => {
                const n = coverageStats.coverage[r.key] ?? 0;
                const pct = (n / coverageStats.ghnBcCount) * 100;
                const col = pct >= 85 ? "#0f766e" : pct >= 60 ? "#d97706" : "#b91c1c";
                return (
                  <div key={r.key} className="flex items-center gap-1.5" title={`${n.toLocaleString("vi-VN")} / ${coverageStats.ghnBcCount.toLocaleString("vi-VN")} BC`}>
                    <span className="w-12 shrink-0 text-[var(--color-text-muted)]">{r.label}</span>
                    <span className="flex-1 h-2.5 rounded bg-[var(--color-hover)] overflow-hidden"><span className="block h-full rounded" style={{ width: `${pct}%`, background: col }} /></span>
                    <span className="w-9 text-right tabular-nums font-medium text-[var(--color-text)]">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

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
              <>
                <button type="button" onClick={() => wardInfo.bcId && onToggleBc(wardInfo.bcId)}
                  className="mt-0.5 text-[var(--color-ghn-red)] font-medium hover:underline text-left">{wardInfo.bcName} →</button>
                {wardInfo.bcKind && (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-sm" style={{ background: KIND_COLOR[wardInfo.bcKind].fill }} />
                    {KIND_LABEL[wardInfo.bcKind]}
                  </div>
                )}
              </>
            ) : (<div className="text-[var(--color-ghn-red)]">Chưa có BC phụ trách</div>)}
          </div>
        </div>
      )}

      {selectedBc && <BcProfilePanel bc={selectedBc} setMeta={setMeta} onClose={() => onToggleBc(selectedBc.id)} />}
    </div>
  );
}

function fmtArea(n: number | null | undefined) { return n == null ? "0" : n >= 100 ? `${Math.round(n)}` : `${Math.round(n * 10) / 10}`; }

function BcProfilePanel({ bc, setMeta, onClose }: { bc: BcInfo; setMeta?: Record<string, { nhom: string; khachHang: string | null }>; onClose: () => void }) {
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="text-[var(--color-text-muted)] shrink-0">{label}</span>
      <span className="font-medium text-[var(--color-text)] text-right">{children}</span>
    </div>
  );
  const PTS: PickType[] = ["DELIVERY", "PICK", "RETURN"];
  const PT_VI: Record<PickType, string> = { DELIVERY: "Giao", PICK: "Lấy", RETURN: "Trả" };
  return (
    <div className="absolute top-2 right-2 z-[1100] bg-white border border-[var(--color-border)] rounded-md p-3 text-xs shadow-lg w-72 max-h-[calc(100%-1rem)] overflow-auto">
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
        {bc.address ? <Row label="Địa chỉ"><span className="text-[11px]">{bc.address}</span></Row> : null}
        {bc.lat != null && <Row label="Toạ độ"><span className="font-mono text-[10px]">{bc.lat.toFixed(4)}, {bc.lng!.toFixed(4)}</span></Row>}
      </div>
      <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
          Bộ dịch vụ {bc.sets?.length ? `· ${bc.sets.length} bộ chỉ định` : "· chỉ mặc định"}
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-hover)] border border-[var(--color-border)] text-[var(--color-text-muted)]">Mặc định (GHNExpress)</span>
          {bc.sets?.map((s) => {
            const m = setMeta?.[s];
            return (
              <span key={s} className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ background: "#b45309" }}
                title={m ? `${m.nhom}${m.khachHang ? ` · KH: ${m.khachHang}` : ""}` : s}>
                {s}{m?.khachHang ? ` (${m.khachHang})` : ""}
              </span>
            );
          })}
        </div>
        {bc.customers?.length ? (
          <div className="mt-1 text-[10px] text-[var(--color-text-muted)]">Khách hàng: <span className="text-[var(--color-text)]">{bc.customers.join(", ")}</span></div>
        ) : null}
      </div>
      {bc.area && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Phạm vi & diện tích hoạt động</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[var(--color-text-muted)]">
                <th className="text-left font-normal pb-1">Hình thức</th>
                <th className="text-right font-normal pb-1"><span className="text-[#2563eb]">Phường mới</span></th>
                <th className="text-right font-normal pb-1"><span className="text-[#ea580c]">Phường cũ</span></th>
              </tr>
            </thead>
            <tbody>
              {PTS.map((pt) => {
                const a = bc.area![pt];
                return (
                  <tr key={pt} className="border-t border-[var(--color-border)]">
                    <td className="py-1 text-[var(--color-text)]">{PT_VI[pt]}</td>
                    <td className="py-1 text-right"><span className="font-medium">{a.nC}</span> phường<br /><span className="text-[10px] text-[var(--color-text-muted)]">{fmtArea(a.nA)} km²</span></td>
                    <td className="py-1 text-right"><span className="font-medium">{a.oC}</span> phường<br /><span className="text-[10px] text-[var(--color-text-muted)]">{fmtArea(a.oA)} km²</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
