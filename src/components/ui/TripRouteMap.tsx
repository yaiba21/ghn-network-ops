"use client";

import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip as LTooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TripStop } from "@/lib/aggregators";

const STATUS_COLOR: Record<string, string> = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
};

export function TripRouteMap({
  stops,
  status,
  height = 300,
}: {
  stops: TripStop[];
  status: string;
  height?: number;
}) {
  if (stops.length < 1) return null;
  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const center: [number, number] = [
    lats.reduce((a, b) => a + b, 0) / lats.length,
    lngs.reduce((a, b) => a + b, 0) / lngs.length,
  ];
  const line: [number, number][] = stops.map((s) => [s.lat, s.lng]);
  const color = STATUS_COLOR[status] ?? "#1e3a5f";

  return (
    <div
      className="rounded-md overflow-hidden border border-[var(--color-border)]"
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {/* Đường nối các điểm chạm */}
        <Polyline
          positions={line}
          pathOptions={{ color, weight: 3, opacity: 0.7, dashArray: "6 6" }}
        />
        {/* Marker từng điểm chạm */}
        {stops.map((s) => (
          <CircleMarker
            key={s.order}
            center={[s.lat, s.lng]}
            radius={s.type === "KTC" ? 8 : 6}
            pathOptions={{
              color: "#fff",
              weight: 2,
              fillColor: s.type === "KTC" ? "#8b5cf6" : "#10b981",
              fillOpacity: 1,
            }}
          >
            <LTooltip permanent direction="top" offset={[0, -6]}>
              <span style={{ fontSize: 10 }}>
                {s.order}. {s.name}
              </span>
            </LTooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
