"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFilter } from "@/components/filter/FilterContext";
import { getTerritoryMap } from "@/lib/aggregators";
import { getProvinces } from "@/lib/mock-data";
import { REGION_LABEL_VI, type RegionCode } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { cn } from "@/lib/utils";

const LeafletTerritoryMap = dynamic(
  () => import("@/components/ui/LeafletTerritoryMap").then((m) => m.LeafletTerritoryMap),
  { ssr: false, loading: () => <div className="h-[70vh] ghn-skeleton rounded-md" /> },
);
const RegionCoverageMap = dynamic(
  () => import("@/components/ui/RegionCoverageMap").then((m) => m.RegionCoverageMap),
  { ssr: false, loading: () => <div className="h-[70vh] ghn-skeleton rounded-md" /> },
);

// Vùng có dữ liệu ward (từ ward2). XBG/TBB là vùng mới chưa có tỉnh.
const REGION_ORDER: RegionCode[] = [
  "HCM", "HNO", "DSH", "DNB", "DCL", "TNB", "DBB", "BTB", "TTB", "NTB", "TNG", "TNT", "XBG", "TBB",
];

const MAP_H = "calc(100vh - 230px)";

export default function CoveragePage() {
  const { filter } = useFilter();
  const [mode, setMode] = useState<"region" | "province">("region");
  const [regionCode, setRegionCode] = useState<RegionCode>("HCM");
  const [provinceCode, setProvinceCode] = useState<string>("HCM");

  const provinceOpts = useMemo(
    () => getProvinces().map((p) => ({ value: p.code, label: p.name })),
    [],
  );
  const regionOpts = REGION_ORDER.map((c) => ({
    value: c,
    label: `${c} · ${REGION_LABEL_VI[c]}`,
  }));

  const territory = useMemo(
    () => (mode === "province" ? getTerritoryMap(filter, provinceCode) : null),
    [mode, filter, provinceCode],
  );

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Phạm vi BC" }]}
        title="Phạm vi BC"
        subtitle="Bản đồ phủ ranh giới phường thật. Xem theo Vùng (gộp các tỉnh) hoặc theo Tỉnh (chi tiết + gán BC). Tô màu theo mức cần chú ý."
      />

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            Cấp xem
          </div>
          <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden">
            {(["region", "province"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-sm",
                  mode === m
                    ? "bg-[var(--color-ghn-red)] text-white"
                    : "bg-white text-[var(--color-text)] hover:bg-[var(--color-hover)]",
                )}
              >
                {m === "region" ? "Theo vùng" : "Theo tỉnh"}
              </button>
            ))}
          </div>
        </div>

        {mode === "region" ? (
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
            label="Tỉnh / Thành"
            value={provinceCode}
            options={provinceOpts}
            onChange={(v) => v && setProvinceCode(v)}
            allOptionLabel="Chọn tỉnh"
            width={220}
            searchable
          />
        )}
      </div>

      {/* Map full-screen */}
      {mode === "region" ? (
        <RegionCoverageMap
          src={`/wards-region/${regionCode}.geojson`}
          scopeLabel={REGION_LABEL_VI[regionCode]}
          height={MAP_H}
        />
      ) : (
        territory && <LeafletTerritoryMap data={territory} height={MAP_H} />
      )}
    </div>
  );
}
