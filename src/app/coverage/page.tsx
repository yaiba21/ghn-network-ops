"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFilter } from "@/components/filter/FilterContext";
import { getCoverageBcs } from "@/lib/aggregators";
import { getProvinces } from "@/lib/mock-data";
import { REGION_LABEL_VI, type RegionCode } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { cn } from "@/lib/utils";

const CoverageMap = dynamic(
  () => import("@/components/ui/CoverageMap").then((m) => m.CoverageMap),
  { ssr: false, loading: () => <div className="h-[70vh] ghn-skeleton rounded-md" /> },
);

type Dvhc = "new" | "old";
type Level = "region" | "province";
type Manifest = {
  old: { provinces: { slug: string; name: string }[]; regions: string[] };
  new: { provinces: { slug: string; name: string }[]; regions: string[] };
};

const REGION_ORDER: RegionCode[] = [
  "HCM", "HNO", "DSH", "DNB", "DCL", "TNB", "DBB", "BTB", "TTB", "NTB", "TNG", "TNT", "XBG", "TBB",
];
const MAP_H = "calc(100vh - 240px)";

// Chuẩn hoá tên tỉnh để map sang app province code (cho vị trí bưu cục).
function normName(s: string): string {
  let x = s.replace(/Đ/g, "D").replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  x = x.replace(/tp\.?/g, "").replace(/thanh pho/g, "").replace(/\btinh\b/g, "").replace(/thua thien/g, "").replace(/ba ria - /g, "");
  return x.replace(/\s+/g, " ").trim();
}

export default function CoveragePage() {
  const { filter } = useFilter();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [dvhc, setDvhc] = useState<Dvhc>("new");
  const [level, setLevel] = useState<Level>("region");
  const [regionCode, setRegionCode] = useState<RegionCode>("HCM");
  const [provinceSlug, setProvinceSlug] = useState<string>("ho-chi-minh");

  useEffect(() => {
    fetch("/coverage/manifest.json").then((r) => r.json()).then(setManifest).catch(() => {});
  }, []);

  // app province code theo tên (cho bưu cục)
  const appByNorm = useMemo(() => {
    const m = new Map<string, string>();
    getProvinces().forEach((p) => m.set(normName(p.name), p.code));
    return m;
  }, []);

  const provinceOpts = useMemo(
    () => (manifest ? manifest[dvhc].provinces.map((p) => ({ value: p.slug, label: p.name })) : []),
    [manifest, dvhc],
  );
  const regionOpts = REGION_ORDER.map((c) => ({ value: c, label: `${c} · ${REGION_LABEL_VI[c]}` }));

  // đảm bảo provinceSlug hợp lệ khi đổi cũ/mới
  useEffect(() => {
    if (provinceOpts.length && !provinceOpts.some((o) => o.value === provinceSlug)) {
      setProvinceSlug(provinceOpts[0].value);
    }
  }, [provinceOpts, provinceSlug]);

  const selProvinceName =
    provinceOpts.find((o) => o.value === provinceSlug)?.label ?? provinceSlug;

  const src =
    level === "region"
      ? `/coverage/${dvhc}/region/${regionCode}.geojson`
      : `/coverage/${dvhc}/province/${provinceSlug}.geojson`;

  const scopeLabel =
    level === "region"
      ? `vùng ${REGION_LABEL_VI[regionCode]}`
      : `tỉnh ${selProvinceName}`;

  const bcs = useMemo(() => {
    if (level === "region") return getCoverageBcs(filter, "region", regionCode);
    const appCode = appByNorm.get(normName(selProvinceName)) ?? "";
    return appCode ? getCoverageBcs(filter, "province", appCode) : [];
  }, [filter, level, regionCode, selProvinceName, appByNorm]);

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Phạm vi BC" }]}
        title="Phạm vi BC"
        subtitle="Bản đồ phủ ranh giới phường/xã thật + vị trí bưu cục. Chọn ĐVHC (cũ/mới), xem theo Vùng (gộp tỉnh) hoặc theo Tỉnh."
      />

      <div className="flex flex-wrap items-end gap-3">
        {/* ĐVHC cũ / mới */}
        <Toggle
          label="Đơn vị hành chính"
          value={dvhc}
          options={[
            { v: "new", l: "ĐVHC mới" },
            { v: "old", l: "ĐVHC cũ" },
          ]}
          onChange={(v) => setDvhc(v as Dvhc)}
        />
        {/* Cấp xem */}
        <Toggle
          label="Cấp xem"
          value={level}
          options={[
            { v: "region", l: "Theo vùng" },
            { v: "province", l: "Theo tỉnh" },
          ]}
          onChange={(v) => setLevel(v as Level)}
        />
        {/* Selector */}
        {level === "region" ? (
          <DimensionSelect
            label="Vùng"
            value={regionCode}
            options={regionOpts}
            onChange={(v) => v && setRegionCode(v as RegionCode)}
            allOptionLabel="Chọn vùng"
            width={240}
            searchable
          />
        ) : (
          <DimensionSelect
            label={`Tỉnh / Thành (${dvhc === "new" ? "mới" : "cũ"})`}
            value={provinceSlug}
            options={provinceOpts}
            onChange={(v) => v && setProvinceSlug(v)}
            allOptionLabel="Chọn tỉnh"
            width={240}
            searchable
          />
        )}
      </div>

      <CoverageMap src={src} bcs={bcs} scopeLabel={scopeLabel} height={MAP_H} />
    </div>
  );
}

function Toggle({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
        {label}
      </div>
      <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "px-3 py-1.5 text-sm whitespace-nowrap",
              value === o.v
                ? "bg-[var(--color-ghn-red)] text-white"
                : "bg-white text-[var(--color-text)] hover:bg-[var(--color-hover)]",
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
