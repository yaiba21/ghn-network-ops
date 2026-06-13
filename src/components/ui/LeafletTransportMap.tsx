"use client";

import { useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip as LTooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapNode, MapTripRoute } from "@/lib/aggregators";
import { cn, formatCompactInt } from "@/lib/utils";

const ROUTE_COLOR: Record<string, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

export function LeafletTransportMap({
  nodes,
  routes,
  height = 560,
}: {
  nodes: MapNode[];
  routes: MapTripRoute[];
  height?: number;
}) {
  const [activeTrip, setActiveTrip] = useState<string | null>(null);
  const center: [number, number] = [16.0, 107.5]; // giữa VN
  const maxTp = Math.max(1, ...nodes.map((n) => n.throughput));

  return (
    <div className="flex flex-col xl:flex-row gap-4">
      <div className="flex-1 min-w-0">
        <div
          className="rounded-md overflow-hidden border border-[var(--color-border)]"
          style={{ height }}
        >
          <MapContainer
            center={center}
            zoom={6}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {/* Routes — polyline qua tất cả điểm chạm */}
            {routes.map((r) => {
              const dim = activeTrip && activeTrip !== r.tripId;
              const isSel = activeTrip === r.tripId;
              const line: [number, number][] = r.stops.map((s) => [s.lat, s.lng]);
              return (
                <Polyline
                  key={r.tripId}
                  positions={line}
                  pathOptions={{
                    color: ROUTE_COLOR[r.status],
                    weight: isSel ? 4 : 2,
                    opacity: dim ? 0.12 : 0.7,
                    dashArray: isSel ? undefined : "5 6",
                  }}
                  eventHandlers={{ click: () => setActiveTrip(r.tripId) }}
                />
              );
            })}
            {/* Stop points của route đang chọn */}
            {activeTrip &&
              routes
                .find((r) => r.tripId === activeTrip)
                ?.stops.map((s) => (
                  <CircleMarker
                    key={s.code + s.order}
                    center={[s.lat, s.lng]}
                    radius={6}
                    pathOptions={{
                      color: "#fff",
                      weight: 2,
                      fillColor: s.code.startsWith("BC-") ? "#10b981" : "#8b5cf6",
                      fillOpacity: 1,
                    }}
                  >
                    <LTooltip permanent direction="top" offset={[0, -6]}>
                      <span style={{ fontSize: 10 }}>
                        {s.order}. {s.label}
                      </span>
                    </LTooltip>
                  </CircleMarker>
                ))}
            {/* KTC nodes */}
            {nodes.map((n) => (
              <CircleMarker
                key={n.code}
                center={[n.lat, n.lng]}
                radius={4 + (n.throughput / maxTp) * 10}
                pathOptions={{
                  color: "#fff",
                  weight: 1,
                  fillColor: "#F97316",
                  fillOpacity: 0.85,
                }}
              >
                <LTooltip>
                  {n.name} · {formatCompactInt(n.throughput)} parcels
                </LTooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--color-text-muted)]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#F97316]" /> KTC (size = parcels)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#8b5cf6]" /> điểm chạm KTC
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-[#10b981]" /> điểm chạm BC
          </span>
        </div>
      </div>

      {/* Route list */}
      <div className="xl:w-72 shrink-0">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
          {routes.length} tuyến — hover để xem điểm chạm
        </div>
        <div className="space-y-1 max-h-[520px] overflow-auto pr-1">
          {routes.map((r) => (
            <button
              key={r.tripId}
              type="button"
              onMouseEnter={() => setActiveTrip(r.tripId)}
              onMouseLeave={() => setActiveTrip(null)}
              className={cn(
                "w-full px-2.5 py-2 rounded border text-xs text-left transition-colors",
                activeTrip === r.tripId
                  ? "border-[var(--color-ghn-red)] bg-[var(--color-row-selected)]"
                  : "border-[var(--color-border)] hover:bg-[var(--color-hover)]",
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: ROUTE_COLOR[r.status] }}
                />
                <span className="font-mono text-[10px] truncate">{r.tripId.slice(-10)}</span>
                <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                  {r.stops.length} điểm
                </span>
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
                {r.stops.map((s) => s.code.replace("-KTC", "·").replace("BC-", "")).join(" → ")}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
