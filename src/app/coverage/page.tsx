"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFilter } from "@/components/filter/FilterContext";
import { getCoverageBcList, getBcProfile } from "@/lib/aggregators";
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
type RegionSel = RegionCode | "ALL";
type Manifest = {
  old: { provinces: { slug: string; name: string }[]; regions: string[] };
  new: { provinces: { slug: string; name: string }[]; regions: string[] };
  oldToNew?: Record<string, string>;       // slug tỉnh cũ → tên tỉnh mới
  provinceRegion?: Record<string, string>; // slug tỉnh → vùng app
};
type Stats = { newWards: number; newUncovered: number; oldWards: number; oldUncovered: number } | null;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const REGION_ORDER: RegionCode[] = [
  "HCM", "HNO", "DSH", "DNB", "DCL", "TNB", "DBB", "BTB", "TTB", "NTB", "TNG", "TNT", "XBG", "TBB",
];
const MAP_H = "calc(100vh - 240px)";

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
  const [regionCode, setRegionCode] = useState<RegionSel>("HCM");
  const [provinceSlug, setProvinceSlug] = useState<string>("ho-chi-minh");
  const [selectedBcCode, setSelectedBcCode] = useState<string | null>(null);
  const [selectedWardCode, setSelectedWardCode] = useState<string | null>(null);
  const [wardFocusTick, setWardFocusTick] = useState(0);
  const [wardList, setWardList] = useState<{ code: string; name: string; prov: string }[]>([]);
  const [stats, setStats] = useState<Stats>(null);

  useEffect(() => {
    fetch("/coverage/manifest.json").then((r) => r.json()).then(setManifest).catch(() => {});
  }, []);

  const appByNorm = useMemo(() => {
    const m = new Map<string, string>();
    getProvinces().forEach((p) => m.set(normName(p.name), p.code));
    return m;
  }, []);

  const provinceOpts = useMemo(
    () => (manifest ? manifest[dvhc].provinces.map((p) => ({ value: p.slug, label: p.name })) : []),
    [manifest, dvhc],
  );
  // vùng có sẵn theo ĐVHC hiện tại (new thiếu XBG/TNB vì đã sáp nhập)
  const regionOpts = useMemo(() => {
    const avail = manifest ? manifest[dvhc].regions : [];
    const ordered = REGION_ORDER.filter((c) => avail.includes(c));
    return [
      { value: "ALL" as RegionSel, label: "Cả nước (tất cả tỉnh)" },
      ...ordered.map((c) => ({ value: c as RegionSel, label: `${c} · ${REGION_LABEL_VI[c]}` })),
    ];
  }, [manifest, dvhc]);

  // đổi cũ/mới mà vùng hiện tại không còn → về Cả nước
  useEffect(() => {
    if (regionCode !== "ALL" && manifest && !manifest[dvhc].regions.includes(regionCode)) {
      setRegionCode("ALL");
    }
  }, [manifest, dvhc, regionCode]);

  // đổi cũ/mới mà tỉnh hiện tại còn slug hợp lệ thì GIỮ NGUYÊN; không thì fallback
  useEffect(() => {
    if (provinceOpts.length && !provinceOpts.some((o) => o.value === provinceSlug)) {
      setProvinceSlug(provinceOpts[0].value);
    }
  }, [provinceOpts, provinceSlug]);

  // reset BC khi đổi SCOPE (không reset khi chỉ đổi cũ/mới — danh sách BC giữ nguyên)
  useEffect(() => {
    setSelectedBcCode(null);
  }, [level, regionCode, provinceSlug]);

  // reset phường khi đổi scope hoặc cũ/mới (bộ phường khác nhau)
  useEffect(() => {
    setSelectedWardCode(null);
  }, [level, regionCode, provinceSlug, dvhc]);

  const selProvinceName = provinceOpts.find((o) => o.value === provinceSlug)?.label ?? provinceSlug;

  const appCode = useMemo(() => {
    if (level !== "province") return "";
    if (dvhc === "new") return appByNorm.get(normName(selProvinceName)) ?? "";
    const newName = manifest?.oldToNew?.[provinceSlug];
    return newName ? appByNorm.get(normName(newName)) ?? "" : "";
  }, [level, dvhc, selProvinceName, provinceSlug, manifest, appByNorm]);

  const pathFor = (d: Dvhc) =>
    level === "region"
      ? `/coverage/${d}/region/${regionCode}.geojson`
      : `/coverage/${d}/province/${provinceSlug}.geojson`;
  const src = pathFor(dvhc);
  const otherSrc = pathFor(dvhc === "new" ? "old" : "new");

  const scopeLabel =
    level === "region"
      ? regionCode === "ALL" ? "cả nước" : `vùng ${REGION_LABEL_VI[regionCode as RegionCode]}`
      : `tỉnh ${selProvinceName}`;

  // Danh sách BC theo scope. Tỉnh không khớp tên app → fallback theo VÙNG (provinceRegion)
  // để không bị mất vị trí BC; fallback thì cap số BC theo số phường cho hợp lý.
  const { bcsRaw, isFallback } = useMemo(() => {
    if (level === "region") {
      return {
        bcsRaw: regionCode === "ALL" ? getCoverageBcList("all", "") : getCoverageBcList("region", regionCode),
        isFallback: false,
      };
    }
    if (appCode) {
      const list = getCoverageBcList("province", appCode);
      if (list.length) return { bcsRaw: list, isFallback: false };
    }
    const reg = manifest?.provinceRegion?.[provinceSlug];
    return { bcsRaw: reg ? getCoverageBcList("region", reg) : [], isFallback: true };
  }, [level, regionCode, appCode, manifest, provinceSlug]);

  const bcs = useMemo(() => {
    if (!isFallback || !wardList.length) return bcsRaw;
    const cap = clamp(Math.ceil(wardList.length / 8), 8, 60);
    return cap < bcsRaw.length ? bcsRaw.slice(0, cap) : bcsRaw;
  }, [bcsRaw, isFallback, wardList.length]);

  const bcOpts = useMemo(
    () => bcs.map((b) => ({ value: b.code, label: `${b.code} · ${b.name}` })),
    [bcs],
  );
  const wardOpts = useMemo(
    () => wardList.map((w) => ({ value: w.code, label: w.prov ? `${w.name} · ${w.prov}` : w.name })),
    [wardList],
  );

  const selectedProfile = useMemo(
    () => (selectedBcCode ? getBcProfile(filter, selectedBcCode) : null),
    [filter, selectedBcCode],
  );

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Phạm vi BC" }]}
        title="Phạm vi BC"
        subtitle="Bản đồ ranh giới phường/xã thật + vị trí bưu cục. Chọn ĐVHC (cũ/mới — màu khác nhau), xem theo Cả nước / Vùng / Tỉnh, lọc tới Phường/xã, hoặc chọn 1 bưu cục để xem phạm vi phụ trách."
      />

      <div className="flex flex-wrap items-end gap-3">
        <Toggle
          label="Đơn vị hành chính"
          value={dvhc}
          options={[{ v: "new", l: "ĐVHC mới" }, { v: "old", l: "ĐVHC cũ" }]}
          onChange={(v) => setDvhc(v as Dvhc)}
        />
        <Toggle
          label="Cấp xem"
          value={level}
          options={[{ v: "region", l: "Vùng / Cả nước" }, { v: "province", l: "Theo tỉnh" }]}
          onChange={(v) => setLevel(v as Level)}
        />
        {level === "region" ? (
          <DimensionSelect
            label="Vùng"
            value={regionCode}
            options={regionOpts}
            onChange={(v) => v && setRegionCode(v as RegionSel)}
            allOptionLabel="Chọn vùng"
            width={210}
            searchable
          />
        ) : (
          <DimensionSelect
            label={`Tỉnh / Thành (${dvhc === "new" ? "mới" : "cũ"})`}
            value={provinceSlug}
            options={provinceOpts}
            onChange={(v) => v && setProvinceSlug(v)}
            allOptionLabel="Chọn tỉnh"
            width={210}
            searchable
          />
        )}
        {/* Phường / xã — lọc theo scope đang xem */}
        <DimensionSelect
          label={`Phường/xã (${wardList.length})`}
          value={selectedWardCode ?? undefined}
          options={wardOpts}
          onChange={(v) => { setSelectedWardCode(v ?? null); if (v) setWardFocusTick((t) => t + 1); }}
          allOptionLabel="Tất cả phường/xã"
          width={230}
          searchable
          maxVisible={200}
        />
        {/* Bưu cục */}
        <DimensionSelect
          label={`Bưu cục (${bcs.length})`}
          value={selectedBcCode ?? undefined}
          options={bcOpts}
          onChange={(v) => setSelectedBcCode(v ?? null)}
          allOptionLabel="Tất cả bưu cục"
          width={240}
          searchable
          maxVisible={200}
        />
        {(selectedBcCode || selectedWardCode) && (
          <button
            type="button"
            onClick={() => { setSelectedBcCode(null); setSelectedWardCode(null); }}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-hover)]"
          >
            Bỏ chọn
          </button>
        )}
      </div>

      {/* Bảng thống kê — cập nhật theo filter */}
      <StatsBar scopeLabel={scopeLabel} bcCount={bcs.length} fallback={isFallback} stats={stats} />

      <CoverageMap
        src={src}
        otherSrc={otherSrc}
        dvhc={dvhc}
        bcs={bcs}
        selectedBcCode={selectedBcCode}
        selectedProfile={selectedProfile}
        onSelectBc={setSelectedBcCode}
        selectedWardCode={selectedWardCode}
        onSelectWard={(code) => setSelectedWardCode(code || null)}
        wardFocusTick={wardFocusTick}
        onWardsLoaded={setWardList}
        onStats={setStats}
        scopeLabel={scopeLabel}
        height={MAP_H}
      />
    </div>
  );
}

