"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { REGION_LABEL_VI } from "@/lib/types";
import { loaiGroup, LOAI_GROUP_LABEL, type BcPt, type LoaiGroup } from "./RouteMap";

const RouteMap = dynamic(() => import("./RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-[520px] ghn-skeleton rounded-md" />,
});

type Bc = BcPt & { region?: string; province?: string };

// Bản đồ vị trí bưu cục (thật, từ Phạm vi BC) + filter vùng/tỉnh/BC — dùng ở trang Định tuyến.
export function BcMapCard({ height = 560 }: { height?: number | string }) {
  const [bcArr, setBcArr] = useState<Bc[]>([]);
  const [region, setRegion] = useState<string>("");
  const [province, setProvince] = useState<string>("");
  const [loaiG, setLoaiG] = useState<string>("");
  const [bcCodes, setBcCodes] = useState<string[]>([]);

  useEffect(() => {
    fetch("/coverage/bc.json").then((r) => r.json()).then(setBcArr).catch(() => {});
  }, []);

  const regionOpts = useMemo(() => {
    const rs = [...new Set(bcArr.map((b) => b.region).filter(Boolean) as string[])].sort();
    return rs.map((r) => ({ value: r, label: REGION_LABEL_VI[r as keyof typeof REGION_LABEL_VI] ? `${r} · ${REGION_LABEL_VI[r as keyof typeof REGION_LABEL_VI]}` : r }));
  }, [bcArr]);

  const provinceOpts = useMemo(() => {
    const ps = [...new Set(bcArr.filter((b) => !region || b.region === region).map((b) => b.province).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "vi"));
    return ps.map((p) => ({ value: p, label: p }));
  }, [bcArr, region]);

  const loaiOpts = useMemo(() => {
    const c = new Map<LoaiGroup, number>();
    for (const b of bcArr.filter((x) => (!region || x.region === region) && (!province || x.province === province))) {
      const g = loaiGroup(b.loai); c.set(g, (c.get(g) ?? 0) + 1);
    }
    return (["g1", "g2", "g3", "g4", "g5", "g0"] as LoaiGroup[]).filter((g) => c.get(g)).map((g) => ({ value: g, label: `${LOAI_GROUP_LABEL[g]} (${c.get(g)})` }));
  }, [bcArr, region, province]);

  const inScope = useMemo(
    () => bcArr.filter((b) => (!region || b.region === region) && (!province || b.province === province) && (!loaiG || loaiGroup(b.loai) === loaiG)),
    [bcArr, region, province, loaiG],
  );
  const bcOpts = useMemo(
    () => inScope.filter((b) => b.lat != null).sort((a, b) => a.name.localeCompare(b.name, "vi")).map((b) => ({ value: b.id, label: `${b.id} - ${b.name}` })),
    [inScope],
  );
  const markers = useMemo(
    () => (bcCodes.length ? inScope.filter((b) => bcCodes.includes(b.id)) : inScope),
    [inScope, bcCodes],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <DimensionSelect label="Vùng" value={region || undefined} options={regionOpts}
          onChange={(v) => { setRegion(v ?? ""); setProvince(""); setBcCodes([]); }} allOptionLabel="Tất cả vùng" width={180} searchable />
        <DimensionSelect label="Tỉnh/Thành" value={province || undefined} options={provinceOpts}
          onChange={(v) => { setProvince(v ?? ""); setBcCodes([]); }} allOptionLabel="Tất cả tỉnh" width={190} searchable />
        <DimensionSelect label="Loại kho" value={loaiG || undefined} options={loaiOpts}
          onChange={(v) => { setLoaiG(v ?? ""); setBcCodes([]); }} allOptionLabel="Tất cả loại" width={220} />
        <MultiSelect label={`Bưu cục (${bcCodes.length})`} values={bcCodes} options={bcOpts}
          onChange={setBcCodes} emptyLabel="Tất cả bưu cục" width={250} searchable maxVisible={200} />
        <span className="text-xs text-[var(--color-text-muted)] pb-2">
          <b className="text-[var(--color-text)]">{markers.filter((b) => b.lat != null).length.toLocaleString("vi-VN")}</b> bưu cục
        </span>
      </div>
      <RouteMap routes={[]} bcMarkers={markers} focusCode={null} onPickRoute={() => {}} height={height} prominentBc />
    </div>
  );
}
