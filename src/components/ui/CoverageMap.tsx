"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  GeoJSON,
  Tooltip as LTooltip,
  useMap,
} from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CoverageBcLite, TerritoryBc } from "@/lib/aggregators";

const BLUE = "#3b82f6";
const BLUE_LINE = "#2563eb";
const BC_DOT = "#1e3a5f";
const BC_SEL = "#dc2626";

type Feat = {
  type: "Feature";
  properties: { wardCode?: string; wardName?: string; provinceName?: string };
  geometry: { type: string; coordinates: number[][][][] };
};
type Geo = { type: "FeatureCollection"; features: Feat[] };

type BcMarker = { code: string; name: string; lat: number; lng: number; bcIdx: number };

// tâm phường = trung bình outer ring của polygon đầu tiên
function centroidOf(f: Feat): [number, number] {
  const ring = f.geometry.coordinates?.[0]?.[0];
  if (!ring || !ring.length) return [0, 0];
  let sx = 0, sy = 0;
  for (const [lng, lat] of ring) { sx += lat; sy += lng; }
  return [sx / ring.length, sy / ring.length];
}
const d2 = (a: [number, number], b: [number, number]) =>
  (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

// Farthest-point sampling: chọn K tâm phân tán đều làm "neo" cho từng BC
function farthest(pts: [number, number][], K: number): number[] {
  const n = pts.length;
  if (K >= n) return pts.map((_, i) => i);
  const chosen = [0];
  const dist = pts.map((p) => d2(p, pts[0]));
  while (chosen.length < K) {
    let bi = 0, bd = -1;
    for (let i = 0; i < n; i++) if (dist[i] > bd) { bd = dist[i]; bi = i; }
    chosen.push(bi);
    const c = pts[bi];
    for (let i = 0; i < n; i++) { const dd = d2(pts[i], c); if (dd < dist[i]) dist[i] = dd; }
  }
  return chosen;
}

function FitBounds({ bounds }: { bounds: [[number, number], [number, number]] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    // Map mount trong container flex/dynamic → size có thể = 0 khi fitBounds chạy lần đầu
    // (→ zoom văng lên 18, tile + polygon lệch ra ngoài). ResizeObserver fit đúng lúc
    // container có kích thước thật; maxZoom chặn fit lỗi khi size còn nhỏ.
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [bounds, map]);
  return null;
}

const STATUS_LABEL: Record<string, string> = {
  red: "Cần xử lý", amber: "Theo dõi", green: "Ổn",
};

export function CoverageMap({
  src,
  bcs,
  selectedBcCode,
  selectedProfile,
  onSelectBc,
  scopeLabel,
  height = 640,
}: {
  src: string;
  bcs: CoverageBcLite[];
  selectedBcCode: string | null;
  selectedProfile: TerritoryBc | null;
  onSelectBc: (code: string | null) => void;
  scopeLabel: string;
  height?: number | string;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPolygon, setNoPolygon] = useState(false);
  const [selWard, setSelWard] = useState<
    { code: string; name: string; prov: string; bcName: string | null; bcCode: string | null } | null
  >(null);
  const hiRef = useRef<Layer | null>(null);

  useEffect(() => {
    let cancel = false;
    setGeo(null); setSelWard(null); setLoading(true); setNoPolygon(false);
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((g: Geo | null) => {
        if (cancel) return;
        if (!g || !g.features?.length) { setNoPolygon(true); setLoading(false); return; }
        setGeo(g); setLoading(false);
      })
      .catch(() => { if (!cancel) { setNoPolygon(true); setLoading(false); } });
    return () => { cancel = true; };
  }, [src]);

  // Gán phường → BC (nearest neo) + vị trí marker = tâm cụm phường của BC
  const { wardBcByCode, markers } = useMemo(() => {
    const empty = { wardBcByCode: new Map<string, number>(), markers: [] as BcMarker[] };
    if (!geo || !bcs.length) return empty;
    const feats = geo.features;
    const cent = feats.map(centroidOf);
    const K = Math.min(bcs.length, feats.length);
    const anchors = farthest(cent, K);
    const ax = anchors.map((i) => cent[i]);
    const sumLat = new Array(K).fill(0), sumLng = new Array(K).fill(0), cnt = new Array(K).fill(0);
    const wardBc = new Map<string, number>();
    for (let i = 0; i < feats.length; i++) {
      const p = cent[i];
      let ba = 0, bd = Infinity;
      for (let a = 0; a < K; a++) { const dd = d2(p, ax[a]); if (dd < bd) { bd = dd; ba = a; } }
      const code = String(feats[i].properties.wardCode ?? i);
      wardBc.set(code, ba); // ba = index trong bcs (anchor a ứng với bcs[a])
      sumLat[ba] += p[0]; sumLng[ba] += p[1]; cnt[ba] += 1;
    }
    const markers: BcMarker[] = [];
    for (let a = 0; a < K; a++) {
      if (cnt[a] === 0) continue;
      markers.push({ code: bcs[a].code, name: bcs[a].name, lat: sumLat[a] / cnt[a], lng: sumLng[a] / cnt[a], bcIdx: a });
    }
    return { wardBcByCode: wardBc, markers };
  }, [geo, bcs]);

  const selIdx = selectedBcCode ? bcs.findIndex((b) => b.code === selectedBcCode) : -1;

  // features hiển thị: chọn BC → chỉ phường của BC đó; else tất cả
  const displayed = useMemo<Geo | null>(() => {
    if (!geo) return null;
    if (selIdx < 0) return geo;
    return {
      type: "FeatureCollection",
      features: geo.features.filter(
        (f) => wardBcByCode.get(String(f.properties.wardCode ?? "")) === selIdx,
      ),
    };
  }, [geo, selIdx, wardBcByCode]);

  // bounds theo features đang hiển thị
  const bounds = useMemo<[[number, number], [number, number]] | null>(() => {
    const fs = displayed?.features;
    if (!fs?.length) return null;
    let a = 90, b = -90, c = 180, d = -180;
    for (const f of fs) {
      const [lat, lng] = centroidOf(f);
      if (lat < a) a = lat; if (lat > b) b = lat;
      if (lng < c) c = lng; if (lng > d) d = lng;
    }
    return [[a, c], [b, d]];
  }, [displayed]);

  const styleFn = (): PathOptions => ({
    color: BLUE_LINE, weight: 0.4, fillColor: BLUE, fillOpacity: 0.28,
  });

  const onEachFeature = (feature: Feat, layer: Layer) => {
    const code = String(feature.properties.wardCode ?? "");
    const name = feature.properties.wardName ?? "";
    const prov = feature.properties.provinceName ?? "";
    // tooltip tên phường
    (layer as Layer & { bindTooltip: (s: string) => void }).bindTooltip(
      prov ? `${name} · ${prov}` : name,
    );
    layer.on("click", () => {
      // highlight phường vừa chọn
      const prev = hiRef.current as (Layer & { setStyle?: (s: PathOptions) => void }) | null;
      if (prev?.setStyle) prev.setStyle(styleFn());
      const cur = layer as Layer & { setStyle?: (s: PathOptions) => void };
      cur.setStyle?.({ color: BLUE_LINE, weight: 2, fillColor: BLUE, fillOpacity: 0.55 });
      hiRef.current = layer;
      const idx = wardBcByCode.get(code);
      const bc = idx != null ? bcs[idx] : undefined;
      setSelWard({ code, name, prov, bcName: bc?.name ?? null, bcCode: bc?.code ?? null });
    });
  };

  return (
    <div
      className="rounded-md overflow-hidden border border-[var(--color-border)] relative"
      style={{ height, minHeight: 520 }}
    >
      <MapContainer
        key={src}
        center={[16, 107]}
        zoom={6}
        scrollWheelZoom
        preferCanvas
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds bounds={bounds} />

        {displayed && (
          <GeoJSON
            key={`${src}|${selectedBcCode ?? "all"}`}
            data={displayed as unknown as GeoJSON.GeoJsonObject}
            style={styleFn}
            onEachFeature={onEachFeature as (f: unknown, l: Layer) => void}
          />
        )}

        {/* Vị trí bưu cục — tâm cụm phường phụ trách */}
        {markers.map((m) => {
          const isSel = m.code === selectedBcCode;
          return (
            <CircleMarker
              key={m.code}
              center={[m.lat, m.lng]}
              radius={isSel ? 7 : 4}
              pathOptions={{
                color: "#fff",
                fillColor: isSel ? BC_SEL : BC_DOT,
                fillOpacity: 1,
                weight: isSel ? 2 : 1.2,
              }}
              eventHandlers={{ click: () => onSelectBc(m.code) }}
            >
              <LTooltip>{m.name} — bấm để xem chi tiết</LTooltip>
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
          {bcs.length ? ` (chỉ có ${bcs.length} bưu cục)` : ""}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-[var(--color-border)] rounded-md px-3 py-2 text-[10px] text-[var(--color-text-muted)] shadow-sm space-y-1">
        {geo && (
          <div className="font-medium uppercase tracking-wide">
            {displayed?.features.length ?? 0} phường/xã
            {selectedBcCode ? " (của BC đang chọn)" : ""}
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: BLUE, opacity: 0.4 }} />
            Ranh giới phường
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: BC_DOT }} />
            Bưu cục ({markers.length})
          </span>
        </div>
      </div>

      {/* Panel phường vừa click → BC phụ trách */}
      {selWard && (
        <div className="absolute top-2 left-2 z-[1000] bg-white border border-[var(--color-border)] rounded-md px-3 py-2 text-xs shadow-md w-60">
          <div className="flex items-start gap-2">
            <div className="min-w-0">
              <div className="font-semibold text-[var(--color-text)]">{selWard.name}</div>
              <div className="text-[var(--color-text-muted)]">{selWard.prov}</div>
              <div className="text-[10px] font-mono text-[var(--color-text-faint)]">{selWard.code}</div>
            </div>
            <button
              type="button"
              onClick={() => setSelWard(null)}
              className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
              Bưu cục phụ trách
            </div>
            {selWard.bcName ? (
              <button
                type="button"
                onClick={() => selWard.bcCode && onSelectBc(selWard.bcCode)}
                className="mt-0.5 text-[var(--color-ghn-red)] font-medium hover:underline text-left"
              >
                {selWard.bcName} →
              </button>
            ) : (
              <div className="text-[var(--color-text-muted)]">—</div>
            )}
          </div>
        </div>
      )}

      {/* Panel profile BC đang chọn */}
      {selectedProfile && (
        <BcProfilePanel bc={selectedProfile} onClose={() => onSelectBc(null)} />
      )}
    </div>
  );
}

function fmt(n: number) {
  return n >= 1000 ? `${Math.round(n / 100) / 10}k` : `${n}`;
}
function Wow({ v, lowerBetter }: { v: number; lowerBetter?: boolean }) {
  if (!v) return <span className="text-[var(--color-text-faint)]">—</span>;
  const good = lowerBetter ? v < 0 : v > 0;
  return (
    <span className={good ? "text-emerald-600" : "text-[var(--color-ghn-red)]"}>
      {v > 0 ? "▲" : "▼"} {Math.abs(v)}
    </span>
  );
}

function BcProfilePanel({ bc, onClose }: { bc: TerritoryBc; onClose: () => void }) {
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
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap">
          {STATUS_LABEL[bc.status]}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>
      <div className="space-y-0.5">
        <Row label="Loại kho">{bc.loaiKho}</Row>
        <Row label="Loại hình">{bc.loaiHoatDong}</Row>
        <Row label="Vùng · KTC">{bc.regionName} · {bc.ktcCode}</Row>
        <div className="my-1.5 border-t border-[var(--color-border)]" />
        <Row label="Đơn lấy / giao">{fmt(bc.donLay)} / {fmt(bc.donGiao)}</Row>
        <Row label="Đơn trong kho">
          {fmt(bc.donTrongKho)}
          {bc.khoOverload && (
            <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-red-50 text-[var(--color-ghn-red)] border border-red-200">
              quá tải
            </span>
          )}
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
