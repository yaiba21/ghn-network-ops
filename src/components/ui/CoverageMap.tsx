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
import type { CoverageBc } from "@/lib/aggregators";

const ATTN: Record<string, string> = { green: "#4ade80", amber: "#fbbf24", red: "#ef4444" };

type Ward = {
  code: string;
  name: string;
  prov: string;
  positions: [number, number][][][];
  status: "green" | "amber" | "red";
};

function hashStatus(code: string): Ward["status"] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  const r = (h >>> 0) / 4294967296;
  return r < 0.6 ? "green" : r < 0.82 ? "amber" : "red";
}

type Geo = {
  features: {
    properties: { wardCode?: string; wardName?: string; provinceName?: string };
    geometry: { coordinates: number[][][][] };
  }[];
};
function parse(geo: Geo): Ward[] {
  return geo.features.map((f) => {
    const positions = f.geometry.coordinates.map((poly) =>
      poly.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
    );
    const code = String(f.properties.wardCode ?? "");
    return {
      code,
      name: f.properties.wardName ?? "",
      prov: f.properties.provinceName ?? "",
      positions,
      status: hashStatus(code),
    };
  });
}

function FitBounds({ wards, bcs }: { wards: Ward[] | null; bcs: CoverageBc[] }) {
  const map = useMap();
  useEffect(() => {
    let a = 90, b = -90, c = 180, d = -180, has = false;
    if (wards?.length) {
      for (const w of wards)
        for (const poly of w.positions)
          for (const ring of poly)
            for (const [lat, lng] of ring) {
              has = true;
              if (lat < a) a = lat; if (lat > b) b = lat;
              if (lng < c) c = lng; if (lng > d) d = lng;
            }
    } else if (bcs.length) {
      for (const m of bcs) {
        has = true;
        if (m.lat < a) a = m.lat; if (m.lat > b) b = m.lat;
        if (m.lng < c) c = m.lng; if (m.lng > d) d = m.lng;
      }
    }
    if (has) map.fitBounds([[a, c], [b, d]], { padding: [24, 24] });
  }, [wards, bcs, map]);
  return null;
}

export function CoverageMap({
  src,
  bcs,
  scopeLabel,
  height = 640,
}: {
  src: string;
  bcs: CoverageBc[];
  scopeLabel: string;
  height?: number | string;
}) {
  const [wards, setWards] = useState<Ward[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [noPolygon, setNoPolygon] = useState(false);
  const [sel, setSel] = useState<Ward | null>(null);

  useEffect(() => {
    let cancel = false;
    setWards(null); setSel(null); setLoading(true); setNoPolygon(false);
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (cancel) return;
        if (!g) { setNoPolygon(true); setLoading(false); return; }
        setWards(parse(g)); setLoading(false);
      })
      .catch(() => { if (!cancel) { setNoPolygon(true); setLoading(false); } });
    return () => { cancel = true; };
  }, [src]);

  const counts = useMemo(() => {
    const c = { green: 0, amber: 0, red: 0 };
    (wards ?? []).forEach((w) => (c[w.status] += 1));
    return c;
  }, [wards]);

  return (
    <div
      className="rounded-md overflow-hidden border border-[var(--color-border)] relative"
      style={{ height }}
    >
      <MapContainer key={src} center={[16, 107]} zoom={6} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <FitBounds wards={wards} bcs={bcs} />

        {wards?.map((w) => {
          const isSel = sel?.code === w.code;
          return (
            <Polygon
              key={w.code}
              positions={w.positions}
              pathOptions={{
                color: "#ffffff",
                fillColor: ATTN[w.status],
                fillOpacity: isSel ? 0.85 : w.status === "green" ? 0.32 : 0.55,
                weight: isSel ? 2 : 0.5,
              }}
              eventHandlers={{ click: () => setSel(w) }}
            >
              <LTooltip>
                {w.name}
                {w.prov ? ` · ${w.prov}` : ""}
              </LTooltip>
            </Polygon>
          );
        })}

        {/* Vị trí bưu cục — luôn hiển thị */}
        {bcs.map((m, i) => (
          <CircleMarker
            key={m.code + i}
            center={[m.lat, m.lng]}
            radius={4}
            pathOptions={{ color: "#fff", fillColor: "#1e3a5f", fillOpacity: 1, weight: 1.2 }}
          >
            <LTooltip>{m.name}</LTooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 z-[1000] text-xs text-[var(--color-text-muted)]">
          Đang tải ranh giới…
        </div>
      )}

      {/* Note khi không có polygon */}
      {noPolygon && !loading && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-amber-50 border border-amber-200 text-amber-800 rounded-md px-3 py-1.5 text-xs shadow-sm">
          Không có polygon ranh giới cho {scopeLabel}
          {bcs.length ? ` (chỉ hiển thị ${bcs.length} bưu cục)` : ""}
        </div>
      )}

      {/* Legend + thống kê */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-[var(--color-border)] rounded-md px-3 py-2 text-[10px] text-[var(--color-text-muted)] shadow-sm">
        {wards && (
          <>
            <div className="font-medium uppercase tracking-wide mb-1">
              Mức cần chú ý — {wards.length} phường/xã
            </div>
            <div className="flex gap-3 mb-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ATTN.red, opacity: 0.6 }} />
                Cần xử lý {counts.red}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ATTN.amber, opacity: 0.6 }} />
                Theo dõi {counts.amber}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: ATTN.green, opacity: 0.4 }} />
                Ổn {counts.green}
              </span>
            </div>
          </>
        )}
        <span className="inline-flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#1e3a5f" }} />
          Bưu cục ({bcs.length})
        </span>
      </div>

      {sel && (
        <div className="absolute top-2 right-2 z-[1000] bg-white border border-[var(--color-border)] rounded-md px-3 py-2 text-xs shadow-md w-56">
          <div className="flex items-start gap-2">
            <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ATTN[sel.status] }} />
            <div className="min-w-0">
              <div className="font-semibold text-[var(--color-text)]">{sel.name}</div>
              <div className="text-[var(--color-text-muted)]">{sel.prov}</div>
              <div className="text-[10px] font-mono text-[var(--color-text-faint)]">{sel.code}</div>
            </div>
            <button
              type="button"
              onClick={() => setSel(null)}
              className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              aria-label="Đóng"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
