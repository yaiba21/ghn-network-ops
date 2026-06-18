"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip as LTooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapNode, MapTripRoute } from "@/lib/aggregators";
import { cn, formatCompactInt, formatVND } from "@/lib/utils";
import { fetchRoadPath, mapWithLimit } from "@/lib/osrm";
import { Modal } from "./Modal";

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
  const [activeTrip, setActiveTrip] = useState<string | null>(null); // hover (highlight tạm)
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null); // click (giữ + xem chi tiết)
  // Hình học đường bộ (OSRM) theo tripId — fallback đường thẳng nếu chưa/không có.
  const [roadPaths, setRoadPaths] = useState<Record<string, [number, number][]>>({});
  const center: [number, number] = [16.0, 107.5]; // giữa VN
  const maxTp = Math.max(1, ...nodes.map((n) => n.throughput));
  // Tuyến đang focus = đang hover, nếu không thì tuyến đã click.
  const focusTrip = activeTrip ?? selectedTrip;
  const selected = routes.find((r) => r.tripId === selectedTrip);

  // Tải hình học đường bộ cho từng route (bám đường, nằm trong đất liền VN).
  useEffect(() => {
    let cancelled = false;
    setRoadPaths({});
    mapWithLimit(routes, 4, async (r) => {
      if (r.stops.length < 2) return;
      const path = await fetchRoadPath(
        r.stops.map((s) => ({ lat: s.lat, lng: s.lng })),
      );
      if (!cancelled && path) {
        setRoadPaths((prev) => ({ ...prev, [r.tripId]: path }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [routes]);

  return (
    <>
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
            {/* Routes — đường bộ thực tế (OSRM), fallback nối điểm chạm */}
            {routes.map((r) => {
              const dim = focusTrip && focusTrip !== r.tripId;
              const isSel = focusTrip === r.tripId;
              const line: [number, number][] =
                roadPaths[r.tripId] ?? r.stops.map((s) => [s.lat, s.lng]);
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
                  eventHandlers={{ click: () => setSelectedTrip(r.tripId) }}
                />
              );
            })}
            {/* Stop points của route đang focus */}
            {focusTrip &&
              routes
                .find((r) => r.tripId === focusTrip)
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

      {/* Panel: danh sách tuyến (chi tiết tuyến mở popup) */}
      <div className="xl:w-80 shrink-0 space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            {routes.length} tuyến — hover để xem, bấm để mở chi tiết
          </div>
          <div className="space-y-1 max-h-[520px] overflow-auto pr-1">
            {routes.map((r) => (
              <button
                key={r.tripId}
                type="button"
                onMouseEnter={() => setActiveTrip(r.tripId)}
                onMouseLeave={() => setActiveTrip(null)}
                onClick={() => setSelectedTrip(r.tripId)}
                className={cn(
                  "w-full px-2.5 py-2 rounded border text-xs text-left transition-colors",
                  selectedTrip === r.tripId
                    ? "border-[var(--color-ghn-red)] bg-[var(--color-row-selected)]"
                    : activeTrip === r.tripId
                      ? "border-[var(--color-ghn-red)]"
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
    </div>

      {/* Popup chi tiết tuyến */}
      <Modal
        open={!!selected}
        onClose={() => setSelectedTrip(null)}
        title={selected ? `Tuyến ${selected.origin} → ${selected.dest}` : ""}
        subtitle={selected ? `${selected.tripId} · ${selected.type}` : ""}
        widthClass="max-w-lg"
      >
        {selected && <RouteDetailBody route={selected} />}
      </Modal>
    </>
  );
}

// Nội dung popup chi tiết tuyến (header/close do Modal lo).
function RouteDetailBody({ route }: { route: MapTripRoute }) {
  const lateLabel = route.lateMin <= 15 ? "Đến đúng giờ" : `Trễ ${route.lateMin}'`;
  const lateColor =
    route.lateMin <= 15
      ? "text-emerald-600"
      : route.lateMin <= 60
        ? "text-amber-600"
        : "text-red-600";
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <RStat label="Parcels" value={formatCompactInt(route.parcels)} />
        <RStat label="Tổng km" value={`${route.totalKm} km`} />
        <RStat label="Chi phí" value={formatVND(route.cost, true)} />
        <RStat label="Cost/km" value={formatVND(route.costPerKm)} />
        <RStat label="Fill kg" value={`${route.fillRateKg}%`} />
        <RStat label="Số điểm chạm" value={`${route.stops.length}`} />
        <RStat label="NCC" value={route.carrier} />
        <RStat label="Xe" value={route.vehicle} />
      </div>

      <div className={cn("text-sm font-medium", lateColor)}>{lateLabel}</div>

      <div className="pt-2 border-t border-[var(--color-border-soft)]">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">
          Chuỗi điểm chạm
        </div>
        <ol className="space-y-1">
          {route.stops.map((s) => (
            <li key={s.code + s.order} className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: s.code.startsWith("BC-") ? "#10b981" : "#8b5cf6" }}
              />
              <span className="text-[var(--color-text-muted)] tabular-nums">{s.order}.</span>
              <span className="truncate">{s.label}</span>
              <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                {s.code.startsWith("BC-") ? "BC" : "KTC"}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function RStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-hover)] rounded p-1.5">
      <div className="text-[9px] uppercase tracking-wide text-[var(--color-text-muted)] truncate">
        {label}
      </div>
      <div className="text-xs font-semibold tabular-nums text-[var(--color-text)] truncate">
        {value}
      </div>
    </div>
  );
}