function StatsBar({
  scopeLabel, bcCount, fallback, stats,
}: {
  scopeLabel: string;
  bcCount: number;
  fallback: boolean;
  stats: Stats;
}) {
  const nf = (n: number | undefined) => (n == null ? "…" : n.toLocaleString("vi-VN"));
  const cells: { label: string; value: string; sub?: string; warn?: boolean }[] = [
    { label: "Số lượng BC", value: nf(bcCount), sub: fallback ? "ước lượng theo vùng" : undefined },
    { label: "Phường MỚI", value: nf(stats?.newWards) },
    { label: "Phường mới chưa có BC", value: nf(stats?.newUncovered), warn: !!stats?.newUncovered },
    { label: "Phường CŨ", value: nf(stats?.oldWards) },
    { label: "Phường cũ chưa có BC", value: nf(stats?.oldUncovered), warn: !!stats?.oldUncovered },
  ];
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white overflow-hidden">
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
        Thống kê — {scopeLabel}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-[var(--color-border)]">
        {cells.map((c) => (
          <div key={c.label} className="px-3 py-2">
            <div className="text-[11px] text-[var(--color-text-muted)]">{c.label}</div>
            <div className={cn("text-lg font-semibold", c.warn ? "text-[var(--color-ghn-red)]" : "text-[var(--color-text)]")}>
              {c.value}
            </div>
            {c.sub && <div className="text-[10px] text-[var(--color-text-faint)]">{c.sub}</div>}
          </div>
        ))}
      </div>
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
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">{label}</div>
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
