"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { REGION_LABEL_VI, type RegionCode } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { cn } from "@/lib/utils";
import type { CoverageMode, CoverageStats, PickType, BcInfo } from "@/components/ui/CoverageMap";

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

const REGION_ORDER: RegionCode[] = [
  "HCM", "HNO", "DSH", "DNB", "DCL", "TNB", "DBB", "BTB", "TTB", "NTB", "TNG", "TNT", "XBG", "TBB",
];
const PICK_TYPES: { v: PickType; l: string }[] = [
  { v: "DELIVERY", l: "Giao (DELIVERY)" }, { v: "PICK", l: "Lấy (PICK)" }, { v: "RETURN", l: "Trả (RETURN)" },
];
const MAP_H = "calc(100vh - 300px)";
function slugify(s: string): string {
  return s.replace(/Đ/g, "D").replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function CoveragePage() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [bcArr, setBcArr] = useState<BcInfo[]>([]);
  const [dvhc, setDvhc] = useState<Dvhc>("new");
  const [level, setLevel] = useState<Level>("region");
  const [regionCode, setRegionCode] = useState<RegionSel>("HCM");
  const [provinceSlugs, setProvinceSlugs] = useState<string[]>(["ho-chi-minh"]);
  const [mode, setMode] = useState<CoverageMode>("all");
  const [pickType, setPickType] = useState<PickType>("DELIVERY");
  const [bcCodes, setBcCodes] = useState<string[]>([]);
  const [wardCodes, setWardCodes] = useState<string[]>([]);
  const [clickedWard, setClickedWard] = useState<string | null>(null);
  const [wardFocusTick, setWardFocusTick] = useState(0);
  const [wardList, setWardList] = useState<{ code: string; name: string; prov: string }[]>([]);
  const [stats, setStats] = useState<Stats>(null);
  const [openList, setOpenList] = useState<null | "new" | "old">(null);
  const [bcsInScope, setBcsInScope] = useState<string[]>([]);
  const [focusWard, setFocusWard] = useState<string | null>(null);
  const [focusTick, setFocusTick] = useState(0);

  useEffect(() => {
    fetch("/coverage/manifest.json").then((r) => r.json()).then(setManifest).catch(() => {});
    fetch("/coverage/bc.json").then((r) => r.json()).then(setBcArr).catch(() => {});
  }, []);

  const bcById = useMemo(() => {
    const m: Record<string, BcInfo> = {};
    bcArr.forEach((b) => { m[b.id] = b; });
    return m;
  }, [bcArr]);

  const provinceOpts = useMemo(
    () => (manifest ? manifest[dvhc].provinces.map((p) => ({ value: p.slug, label: p.name })) : []),
    [manifest, dvhc],
  );
  const slugToName = useMemo(() => new Map(provinceOpts.map((o) => [o.value, o.label])), [provinceOpts]);

  const { newToOldSlugs, oldToNewSlug } = useMemo(() => {
    const n2o = new Map<string, string[]>(); const o2n = new Map<string, string>();
    for (const [oldSlug, newName] of Object.entries(manifest?.oldToNew ?? {})) {
      const ns = slugify(newName); o2n.set(oldSlug, ns);
      (n2o.get(ns) ?? n2o.set(ns, []).get(ns)!).push(oldSlug);
    }
    return { newToOldSlugs: n2o, oldToNewSlug: o2n };
  }, [manifest]);

  const regionOpts = useMemo(() => {
    const avail = manifest ? manifest[dvhc].regions : [];
    return [
      { value: "ALL" as RegionSel, label: "Cả nước (tất cả tỉnh)" },
      ...REGION_ORDER.filter((c) => avail.includes(c)).map((c) => ({ value: c as RegionSel, label: `${c} · ${REGION_LABEL_VI[c]}` })),
    ];
  }, [manifest, dvhc]);

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

  const scopeKey = `${level}|${regionCode}|${provinceSlugs.join(",")}`;
  useEffect(() => { setBcCodes([]); setWardCodes([]); setClickedWard(null); setFocusWard(null); }, [scopeKey]);
  // đổi dvhc chỉ reset wardCodes (clickedWard/focusWard giữ để navigate sang bộ kia được)
  useEffect(() => { setWardCodes([]); }, [dvhc]);
  useEffect(() => { setBcCodes([]); setClickedWard(null); }, [pickType]);

  // bấm 1 phường trong danh sách "chưa có BC" → navigate tới polygon đó (đổi ĐVHC nếu cần)
  const focusUncoveredWard = (code: string, system: "new" | "old") => {
    setBcCodes([]); setWardCodes([]);
    if (system !== dvhc) setDvhc(system);
    setClickedWard(code); setFocusWard(code); setFocusTick((t) => t + 1);
  };

  const activeSlugs = useMemo(() => {
    if (level === "province") return provinceSlugs;
    if (regionCode === "ALL" || !manifest) return [];
    return manifest[dvhc].provinces.filter((p) => manifest.provinceRegion?.[p.slug] === regionCode).map((p) => p.slug);
  }, [level, provinceSlugs, regionCode, manifest, dvhc]);

  // Dùng province files (mịn hơn region file) để ranh giới chính xác, ít hở/đè.
  // Chỉ cả nước (ALL) mới dùng file region/ALL gộp (zoom xa, không thấy hở).
  const srcs = useMemo(() => {
    if (level === "province") return provinceSlugs.map((s) => `/coverage/${dvhc}/province/${s}.geojson`);
    if (regionCode === "ALL") return [`/coverage/${dvhc}/region/ALL.geojson`];
    return activeSlugs.map((s) => `/coverage/${dvhc}/province/${s}.geojson`);
  }, [level, dvhc, regionCode, provinceSlugs, activeSlugs]);
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

  const mapSrcs = useMemo(() => [`/coverage/bcmap/${pickType}_${dvhc}.json`], [pickType, dvhc]);
  const otherMapSrcs = useMemo(() => [`/coverage/bcmap/${pickType}_${dvhc === "new" ? "old" : "new"}.json`], [pickType, dvhc]);

  const scopeLabel =
    level === "region"
      ? regionCode === "ALL" ? "cả nước" : `vùng ${REGION_LABEL_VI[regionCode as RegionCode]}`
      : provinceSlugs.length === 1 ? `tỉnh ${slugToName.get(provinceSlugs[0]) ?? provinceSlugs[0]}` : `${provinceSlugs.length} tỉnh`;

  const bcOpts = useMemo(() => bcsInScope
    .map((id) => bcById[id]).filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "vi"))
    .map((b) => ({ value: b.id, label: `${b.id} · ${b.name}` })),
    [bcsInScope, bcById]);
  const wardOpts = useMemo(() => {
    const seen = new Set<string>();
    return wardList.filter((w) => w.code && !seen.has(w.code) && seen.add(w.code))
      .map((w) => ({ value: w.code, label: w.prov ? `${w.name} · ${w.prov}` : w.name }));
  }, [wardList]);

  const selectedBc = bcCodes.length === 1 ? bcById[bcCodes[0]] ?? null : null;
  const toggleBc = (id: string) => setBcCodes((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  useEffect(() => { if (bcCodes.length || wardCodes.length) setWardFocusTick((t) => t + 1); }, [bcCodes, wardCodes]);
  const hasFilter = bcCodes.length > 0 || wardCodes.length > 0 || !!clickedWard;

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Phạm vi BC" }]}
        title="Phạm vi BC"
        subtitle="Ranh giới phường/xã thật + bưu cục thật (dim_warehouse). Lọc theo hình thức Giao/Lấy/Trả, ĐVHC cũ/mới, Cả nước/Vùng/nhiều Tỉnh/Phường/BC. Bấm phường để xem BC phụ trách; Ctrl+click chọn nhiều phường."
      />

      <div className="flex flex-wrap items-end gap-3">
        <Toggle label="Hình thức hoạt động" value={pickType} options={PICK_TYPES.map((p) => ({ v: p.v, l: p.l }))} onChange={(v) => setPickType(v as PickType)} />
        <Toggle label="Đơn vị hành chính" value={dvhc} options={[{ v: "new", l: "ĐVHC mới" }, { v: "old", l: "ĐVHC cũ" }]} onChange={(v) => setDvhc(v as Dvhc)} />
        <Toggle label="Cấp xem" value={level} options={[{ v: "region", l: "Vùng / Cả nước" }, { v: "province", l: "Theo tỉnh" }]} onChange={(v) => setLevel(v as Level)} />
        <Toggle label="Chế độ" value={mode} options={[{ v: "all", l: "Hiện tất cả" }, { v: "only", l: "Chỉ phần lọc" }]} onChange={(v) => setMode(v as CoverageMode)} />

        {level === "region" ? (
          <DimensionSelect label="Vùng" value={regionCode} options={regionOpts} onChange={(v) => v && setRegionCode(v as RegionSel)} allOptionLabel="Chọn vùng" width={200} searchable />
        ) : (
          <MultiSelect label={`Tỉnh/Thành (${provinceSlugs.length})`} values={provinceSlugs} options={provinceOpts}
            onChange={(v) => setProvinceSlugs(v.length ? v : provinceOpts.length ? [provinceOpts[0].value] : [])}
            emptyLabel="Chọn tỉnh" width={200} searchable maxVisible={200} />
        )}
        <MultiSelect label={`Phường/xã (${wardCodes.length || wardList.length})`} values={wardCodes} options={wardOpts} onChange={setWardCodes} emptyLabel="Tất cả phường/xã" width={210} searchable maxVisible={200} />
        <MultiSelect label={`Bưu cục (${bcCodes.length || bcsInScope.length})`} values={bcCodes} options={bcOpts} onChange={setBcCodes} emptyLabel="Tất cả bưu cục" width={230} searchable maxVisible={200} />

        {hasFilter && (
          <button type="button" onClick={() => { setBcCodes([]); setWardCodes([]); setClickedWard(null); }}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-hover)]">Bỏ chọn</button>
        )}
      </div>

      <StatsBar scopeLabel={`${scopeLabel} · ${pickType}`} bcCount={stats?.bcCount ?? bcsInScope.length} stats={stats}
        openList={openList} onToggleList={(k) => setOpenList((c) => (c === k ? null : k))} onFocusWard={focusUncoveredWard} />

      <CoverageMap
        srcs={srcs} otherSrcs={otherSrcs} mapSrcs={mapSrcs} otherMapSrcs={otherMapSrcs}
        bcById={bcById} dvhc={dvhc} mode={mode}
        bcCodes={bcCodes} wardCodes={wardCodes} clickedWard={clickedWard}
        onClickWard={(code, additive) => {
          if (!code) { setClickedWard(null); return; }
          if (additive) setWardCodes((p) => (p.includes(code) ? p.filter((x) => x !== code) : [...p, code]));
          else setClickedWard(code);
        }}
        onToggleBc={toggleBc}
        selectedBc={selectedBc}
        wardFocusTick={wardFocusTick}
        focusWard={focusWard}
        focusTick={focusTick}
        onWardsLoaded={setWardList}
        onStats={setStats}
        onBcsInScope={setBcsInScope}
        scopeLabel={scopeLabel}
        height={MAP_H}
      />
    </div>
  );
}

