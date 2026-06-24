"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useFilter } from "@/components/filter/FilterContext";
import { getCoverageBcList, getBcProfile, type CoverageBcLite } from "@/lib/aggregators";
import { getProvinces } from "@/lib/mock-data";
import { REGION_LABEL_VI, type RegionCode } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { cn } from "@/lib/utils";
import type { CoverageMode, CoverageStats } from "@/components/ui/CoverageMap";

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
  oldToNew?: Record<string, string>;
  provinceRegion?: Record<string, string>;
};
type Stats = CoverageStats;
type UncWard = { code: string; name: string; prov: string };
function slugify(s: string): string {
  return s.replace(/Đ/g, "D").replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

const REGION_ORDER: RegionCode[] = [
  "HCM", "HNO", "DSH", "DNB", "DCL", "TNB", "DBB", "BTB", "TTB", "NTB", "TNG", "TNT", "XBG", "TBB",
];
const MAP_H = "calc(100vh - 300px)";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

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
  const [provinceSlugs, setProvinceSlugs] = useState<string[]>(["ho-chi-minh"]);
  const [mode, setMode] = useState<CoverageMode>("all");
  const [bcCodes, setBcCodes] = useState<string[]>([]);
  const [wardCodes, setWardCodes] = useState<string[]>([]);
  const [clickedWard, setClickedWard] = useState<string | null>(null);
  const [wardFocusTick, setWardFocusTick] = useState(0);
  const [wardList, setWardList] = useState<{ code: string; name: string; prov: string }[]>([]);
  const [stats, setStats] = useState<Stats>(null);
  const [openList, setOpenList] = useState<null | "new" | "old">(null);

  useEffect(() => {
    fetch("/coverage/manifest.json").then((r) => r.json()).then(setManifest).catch(() => {});
  }, []);

  const appByNorm = useMemo(() => {
    const m = new Map<string, string>();
    getProvinces().forEach((p) => m.set(normName(p.name), p.code));
    return m;
  }, []);

  // toàn bộ BC cả nước (vị trí cố định) → tính "chưa có BC" cộng dồn khớp các cấp
  const allBcs = useMemo(() => getCoverageBcList("all", ""), []);

  // tương ứng lãnh thổ giữa ĐVHC cũ ↔ mới (để đếm bộ kia đúng cùng vùng đất)
  const { newToOldSlugs, oldToNewSlug } = useMemo(() => {
    const n2o = new Map<string, string[]>();
    const o2n = new Map<string, string>();
    const o2nName = manifest?.oldToNew ?? {};
    for (const [oldSlug, newName] of Object.entries(o2nName)) {
      const newSlug = slugify(newName);
      o2n.set(oldSlug, newSlug);
      if (!n2o.has(newSlug)) n2o.set(newSlug, []);
      n2o.get(newSlug)!.push(oldSlug);
    }
    return { newToOldSlugs: n2o, oldToNewSlug: o2n };
  }, [manifest]);

  const provinceOpts = useMemo(
    () => (manifest ? manifest[dvhc].provinces.map((p) => ({ value: p.slug, label: p.name })) : []),
    [manifest, dvhc],
  );
  const slugToName = useMemo(() => {
    const m = new Map<string, string>();
    provinceOpts.forEach((o) => m.set(o.value, o.label));
    return m;
  }, [provinceOpts]);

  const regionOpts = useMemo(() => {
    const avail = manifest ? manifest[dvhc].regions : [];
    const ordered = REGION_ORDER.filter((c) => avail.includes(c));
    return [
      { value: "ALL" as RegionSel, label: "Cả nước (tất cả tỉnh)" },
      ...ordered.map((c) => ({ value: c as RegionSel, label: `${c} · ${REGION_LABEL_VI[c]}` })),
    ];
  }, [manifest, dvhc]);

  // đổi cũ/mới: giữ tỉnh còn slug hợp lệ; vùng không còn → Cả nước
  useEffect(() => {
    if (!provinceOpts.length) return;
    setProvinceSlugs((prev) => {
      const valid = prev.filter((s) => provinceOpts.some((o) => o.value === s));
      return valid.length ? valid : [provinceOpts[0].value];
    });
  }, [provinceOpts]);
  useEffect(() => {
    if (regionCode !== "ALL" && manifest && !manifest[dvhc].regions.includes(regionCode)) setRegionCode("ALL");
  }, [manifest, dvhc, regionCode]);

  // reset lựa chọn lọc khi đổi SCOPE
  const scopeKey = `${level}|${regionCode}|${provinceSlugs.join(",")}`;
  useEffect(() => {
    setBcCodes([]); setWardCodes([]); setClickedWard(null);
  }, [scopeKey]);
  // đổi cũ/mới: bộ phường khác → reset phường + click (giữ BC)
  useEffect(() => {
    setWardCodes([]); setClickedWard(null);
  }, [dvhc]);

  const appCodeFor = (slug: string): string => {
    if (dvhc === "new") return appByNorm.get(normName(slugToName.get(slug) ?? "")) ?? "";
    const newName = manifest?.oldToNew?.[slug];
    return newName ? appByNorm.get(normName(newName)) ?? "" : "";
  };

  // các tỉnh (slug theo dvhc hiện tại) thuộc scope đang xem
  const activeSlugs = useMemo(() => {
    if (level === "province") return provinceSlugs;
    if (regionCode === "ALL" || !manifest) return [];
    return manifest[dvhc].provinces.filter((p) => manifest.provinceRegion?.[p.slug] === regionCode).map((p) => p.slug);
  }, [level, provinceSlugs, regionCode, manifest, dvhc]);

  const srcs = useMemo(() =>
    level === "region"
      ? [`/coverage/${dvhc}/region/${regionCode}.geojson`]
      : provinceSlugs.map((s) => `/coverage/${dvhc}/province/${s}.geojson`),
    [level, dvhc, regionCode, provinceSlugs],
  );

  // bộ ĐVHC còn lại — lấy đúng LÃNH THỔ tương ứng (qua oldToNew) để số liệu cộng dồn khớp
  const otherSrcs = useMemo(() => {
    const od: Dvhc = dvhc === "new" ? "old" : "new";
    if (level === "region" && regionCode === "ALL") return [`/coverage/${od}/region/ALL.geojson`];
    const others = new Set<string>();
    for (const s of activeSlugs) {
      if (dvhc === "new") (newToOldSlugs.get(s) ?? []).forEach((o) => others.add(o));
      else { const ns = oldToNewSlug.get(s); if (ns) others.add(ns); }
    }
    return [...others].map((s) => `/coverage/${od}/province/${s}.geojson`);
  }, [dvhc, level, regionCode, activeSlugs, newToOldSlugs, oldToNewSlug]);

  const scopeLabel =
    level === "region"
      ? regionCode === "ALL" ? "cả nước" : `vùng ${REGION_LABEL_VI[regionCode as RegionCode]}`
      : provinceSlugs.length === 1
        ? `tỉnh ${slugToName.get(provinceSlugs[0]) ?? provinceSlugs[0]}`
        : `${provinceSlugs.length} tỉnh`;

  // BC theo scope (tỉnh: union matched + fallback theo vùng)
  const { bcsRaw, isFallback } = useMemo(() => {
    if (level === "region") {
      return {
        bcsRaw: regionCode === "ALL" ? getCoverageBcList("all", "") : getCoverageBcList("region", regionCode),
        isFallback: false,
      };
    }
    const matched: CoverageBcLite[] = [];
    const fallback: CoverageBcLite[] = [];
    let anyFallback = false;
    for (const slug of provinceSlugs) {
      const appCode = appCodeFor(slug);
      const exact = appCode ? getCoverageBcList("province", appCode) : [];
      if (exact.length) { matched.push(...exact); continue; }
      const reg = manifest?.provinceRegion?.[slug];
      if (reg) { fallback.push(...getCoverageBcList("region", reg)); anyFallback = true; }
    }
    const seen = new Set<string>();
    const merged = [...matched, ...fallback].filter((b) => (seen.has(b.code) ? false : seen.add(b.code)));
    return { bcsRaw: merged, isFallback: anyFallback };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, regionCode, provinceSlugs, manifest, dvhc, slugToName, appByNorm]);

  const bcs = useMemo(() => {
    if (!isFallback || !wardList.length) return bcsRaw;
    const cap = clamp(Math.ceil(wardList.length / 8), 8, 80);
    return cap < bcsRaw.length ? bcsRaw.slice(0, cap) : bcsRaw;
  }, [bcsRaw, isFallback, wardList.length]);

  const bcOpts = useMemo(() => bcs.map((b) => ({ value: b.code, label: `${b.code} · ${b.name}` })), [bcs]);
  const wardOpts = useMemo(() => {
    const seen = new Set<string>();
    return wardList
      .filter((w) => w.code && !seen.has(w.code) && seen.add(w.code))
      .map((w) => ({ value: w.code, label: w.prov ? `${w.name} · ${w.prov}` : w.name }));
  }, [wardList]);

  const profileBcCode = bcCodes.length === 1 ? bcCodes[0] : null;
  const selectedProfile = useMemo(
    () => (profileBcCode ? getBcProfile(filter, profileBcCode) : null),
    [filter, profileBcCode],
  );

  const toggleBc = (code: string) =>
    setBcCodes((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));

  // zoom tới vùng lọc khi đổi filter qua dropdown/marker (không zoom khi click polygon)
  useEffect(() => {
    if (bcCodes.length || wardCodes.length) setWardFocusTick((t) => t + 1);
  }, [bcCodes, wardCodes]);

  const hasFilter = bcCodes.length > 0 || wardCodes.length > 0 || !!clickedWard;

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Phạm vi BC" }]}
        title="Phạm vi BC"
        subtitle="Ranh giới phường/xã thật + vị trí bưu cục. ĐVHC cũ/mới (màu khác nhau), lọc Cả nước / Vùng / nhiều Tỉnh / nhiều Phường / nhiều Bưu cục. Bấm 1 phường để highlight bưu cục phụ trách."
      />

      <div className="flex flex-wrap items-end gap-3">
        <Toggle label="Đơn vị hành chính" value={dvhc}
          options={[{ v: "new", l: "ĐVHC mới" }, { v: "old", l: "ĐVHC cũ" }]} onChange={(v) => setDvhc(v as Dvhc)} />
        <Toggle label="Cấp xem" value={level}
          options={[{ v: "region", l: "Vùng / Cả nước" }, { v: "province", l: "Theo tỉnh" }]} onChange={(v) => setLevel(v as Level)} />
        <Toggle label="Chế độ hiển thị" value={mode}
          options={[{ v: "all", l: "Hiện tất cả" }, { v: "only", l: "Chỉ phần lọc" }]} onChange={(v) => setMode(v as CoverageMode)} />

        {level === "region" ? (
          <DimensionSelect label="Vùng" value={regionCode} options={regionOpts}
            onChange={(v) => v && setRegionCode(v as RegionSel)} allOptionLabel="Chọn vùng" width={200} searchable />
        ) : (
          <MultiSelect label={`Tỉnh/Thành (${provinceSlugs.length})`} values={provinceSlugs} options={provinceOpts}
            onChange={(v) => setProvinceSlugs(v.length ? v : provinceOpts.length ? [provinceOpts[0].value] : [])}
            emptyLabel="Chọn tỉnh" width={210} searchable maxVisible={200} />
        )}

        <MultiSelect label={`Phường/xã (${wardCodes.length || wardList.length})`} values={wardCodes} options={wardOpts}
          onChange={setWardCodes} emptyLabel="Tất cả phường/xã" width={220} searchable maxVisible={200} />
        <MultiSelect label={`Bưu cục (${bcCodes.length || bcs.length})`} values={bcCodes} options={bcOpts}
          onChange={setBcCodes} emptyLabel="Tất cả bưu cục" width={230} searchable maxVisible={200} />

        {hasFilter && (
          <button type="button"
            onClick={() => { setBcCodes([]); setWardCodes([]); setClickedWard(null); }}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-hover)]">
            Bỏ chọn
          </button>
        )}
      </div>

      <StatsBar
        scopeLabel={scopeLabel}
        bcCount={bcs.length}
        fallback={isFallback}
        stats={stats}
        openList={openList}
        onToggleList={(k) => setOpenList((cur) => (cur === k ? null : k))}
      />

      <CoverageMap
        srcs={srcs}
        otherSrcs={otherSrcs}
        dvhc={dvhc}
        bcs={bcs}
        allBcs={allBcs}
        mode={mode}
        bcCodes={bcCodes}
        wardCodes={wardCodes}
        clickedWard={clickedWard}
        onClickWard={(code, additive) => {
          if (!code) { setClickedWard(null); return; }
          if (additive) setWardCodes((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
          else setClickedWard(code);
        }}
        onToggleBc={toggleBc}
        profileBcCode={profileBcCode}
        selectedProfile={selectedProfile}
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
  scopeLabel, bcCount, fallback, stats, openList, onToggleList,
}: {
  scopeLabel: string; bcCount: number; fallback: boolean; stats: Stats;
  openList: null | "new" | "old"; onToggleList: (k: "new" | "old") => void;
}) {
  const nf = (n: number | undefined) => (n == null ? "…" : n.toLocaleString("vi-VN"));
  const cells: { label: string; value: string; sub?: string; warn?: boolean; listKey?: "new" | "old"; count?: number }[] = [
    { label: "Số lượng BC", value: nf(bcCount), sub: fallback ? "ước lượng theo vùng" : undefined },
    { label: "Phường MỚI", value: nf(stats?.newWards) },
    { label: "Phường mới chưa có BC", value: nf(stats?.newUncovered), warn: !!stats?.newUncovered, listKey: "new", count: stats?.newUncovered ?? 0 },
    { label: "Phường CŨ", value: nf(stats?.oldWards) },
    { label: "Phường cũ chưa có BC", value: nf(stats?.oldUncovered), warn: !!stats?.oldUncovered, listKey: "old", count: stats?.oldUncovered ?? 0 },
  ];
  const list: UncWard[] = openList === "new" ? stats?.newUncoveredList ?? [] : openList === "old" ? stats?.oldUncoveredList ?? [] : [];
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white overflow-hidden">
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
        Thống kê — {scopeLabel}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-[var(--color-border)]">
        {cells.map((c) => {
          const clickable = c.listKey && (c.count ?? 0) > 0;
          const active = openList === c.listKey && clickable;
          return (
            <button
              key={c.label}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onToggleList(c.listKey!)}
              className={cn(
                "px-3 py-2 text-left",
                clickable ? "cursor-pointer hover:bg-[var(--color-hover)]" : "cursor-default",
                active && "bg-[var(--color-row-selected)]",
              )}
            >
              <div className="text-[11px] text-[var(--color-text-muted)]">
                {c.label}{clickable && <span className="ml-1">▾</span>}
              </div>
              <div className={cn("text-lg font-semibold", c.warn ? "text-[var(--color-ghn-red)]" : "text-[var(--color-text)]")}>{c.value}</div>
              {c.sub && <div className="text-[10px] text-[var(--color-text-faint)]">{c.sub}</div>}
            </button>
          );
        })}
      </div>
      {openList && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-hover)]/40">
          <div className="px-3 py-1.5 text-[11px] text-[var(--color-text-muted)] flex items-center justify-between">
            <span>Danh sách phường {openList === "new" ? "MỚI" : "CŨ"} chưa có BC phụ trách ({list.length})</span>
          </div>
          <div className="max-h-44 overflow-auto px-2 pb-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-0.5">
            {list.length === 0 ? (
              <div className="text-xs text-[var(--color-text-muted)] px-1">—</div>
            ) : (
              <>
                {list.slice(0, 400).map((w, i) => (
                  <div key={`${w.code}-${i}`} className="text-xs text-[var(--color-text)] truncate" title={`${w.name} · ${w.prov}`}>
                    {w.name}<span className="text-[var(--color-text-faint)]"> · {w.prov}</span>
                  </div>
                ))}
                {list.length > 400 && (
                  <div className="text-xs text-[var(--color-text-muted)] px-1">… +{(list.length - 400).toLocaleString("vi-VN")} phường nữa</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, value, options, onChange }: { label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">{label}</div>
      <div className="inline-flex rounded-md border border-[var(--color-border)] overflow-hidden">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)}
            className={cn("px-3 py-1.5 text-sm whitespace-nowrap",
              value === o.v ? "bg-[var(--color-ghn-red)] text-white" : "bg-white text-[var(--color-text)] hover:bg-[var(--color-hover)]")}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
