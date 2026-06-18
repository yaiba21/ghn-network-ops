// Định tuyến đường bộ thực tế qua OSRM public demo.
// Dùng để vẽ route bám theo đường (nằm trong đất liền VN, tự zig-zag),
// thay vì nối thẳng 2 điểm (dễ cắt qua biển).

export type LatLng = { lat: number; lng: number };

/**
 * Lấy hình học đường bộ đi qua các waypoint theo thứ tự.
 * Trả [lat,lng][] để Leaflet vẽ Polyline, hoặc null nếu lỗi/timeout
 * (caller fallback về đường thẳng qua các stop).
 */
export async function fetchRoadPath(
  points: LatLng[],
  timeoutMs = 6000,
): Promise<[number, number][] | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  // overview=simplified: vẫn bám đường nhưng ít vertex hơn nhiều (nhẹ khi render).
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const json = await res.json();
    const g = json?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(g) || g.length < 2) return null;
    // OSRM trả [lng,lat] → đổi sang [lat,lng]
    return g.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Chạy fn theo từng item với giới hạn concurrency (tránh rate-limit OSRM). */
export async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return out;
}