function StatsBar({ scopeLabel, bcCount, stats, openList, onToggleList, onFocusWard }: {
  scopeLabel: string; bcCount: number; stats: Stats;
  openList: null | "new" | "old"; onToggleList: (k: "new" | "old") => void;
  onFocusWard: (code: string, system: "new" | "old") => void;
}) {
  const nf = (n: number | undefined) => (n == null ? "…" : n.toLocaleString("vi-VN"));
  const cells: { label: string; value: string; warn?: boolean; listKey?: "new" | "old"; count?: number }[] = [
    { label: "Số lượng BC", value: nf(bcCount) },
    { label: "BC chưa gán P.mới", value: nf(stats?.bcNoNew), warn: !!stats?.bcNoNew },
    { label: "BC chưa gán P.cũ", value: nf(stats?.bcNoOld), warn: !!stats?.bcNoOld },
    { label: "Phường MỚI", value: nf(stats?.newWards) },
    { label: "Phường mới chưa có BC", value: nf(stats?.newUncovered), warn: !!stats?.newUncovered, listKey: "new", count: stats?.newUncovered ?? 0 },
    { label: "Phường CŨ", value: nf(stats?.oldWards) },
    { label: "Phường cũ chưa có BC", value: nf(stats?.oldUncovered), warn: !!stats?.oldUncovered, listKey: "old", count: stats?.oldUncovered ?? 0 },
  ];
  const list: UncWard[] = openList === "new" ? stats?.newUncoveredList ?? [] : openList === "old" ? stats?.oldUncoveredList ?? [] : [];
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-white overflow-hidden">
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-border)]">Thống kê — {scopeLabel}</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y lg:divide-y-0 divide-[var(--color-border)]">
        {cells.map((c) => {
          const clickable = c.listKey && (c.count ?? 0) > 0;
          const active = openList === c.listKey && clickable;
          return (
            <button key={c.label} type="button" disabled={!clickable} onClick={() => clickable && onToggleList(c.listKey!)}
              className={cn("px-3 py-2 text-left", clickable ? "cursor-pointer hover:bg-[var(--color-hover)]" : "cursor-default", active && "bg-[var(--color-row-selected)]")}>
              <div className="text-[11px] text-[var(--color-text-muted)] leading-tight">{c.label}{clickable && <span className="ml-1">▾</span>}</div>
              <div className={cn("text-lg font-semibold", c.warn ? "text-[var(--color-ghn-red)]" : "text-[var(--color-text)]")}>{c.value}</div>
            </button>
          );
        })}
      </div>
      {openList && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-hover)]/40">
          <div className="px-3 py-1.5 text-[11px] text-[var(--color-text-muted)]">Danh sách phường {openList === "new" ? "MỚI" : "CŨ"} chưa có BC phụ trách ({list.length}) — bấm để xem trên bản đồ</div>
          <div className="max-h-44 overflow-auto px-2 pb-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-0.5">
            {list.length === 0 ? <div className="text-xs text-[var(--color-text-muted)] px-1">—</div> : (
              <>
                {list.slice(0, 400).map((w, i) => (
                  <button key={`${w.code}-${i}`} type="button" onClick={() => onFocusWard(w.code, openList)}
                    className="text-xs text-[var(--color-text)] truncate text-left hover:text-[var(--color-ghn-red)] hover:underline" title={`${w.name} · ${w.prov} — bấm để xem`}>
                    {w.name}<span className="text-[var(--color-text-faint)]"> · {w.prov}</span>
                  </button>
                ))}
                {list.length > 400 && <div className="text-xs text-[var(--color-text-muted)] px-1">… +{(list.length - 400).toLocaleString("vi-VN")} phường nữa</div>}
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
            className={cn("px-3 py-1.5 text-sm whitespace-nowrap", value === o.v ? "bg-[var(--color-ghn-red)] text-white" : "bg-white text-[var(--color-text)] hover:bg-[var(--color-hover)]")}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}
