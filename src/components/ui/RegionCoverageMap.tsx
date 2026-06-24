"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip as LTooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

const ATTN: Record<string, string> = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#ef4444",
};

type Ward = {
  code: string;
  name: string;
  prov: string;
  positions: [number, number][][][];
  status: "green" | "amber" | "red";
};

// Seeded attention theo wardCode → heatmap nhất quán, không phụ thuộc data BC.
// FNV-1a + avalanche để phân bố đều (ward code cùng tỉnh hay trùng prefix số).
function hashStatus(code: string): Ward["status"] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
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

function FitBounds({ wards }: { wards: Ward[] }) {
  const map = useMap();
  useEffect(() => {
    if (!wards.length) return;
    let a = 90, b = -90, c = 180, d = -180;
    for (const w of wards)
      for (const poly of w.positions)
        for (const ring of poly)
          for (const [lat, lng] of ring) {
            if (lat < a) a = lat;
            if (lat > b) b = lat;
            if (lng < c) c = lng;
            if (lng > d) d = lng;
          }
    map.fitBounds([[a, c], [b, d]], { padding: [20, 20] });
  }, [wards, map]);
  return null;
}

export function RegionCoverageMap({
  src,
  scopeLabel,
  height = 640,
}: {
  src: string; // /wards-region/{code}.geojson hoặc /wards/{code}.geojson
  scopeLabel: string;
  height?: number | string;
}) {
  const [wards, setWards] = useState<Ward[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sel, setSel] = useState<Ward | null>(null);

  useEffect(() => {
    let cancel = false;
    setWards(null); setSel(null); setLoading(true); setNotFound(false);
    fetch(src)
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (cancel) return;
        if (!g) { setNotFound(true); setLoading(false); return; }
        setWards(parse(g)); setLoading(false);
      })
      .catch(() => { if (!cancel) { setNotFound(true); setLoading(false); } });
    return () => { cancel = true; };
  }, [src]);

  const counts = useMemo(() => {
    const c = { green: 0, amber: 0, red: 0 };
    (wards ?? []).forEach((w) => (c[w.status] += 1));
    return c;
  }, [wards]);

  if (notFound) {
    return (
      <div
        className="rounded-md border border-dashed border-[var(--color-border)] flex items-center justify-center text-sm text-[var(--color-text-muted)]"
        style={{ height }}
      >
        Vùng {scopeLabel} chưa có dữ liệu ranh giới phường (vùng mới / đang triển khai).
      </div>
    );
  }

  return (
    <div
      className="rounded-md overflow-hidden border border-[var(--color-border)] relative"
      style={{ height }}
    >
      <MapContainer
        key={src}
        center={[16, 107]}
        zoom={6}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {wards && <FitBounds wards={wards} />}
        {wards?.map((w) => {
          const isSel = sel?.code === w.code;
          return (
            <Polygon
              key={w.code}
              positions={w.positions}
              pathOptions={{
                color: "#ffffff",
                fillColor: ATTN[w.status],
                fillOpacity: isSel ? 0.85 : w.status === "green" ? 0.35 : 0.6,
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
      </MapContainer>

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/40 z-[1000] text-xs text-[var(--color-text-muted)]">
          Đang tải ranh giới phường…
        </div>
      )}

      {/* Legend + thống kê */}
      {wards && (
        <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 border border-[var(--color-border)] rounded-md px-3 py-2 text-[10px] text-[var(--color-text-muted)] shadow-sm">
          <div className="font-medium uppercase tracking-wide mb-1">
            Mức cần chú ý — {wards.length} phường
          </div>
          <div className="flex gap-3">
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
        </div>
      )}

      {/* Ward được chọn */}
      {sel && (
        <div className="absolute top-2 right-2 z-[1000] bg-white border border-[var(--color-border)] rounded-md px-3 py-2 text-xs shadow-md w-56">
          <div className="flex items-start gap-2">
            <span
              className={cn("mt-1 w-2.5 h-2.5 rounded-full shrink-0")}
              style={{ background: ATTN[sel.status] }}
            />
            <div className="min-w-0">
              <div className="font-semibold text-[var(--color-text)]">{sel.name}</div>
              <div className="text-[var(--color-text-muted)]">{sel.prov}</div>
              <div className="text-[10px] font-mono text-[var(--color-text-faint)]">
                {sel.code}
              </div>
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
