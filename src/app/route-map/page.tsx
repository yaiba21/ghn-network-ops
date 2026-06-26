"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { PageHeader } from "@/components/ui/PageHeader";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { cn } from "@/lib/utils";
import type { TransportRoute, BcPt } from "@/components/ui/RouteMap";

const RouteMap = dynamic(() => import("@/components/ui/RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-[70vh] ghn-skeleton rounded-md" />,
});

type RoutesFile = { routes: TransportRoute[]; regions: string[] };
const MAP_H = "calc(100vh - 240px)";

export default function RouteMapPage() {
  const [data, setData] = useState<RoutesFile | null>(null);
  const [bcArr, setBcArr] = useState<BcPt[]>([]);
  const [region, setRegion] = useState<string>(""); // "" = tất cả vùng (vẽ tuyến cả nước)
  const [routeCodes, setRouteCodes] = useState<string[]>([]);
  const [bcCodes, setBcCodes] = useState<string[]>([]);
  const [showAllBc, setShowAllBc] = useState(true);
  const [focusCode, setFocusCode] = useState<string | null>(null);

  useEffect(() => {
    fetch("/transport/routes.json").then((r) => r.json()).then(setData).catch(() => {});
    fetch("/coverage/bc.json").then((r) => r.json()).then((bs: BcPt[]) => setBcArr(bs)).catch(() => {});
  }, []);

  const bcById = useMemo(() => {
    const m: Record<string, BcPt> = {};
    for (const b of bcArr) m[b.id] = b;
    return m;
  }, [bcArr]);

  const regionOpts = useMemo(
    () => (data?.regions ?? []).map((r) => ({ value: r, label: r })),
    [data],
  );

  // BỎ HẲN điểm dừng không có toạ độ (KTC/hub ngoài bc.json): không hiện, không nối, không liệt kê.
  // Chỉ giữ tuyến còn ≥2 điểm BC có vị trí để nối thành tuyến.
  const allRoutes = useMemo(() => {
    return (data?.routes ?? [])
      .map((r) => {
        const stops = r.stops.filter((s) => s.lat != null);
        return { ...r, stops, total: stops.length, plottable: stops.length };
      })
      .filter((r) => r.stops.length >= 2);
  }, [data]);
  const droppedRoutes = useMemo(() => (data?.routes?.length ?? 0) - allRoutes.length, [data, allRoutes]);

  // tuyến trong vùng đang chọn
  const regionRoutes = useMemo(
    () => allRoutes.filter((r) => !region || r.region === region),
    [allRoutes, region],
  );
  const routeOpts = useMemo(
    () => regionRoutes.map((r) => ({ value: r.code, label: `${r.code} (${r.total} điểm)` })),
    [regionRoutes],
  );

  // tuyến hiển thị: theo tuyến đã chọn (nếu có) > theo BC lọc > cả vùng
  const visibleRoutes = useMemo(() => {
    let rs = regionRoutes;
    if (routeCodes.length) rs = allRoutes.filter((r) => routeCodes.includes(r.code));
    if (bcCodes.length) rs = rs.filter((r) => r.stops.some((s) => bcCodes.includes(s.id)));
    return rs;
  }, [regionRoutes, routeCodes, bcCodes, allRoutes]);

  // BC option (toàn bộ BC trong các tuyến của vùng — để lọc)
  const bcOpts = useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const r of regionRoutes) for (const s of r.stops) {
      if (s.id && !seen.has(s.id)) { seen.add(s.id); out.push({ value: s.id, label: `${s.id}${s.name ? ` - ${s.name}` : ""}` }); }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [regionRoutes]);

  const bcMarkers = useMemo(() => {
    if (bcCodes.length) return bcArr.filter((b) => bcCodes.includes(b.id));
    if (!showAllBc) {
      // chỉ BC nằm trên các tuyến đang hiển thị
      const ids = new Set<string>();
      for (const r of visibleRoutes) for (const s of r.stops) ids.add(s.id);
      return bcArr.filter((b) => ids.has(b.id));
    }
    return bcArr;
  }, [bcArr, bcCodes, showAllBc, visibleRoutes]);

  const focusRoute = useMemo(() => visibleRoutes.find((r) => r.code === focusCode) ?? null, [visibleRoutes, focusCode]);
  useEffect(() => { setFocusCode(null); }, [region, routeCodes, bcCodes]);

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Bản đồ chuyến tải" }]}
        title="Bản đồ chuyến tải"
        subtitle="Chuyến tải thật (DS Tuyến Tải) — nối các bưu cục có vị trí theo thứ tự xuất. Bấm tuyến để xem & highlight + chuỗi ID - tên BC. Điểm dừng là KTC/hub không có vị trí được bỏ qua hoàn toàn (không hiện, không nối)."
      />

      <div className="flex flex-wrap items-end gap-3">
        <DimensionSelect label="Vùng (mã tuyến)" value={region || undefined} options={regionOpts}
          onChange={(v) => { setRegion(v ?? ""); setRouteCodes([]); setBcCodes([]); }} allOptionLabel="Tất cả vùng" width={150} searchable />
        <MultiSelect label={`Tuyến (${routeCodes.length || regionRoutes.length})`} values={routeCodes} options={routeOpts}
          onChange={setRouteCodes} emptyLabel="Tất cả tuyến trong vùng" width={230} searchable maxVisible={200} />
        <MultiSelect label={`Bưu cục (${bcCodes.length})`} values={bcCodes} options={bcOpts}
          onChange={setBcCodes} emptyLabel="Lọc theo BC" width={240} searchable maxVisible={200} />
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] pb-2 cursor-pointer">
          <input type="checkbox" checked={showAllBc} onChange={(e) => setShowAllBc(e.target.checked)} /> Hiện tất cả vị trí BC
        </label>
        {(routeCodes.length > 0 || bcCodes.length > 0) && (
          <button type="button" onClick={() => { setRouteCodes([]); setBcCodes([]); }}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-white hover:bg-[var(--color-hover)]">Bỏ lọc</button>
        )}
      </div>

      <div className="text-xs text-[var(--color-text-muted)]">
        Đang hiển thị <b className="text-[var(--color-text)]">{visibleRoutes.length}</b> tuyến ·
        <b className="text-[var(--color-text)]"> {bcMarkers.length.toLocaleString("vi-VN")}</b> vị trí BC
        {droppedRoutes > 0 && <> · <span className="text-[var(--color-ghn-red)]">{droppedRoutes}</span> tuyến bị ẩn (&lt;2 BC có vị trí)</>}
      </div>

      <div className="flex flex-col xl:flex-row gap-3">
        <div className="flex-1 min-w-0">
          <RouteMap routes={visibleRoutes} bcMarkers={bcMarkers} focusCode={focusCode}
            onPickRoute={(c) => setFocusCode((p) => (p === c ? null : c))} height={MAP_H} />
        </div>

        <div className="xl:w-80 shrink-0 space-y-2">
          {focusRoute ? (
            <div className="rounded-md border border-[var(--color-border)] bg-white p-3 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[var(--color-text)]">{focusRoute.code}</span>
                <button type="button" onClick={() => setFocusCode(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">✕</button>
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)] mb-2">
                {focusRoute.total} bưu cục (theo thứ tự xuất)
              </div>
              <ol className="space-y-0.5 max-h-[calc(100vh-360px)] overflow-auto pr-1">
                {focusRoute.stops.map((s, i) => (
                  <li key={`${s.id}-${i}`} className="flex items-start gap-1.5">
                    <span className="tabular-nums text-[var(--color-text-faint)] w-5 text-right shrink-0">{i + 1}.</span>
                    <span className="w-2 h-2 rounded-full shrink-0 mt-1 bg-emerald-500" />
                    <span><span className="font-mono">{s.id}</span>{s.name ? ` - ${s.name}` : ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="rounded-md border border-[var(--color-border)] bg-white p-2">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] px-1 mb-1">
                {visibleRoutes.length} tuyến — bấm để xem chuỗi BC
              </div>
              <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-auto pr-1">
                {visibleRoutes.map((r) => (
                  <button key={r.code} type="button" onClick={() => setFocusCode(r.code)}
                    className="w-full px-2.5 py-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-hover)] text-xs text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-mono truncate">{r.code}</span>
                      <span className="ml-auto text-[10px] text-[var(--color-text-muted)] shrink-0">{r.total} điểm</span>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 truncate">
                      {r.stops.map((s) => s.id).join(" → ")}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
