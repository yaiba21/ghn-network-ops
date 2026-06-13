// Seeded mock data store for GHN Network Ops dashboard.
// Single source of truth — every page reads from here.
// Stable across reloads because seedrandom uses a fixed master seed.
// Function signatures mirror the future real API so swapping is a 1:1 replacement.

import seedrandom from "seedrandom";
import { addDays, differenceInDays, format, parseISO, startOfWeek } from "date-fns";
import { KPI, statusFromValue } from "./kpi-config";
import { lastNDays, toISODate } from "./utils";
import type {
  AlertItem,
  BcGiaoKpis,
  BcHoanKpis,
  BcNhanKpis,
  CostByCategory,
  CostCategoryRow,
  CostStack,
  FilterState,
  JourneyKpis,
  JourneyStageKey,
  JourneyStageSummary,
  PickupKpis,
  FunnelStep,
  HeatmapData,
  HistogramBucket,
  KpiDirection,
  Ktc,
  KtcStatusRow,
  Lane,
  LanePerfRow,
  LeadTime,
  MisRouteRow,
  NetworkKpis,
  OpsScorecardRow,
  OverallKpis,
  PipelineHealthRow,
  Province,
  QualityRow,
  Region,
  RegionCode,
  RoutingKpis,
  SeriesPoint,
  ServiceBreakdownRow,
  ServiceCoverage,
  ServiceType,
  Status,
  TimePoint,
  VolumeStack,
  District,
  Ward,
  KpiValue,
  OverviewBigKpis,
  ModuleHealthItem,
  OverviewTrends,
  RegionSnapshotRow,
  OverviewGauge,
  OrderJourneyKpis,
  LeadTimeBox,
  SankeyEdge,
  OrderRow,
  OrderTimeline,
  OrderTimelineEvent,
  OdMetric,
  RoutingDecisionRow,
  ReRouteTriggerRow,
  ProvinceCoverageRow,
  // Phase 1 — dimensions + fact tables
  Bc,
  CaCode,
  ChannelCode,
  FactDelivery,
  FactOrder,
  FactPickup,
  FactTrip,
  FinalStatus,
  LoaiBcCode,
  LoaiHang,
  LoaiTuyen,
  OrderState,
  SlaDays,
  TripType,
} from "./types";

// =======================================================================
// 0. Constants & master RNG
// =======================================================================

const MASTER_SEED = "ghn-network-ops";
const SERVICES: ServiceType[] = ["standard", "bulky", "express"];
const TODAY = "2026-05-20"; // matches the harness's currentDate; gives stable history
const HISTORY_DAYS = 365;
const SPARKLINE_DAYS = 14;

// =======================================================================
// 1. Geo dimensions (3 vùng → 34 tỉnh → ~3 quận/tỉnh → ~200 phường)
// HN + HCM chiếm ~35% tổng sản lượng (theo spec)
// =======================================================================

// 14 vùng GHN — mã 3 ký tự theo spec
const REGIONS: Region[] = [
  { code: "HNO", name: "Hà Nội" },
  { code: "DSH", name: "Đồng bằng Sông Hồng" },
  { code: "TNT", name: "Tây Nam Thủ đô" },
  { code: "XBG", name: "Xứ Bắc Giang" },
  { code: "TBB", name: "Tây Bắc Bộ" },
  { code: "DBB", name: "Đông Bắc Bộ" },
  { code: "BTB", name: "Bắc Trung Bộ" },
  { code: "TTB", name: "Trung Trung Bộ" },
  { code: "TNG", name: "Tây Nguyên" },
  { code: "NTB", name: "Nam Trung Bộ" },
  { code: "HCM", name: "Hồ Chí Minh" },
  { code: "DNB", name: "Đông Nam Bộ" },
  { code: "DCL", name: "ĐB Cửu Long" },
  { code: "TNB", name: "Tây Nam Bộ" },
];

// 34 tỉnh map vào 14 vùng GHN
const PROVINCES: Province[] = [
  // HNO — Hà Nội
  { code: "HNI", name: "Hà Nội", regionCode: "HNO" },
  // DSH — Đồng bằng Sông Hồng
  { code: "HPG", name: "Hải Phòng", regionCode: "DSH" },
  { code: "BNH", name: "Bắc Ninh", regionCode: "DSH" },
  { code: "HDG", name: "Hải Dương", regionCode: "DSH" },
  { code: "NDH", name: "Nam Định", regionCode: "DSH" },
  { code: "HYE", name: "Hưng Yên", regionCode: "DSH" },
  { code: "VPC", name: "Vĩnh Phúc", regionCode: "DSH" },
  // XBG — Xứ Bắc Giang
  { code: "BGI", name: "Bắc Giang", regionCode: "XBG" },
  // TBB — Tây Bắc Bộ
  { code: "PTO", name: "Phú Thọ", regionCode: "TBB" },
  // DBB — Đông Bắc Bộ
  { code: "QNH", name: "Quảng Ninh", regionCode: "DBB" },
  { code: "TNG", name: "Thái Nguyên", regionCode: "DBB" },
  { code: "LSN", name: "Lạng Sơn", regionCode: "DBB" },
  // BTB — Bắc Trung Bộ
  { code: "THA", name: "Thanh Hoá", regionCode: "BTB" },
  { code: "NAN", name: "Nghệ An", regionCode: "BTB" },
  { code: "HTI", name: "Hà Tĩnh", regionCode: "BTB" },
  { code: "HUE", name: "Thừa Thiên Huế", regionCode: "BTB" },
  { code: "QBI", name: "Quảng Bình", regionCode: "BTB" },
  // TTB — Trung Trung Bộ
  { code: "DNG", name: "Đà Nẵng", regionCode: "TTB" },
  { code: "QNM", name: "Quảng Nam", regionCode: "TTB" },
  { code: "BDI", name: "Bình Định", regionCode: "TTB" },
  // TNG — Tây Nguyên
  { code: "DLA", name: "Đắk Lắk", regionCode: "TNG" },
  // NTB — Nam Trung Bộ
  { code: "KHA", name: "Khánh Hoà", regionCode: "NTB" },
  // HCM
  { code: "HCM", name: "TP. Hồ Chí Minh", regionCode: "HCM" },
  // DNB — Đông Nam Bộ
  { code: "BDG", name: "Bình Dương", regionCode: "DNB" },
  { code: "DNI", name: "Đồng Nai", regionCode: "DNB" },
  { code: "VTU", name: "Bà Rịa - Vũng Tàu", regionCode: "DNB" },
  { code: "TYI", name: "Tây Ninh", regionCode: "DNB" },
  // DCL — Đồng bằng Cửu Long
  { code: "LAN", name: "Long An", regionCode: "DCL" },
  { code: "CTO", name: "Cần Thơ", regionCode: "DCL" },
  { code: "TGG", name: "Tiền Giang", regionCode: "DCL" },
  { code: "AGG", name: "An Giang", regionCode: "DCL" },
  { code: "BTR", name: "Bến Tre", regionCode: "DCL" },
  { code: "STG", name: "Sóc Trăng", regionCode: "DCL" },
  // TNB — Tây Nam Bộ
  { code: "KGG", name: "Kiên Giang", regionCode: "TNB" },
];

/**
 * Trọng số sản lượng theo tỉnh — HN + HCM chiếm ~35%.
 * Dùng để random theo phân phối volume thực tế khi sinh fact_order.
 */
const PROVINCE_VOLUME_WEIGHT: Record<string, number> = {
  HCM: 18,
  HNI: 17,
  // Tier 2: các thành phố lớn / tỉnh có khu công nghiệp
  BDG: 5,
  DNI: 4,
  HPG: 4,
  DNG: 3,
  BNH: 3,
  HDG: 2.5,
  CTO: 2.5,
  // Tier 3: các tỉnh trung bình
  VTU: 2,
  HYE: 2,
  QNH: 2,
  BGI: 1.8,
  VPC: 1.8,
  LAN: 1.8,
  TGG: 1.5,
  AGG: 1.5,
  KGG: 1.5,
  NDH: 1.5,
  TNG: 1.5,
  THA: 1.5,
  NAN: 1.5,
  HUE: 1.5,
  KHA: 1.5,
  BDI: 1.3,
  HTI: 1.2,
  QNM: 1.2,
  QBI: 1.0,
  PTO: 1.0,
  LSN: 0.8,
  DLA: 1.0,
  BTR: 1.2,
  STG: 1.2,
  TYI: 1.5,
};

// district pool — pick 3 per province
const DISTRICT_POOL: Record<string, string[]> = {
  HNI: ["Hoàn Kiếm", "Cầu Giấy", "Hà Đông", "Long Biên", "Đông Anh"],
  HPG: ["Hồng Bàng", "Lê Chân", "Ngô Quyền", "An Dương"],
  QNH: ["Hạ Long", "Cẩm Phả", "Móng Cái"],
  BNH: ["TP. Bắc Ninh", "Từ Sơn", "Yên Phong"],
  HDG: ["TP. Hải Dương", "Cẩm Giàng", "Bình Giang"],
  NDH: ["TP. Nam Định", "Mỹ Lộc", "Ý Yên"],
  TNG: ["TP. Thái Nguyên", "Sông Công", "Phổ Yên"],
  THA: ["TP. Thanh Hoá", "Sầm Sơn", "Bỉm Sơn"],
  NAN: ["TP. Vinh", "Cửa Lò", "Diễn Châu"],
  DNG: ["Hải Châu", "Thanh Khê", "Sơn Trà", "Liên Chiểu"],
  QNM: ["Tam Kỳ", "Hội An", "Điện Bàn"],
  KHA: ["Nha Trang", "Cam Ranh", "Ninh Hoà"],
  HCM: ["Quận 1", "Quận 7", "Thủ Đức", "Bình Tân", "Tân Bình"],
  BDG: ["Thủ Dầu Một", "Dĩ An", "Thuận An", "Bến Cát"],
  DNI: ["Biên Hoà", "Long Khánh", "Trảng Bom"],
  LAN: ["Tân An", "Bến Lức", "Đức Hoà"],
  CTO: ["Ninh Kiều", "Cái Răng", "Bình Thuỷ"],
  TGG: ["Mỹ Tho", "Cai Lậy", "Gò Công"],
  AGG: ["Long Xuyên", "Châu Đốc", "Tân Châu"],
  KGG: ["Rạch Giá", "Hà Tiên", "Phú Quốc"],
  // 14 tỉnh mới (Phase 1)
  HYE: ["TP. Hưng Yên", "Mỹ Hào", "Văn Lâm"],
  BGI: ["TP. Bắc Giang", "Việt Yên", "Lạng Giang"],
  VPC: ["TP. Vĩnh Yên", "Phúc Yên", "Bình Xuyên"],
  PTO: ["TP. Việt Trì", "Phú Thọ", "Lâm Thao"],
  LSN: ["TP. Lạng Sơn", "Cao Lộc", "Hữu Lũng"],
  HTI: ["TP. Hà Tĩnh", "Kỳ Anh", "Thạch Hà"],
  HUE: ["TP. Huế", "Hương Thuỷ", "Hương Trà"],
  QBI: ["TP. Đồng Hới", "Lệ Thuỷ", "Bố Trạch"],
  BDI: ["TP. Quy Nhơn", "An Nhơn", "Phù Cát"],
  DLA: ["TP. Buôn Ma Thuột", "Buôn Hồ", "Krông Pắk"],
  VTU: ["Vũng Tàu", "Bà Rịa", "Phú Mỹ"],
  BTR: ["TP. Bến Tre", "Châu Thành", "Mỏ Cày Bắc"],
  STG: ["TP. Sóc Trăng", "Vĩnh Châu", "Mỹ Tú"],
  TYI: ["TP. Tây Ninh", "Hoà Thành", "Trảng Bàng"],
};

const DISTRICTS: District[] = PROVINCES.flatMap((p) =>
  DISTRICT_POOL[p.code].slice(0, 3).map((name, i) => ({
    code: `${p.code}-D${i + 1}`,
    name,
    provinceCode: p.code,
  })),
);

const WARD_NAMES = [
  "Phường 1",
  "Phường 2",
  "Phường 3",
  "Phường Trung Tâm",
  "Phường Đông",
  "Phường Tây",
  "Phường Bắc",
  "Phường Nam",
  "Phường Tân Lập",
  "Phường Tân Phú",
];

const WARDS: Ward[] = (() => {
  const rng = seedrandom(MASTER_SEED + ":wards");
  const out: Ward[] = [];
  for (const d of DISTRICTS) {
    const count = 3 + Math.floor(rng() * 2); // 3 or 4
    for (let i = 0; i < count; i++) {
      out.push({
        code: `${d.code}-W${i + 1}`,
        name: WARD_NAMES[i % WARD_NAMES.length],
        districtCode: d.code,
      });
    }
    if (out.length >= 200) break;
  }
  return out.slice(0, 200);
})();

// =======================================================================
// 2. KTC + Lane network (25 KTC, 50 lanes)
// =======================================================================

const KTC_DISTRIBUTION: { provinceCode: string; count: number }[] = [
  { provinceCode: "HNI", count: 3 },
  { provinceCode: "HPG", count: 1 },
  { provinceCode: "QNH", count: 1 },
  { provinceCode: "BNH", count: 1 },
  { provinceCode: "HDG", count: 1 },
  { provinceCode: "NDH", count: 1 },
  { provinceCode: "TNG", count: 1 },
  { provinceCode: "THA", count: 1 },
  { provinceCode: "NAN", count: 1 },
  { provinceCode: "DNG", count: 2 },
  { provinceCode: "QNM", count: 1 },
  { provinceCode: "KHA", count: 1 },
  { provinceCode: "HCM", count: 3 },
  { provinceCode: "BDG", count: 2 },
  { provinceCode: "DNI", count: 1 },
  { provinceCode: "LAN", count: 1 },
  { provinceCode: "CTO", count: 1 },
  { provinceCode: "TGG", count: 1 },
  { provinceCode: "AGG", count: 1 },
];

const KTCS: Ktc[] = (() => {
  const out: Ktc[] = [];
  for (const { provinceCode, count } of KTC_DISTRIBUTION) {
    const p = PROVINCES.find((x) => x.code === provinceCode)!;
    for (let i = 1; i <= count; i++) {
      out.push({
        code: `${p.code}-KTC${String(i).padStart(2, "0")}`,
        name: `KTC ${p.name} ${String(i).padStart(2, "0")}`,
        regionCode: p.regionCode,
        provinceCode: p.code,
        tier: i === 1 ? "primary" : "secondary",
      });
    }
  }
  return out;
})();

const PRIMARY_LANES: { origin: string; dest: string; distance: number }[] = [
  // express trunk
  { origin: "HCM-KTC01", dest: "HNI-KTC01", distance: 1720 },
  { origin: "HNI-KTC01", dest: "HCM-KTC01", distance: 1720 },
  { origin: "HCM-KTC01", dest: "DNG-KTC01", distance: 970 },
  { origin: "DNG-KTC01", dest: "HCM-KTC01", distance: 970 },
  { origin: "HNI-KTC01", dest: "DNG-KTC01", distance: 760 },
  { origin: "DNG-KTC01", dest: "HNI-KTC01", distance: 760 },
];

const LANES: Lane[] = (() => {
  const rng = seedrandom(MASTER_SEED + ":lanes");
  const out: Lane[] = [];
  const seen = new Set<string>();

  const push = (origin: string, dest: string, distance: number) => {
    const key = `${origin}->${dest}`;
    if (seen.has(key) || origin === dest) return;
    seen.add(key);
    const o = KTCS.find((k) => k.code === origin)!;
    const d = KTCS.find((k) => k.code === dest)!;
    const intra = o.regionCode === d.regionCode;
    // Express lanes = primary KTCs in different regions, distance > 700km
    const isExpress = !intra && distance > 700 && o.tier === "primary" && d.tier === "primary";
    out.push({
      code: `L-${origin}-${dest}`,
      name: `${o.name} → ${d.name}`,
      originKtc: origin,
      destKtc: dest,
      originRegion: o.regionCode,
      destRegion: d.regionCode,
      distanceKm: distance,
      category: isExpress ? "express" : intra ? "intra" : "inter",
    });
  };

  for (const p of PRIMARY_LANES) push(p.origin, p.dest, p.distance);

  // fill remaining lanes pairing KTCs heuristically
  const targetLanes = 50;
  let safety = 5000;
  while (out.length < targetLanes && safety-- > 0) {
    const a = KTCS[Math.floor(rng() * KTCS.length)];
    const b = KTCS[Math.floor(rng() * KTCS.length)];
    if (a.code === b.code) continue;
    const intra = a.regionCode === b.regionCode;
    const distance = intra
      ? 80 + Math.floor(rng() * 250)
      : 400 + Math.floor(rng() * 1300);
    push(a.code, b.code, distance);
  }
  return out.slice(0, targetLanes);
})();

// =======================================================================
// 3. Underperformer profile (consistent stories during drill-down)
// =======================================================================

// Specific KTCs/regions that perform worse — gives narrative when filtering.
const KTC_PENALTY: Record<string, number> = {
  "KHA-KTC01": 0.85, // higher overstay
  "QNM-KTC01": 0.88, // lower fill rate
  "NAN-KTC01": 0.9, // slower TAT
  "AGG-KTC01": 0.92,
};
// Penalty cho 14 vùng — vùng xa / địa lý khó có hiệu suất thấp hơn nhẹ.
const REGION_PENALTY: Record<RegionCode, number> = {
  HNO: 1.02,
  DSH: 1.00,
  TNT: 0.95,
  XBG: 0.97,
  TBB: 0.92,    // Tây Bắc — địa hình khó
  DBB: 0.96,
  BTB: 0.95,
  TTB: 0.96,
  TNG: 0.93,    // Tây Nguyên
  NTB: 0.97,
  HCM: 1.02,
  DNB: 1.00,
  DCL: 0.97,
  TNB: 0.94,
};

// =======================================================================
// 4. Daily volume + KPI base series (deterministic)
// =======================================================================

const TODAY_DATE = parseISO(TODAY);
const START_DATE = addDays(TODAY_DATE, -(HISTORY_DAYS - 1));

type DayMeta = {
  date: string;
  dayIdx: number;
  dow: number; // 0..6, 1=Mon
  multiplier: number; // volume multiplier vs base
  incident: boolean; // incident day → degrade quality
};

const DAYS: DayMeta[] = (() => {
  const incidentRng = seedrandom(MASTER_SEED + ":incidents");
  const totalMonths = Math.ceil(HISTORY_DAYS / 30);
  const incidentDates = new Set<string>();
  for (let m = 0; m < totalMonths; m++) {
    const start = addDays(START_DATE, m * 30);
    const days = 1 + Math.floor(incidentRng() * 2); // 1 or 2
    for (let i = 0; i < days; i++) {
      const offset = Math.floor(incidentRng() * 30);
      const d = addDays(start, offset);
      if (d > TODAY_DATE) continue;
      incidentDates.add(toISODate(d));
    }
  }

  const out: DayMeta[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = addDays(START_DATE, i);
    const date = toISODate(d);
    const dow = d.getDay();
    const dowMul =
      dow === 1
        ? 1.18 // Monday spike
        : dow === 6
          ? 1.22 // Saturday spike
          : dow === 0
            ? 0.7 // Sunday quiet
            : 1.0;
    // Trend: +0.5% per week so 365d ≈ +25%
    const trendMul = 1 + (i / 7) * 0.005;

    let seasonal = 1;
    const md = format(d, "MM-dd");
    if (md === "11-11") seasonal = 3;
    else if (md === "12-12") seasonal = 2.5;
    else if (md === "11-27" || md === "11-28" || md === "11-29") seasonal = 2;
    // Tet ramp (mid Jan to early Feb)
    const isJan2nd = md >= "01-15" && md <= "01-31";
    const isFebPreTet = md >= "02-01" && md <= "02-07";
    if (isJan2nd || isFebPreTet) seasonal = 1.5;
    // Post-Tet dip
    if (md >= "02-10" && md <= "02-17") seasonal = 0.6;

    const incident = incidentDates.has(date);
    const incidentMul = incident ? 0.83 : 1;

    out.push({
      date,
      dayIdx: i,
      dow,
      multiplier: dowMul * trendMul * seasonal * incidentMul,
      incident,
    });
  }
  return out;
})();

const BASE_VOLUME = 50000;

function dayMeta(date: string): DayMeta {
  return DAYS.find((d) => d.date === date) ?? DAYS[DAYS.length - 1];
}

// Per-day noise PRNG — small jitter, deterministic.
function noise(seed: string, range = 0.04): number {
  const r = seedrandom(MASTER_SEED + ":" + seed)();
  return (r - 0.5) * 2 * range;
}

// =======================================================================
// 5. Filter helpers
// =======================================================================

function inFilter(
  filter: FilterState,
  ctx: { regionCode?: RegionCode; provinceCode?: string; ktcCode?: string; laneCode?: string; serviceType?: ServiceType },
): boolean {
  if (filter.regionCode && filter.regionCode !== "all" && ctx.regionCode && ctx.regionCode !== filter.regionCode) return false;
  if (filter.provinceCode && ctx.provinceCode && ctx.provinceCode !== filter.provinceCode) return false;
  if (filter.ktcCode && ctx.ktcCode && ctx.ktcCode !== filter.ktcCode) return false;
  if (filter.laneCode && ctx.laneCode && ctx.laneCode !== filter.laneCode) return false;
  if (filter.serviceTypes.length && ctx.serviceType && !filter.serviceTypes.includes(ctx.serviceType)) return false;
  return true;
}

function filterDays(filter: FilterState): DayMeta[] {
  return DAYS.filter((d) => d.date >= filter.from && d.date <= filter.to);
}

// =======================================================================
// 6. KPI synthesis
// =======================================================================

function kpiFromBase(
  key: keyof typeof KPI,
  filter: FilterState,
  // override modifier (e.g. region penalty)
  modifier = 1,
): KpiValue {
  const spec = KPI[key];
  const days = filterDays(filter);
  const sparkDays = lastNDays(SPARKLINE_DAYS, filter.to);

  // Pull a deterministic per-key/per-filter offset.
  const seedKey = `${key}:${filter.from}:${filter.to}:${filter.regionCode ?? ""}:${filter.provinceCode ?? ""}:${filter.ktcCode ?? ""}:${filter.laneCode ?? ""}`;
  const offset = noise(seedKey, 0.025);

  let v = spec.baseline * (1 + offset) * modifier;
  // Most KPIs improve over the year vs baseline; apply a small "progress" effect
  // if filter range is recent (last 30 days), nudge slightly toward target.
  const progress = clamp01(differenceInDays(parseISO(filter.to), START_DATE) / HISTORY_DAYS);
  const targetWeight = 0.35 * progress;
  v = v * (1 - targetWeight) + spec.target * targetWeight;

  // Region penalty — 14 vùng có hệ số khác nhau
  if (filter.regionCode && filter.regionCode !== "all") {
    const rp = REGION_PENALTY[filter.regionCode as RegionCode] ?? 1;
    if (rp !== 1) {
      v = spec.direction === "higher-better" ? v * rp : v * (2 - rp);
    }
  }

  // KTC penalty
  if (filter.ktcCode && KTC_PENALTY[filter.ktcCode]) {
    const p = KTC_PENALTY[filter.ktcCode];
    v = spec.direction === "higher-better" ? v * p : v * (2 - p);
  }

  // Sparkline: 14 daily samples around current value.
  const sparkline = sparkDays.map((d, i) => {
    const meta = dayMeta(d);
    const dayNoise = noise(`${key}:${d}`, 0.02);
    const incidentPenalty = meta.incident
      ? spec.direction === "higher-better"
        ? 0.95
        : 1.08
      : 1;
    const drift = (i - sparkDays.length / 2) * 0.001 * (spec.direction === "higher-better" ? 1 : -1);
    return v * (1 + dayNoise + drift) * incidentPenalty;
  });

  // Delta vs previous period (compare avg of sparkline last half vs first half).
  const half = Math.floor(sparkline.length / 2);
  const prev = avg(sparkline.slice(0, half));
  const curr = avg(sparkline.slice(half));
  const deltaPct = prev === 0 ? 0 : ((curr - prev) / prev) * 100;

  return {
    label: spec.label,
    value: roundForUnit(v, spec.unit),
    unit: spec.unit,
    target: spec.target,
    deltaPct: round1(deltaPct),
    sparkline: sparkline.map((s) => roundForUnit(s, spec.unit)),
    status: statusFromValue(spec, v),
    direction: spec.direction,
  };

  // Keep TS happy for unused
  void days;
}

function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function roundForUnit(x: number, unit: string): number {
  if (unit === "VND") return Math.round(x);
  if (unit === "ms") return Math.round(x);
  if (unit === "%") return round1(x);
  if (unit === "h") return Math.round(x * 10) / 10;
  if (unit === "kg" || unit === "km" || unit === "đơn") return Math.round(x);
  return Math.round(x * 100) / 100;
}

// =======================================================================
// 7. Public API — dimensions
// =======================================================================

export function getRegions(): Region[] {
  return REGIONS;
}
export function getProvinces(): Province[] {
  return PROVINCES;
}
export function getDistricts(provinceCode?: string): District[] {
  return provinceCode ? DISTRICTS.filter((d) => d.provinceCode === provinceCode) : DISTRICTS;
}
export function getWards(districtCode?: string): Ward[] {
  return districtCode ? WARDS.filter((w) => w.districtCode === districtCode) : WARDS;
}
export function getKtcs(): Ktc[] {
  return KTCS;
}
export function getLanes(): Lane[] {
  return LANES;
}

// =======================================================================
// 8. Public API — Overall page
// =======================================================================

export function getOverallKpis(filter: FilterState): OverallKpis {
  return {
    otdMidMile: kpiFromBase("otdMidMile", filter),
    costPerParcel: kpiFromBase("costPerParcel", filter),
    fillRate: kpiFromBase("fillRate", filter),
    onTimeCutOff: kpiFromBase("onTimeCutOff", filter),
  };
}

/**
 * Weekly scorecard the ops team reads as their Excel: 7 chỉ số chính,
 * W20 (tuần đã hoàn thành) vs WTD (tuần hiện tại tới hôm nay).
 * Baselines = real numbers từ team Network Logistics GHN.
 */
export function getOpsScorecardKpis(filter: FilterState): OpsScorecardRow[] {
  type Entry = {
    key: string;
    label: string;
    w20: number;
    wtd: number;
    target: number;
    direction: KpiDirection;
    /** higher-better: green at >=, amber at >= (else red).
     *  lower-better: green at <=, amber at <= (else red). */
    greenAt: number;
    amberAt: number;
    note?: string;
  };

  const entries: Entry[] = [
    {
      key: "odr",
      label: "ODR — On-time Delivery Rate",
      w20: 93.83,
      wtd: 93.0,
      target: 95,
      direction: "higher-better",
      greenAt: 95,
      amberAt: 92,
    },
    {
      key: "oprCot16h",
      label: "OPR (COT 16h)",
      w20: 95.17,
      wtd: 94.17,
      target: 96,
      direction: "higher-better",
      greenAt: 95,
      amberAt: 92,
    },
    {
      key: "oprNewCot",
      label: "OPR (COT 9h–19h)",
      w20: 77.98,
      wtd: 74.23,
      target: 90,
      direction: "higher-better",
      greenAt: 90,
      amberAt: 80,
    },
    {
      key: "fd",
      label: "FD — Failed Delivery",
      w20: 5.59,
      wtd: 5.35,
      target: 4,
      direction: "lower-better",
      greenAt: 4,
      amberAt: 6,
    },
    {
      key: "lateNoDeparture",
      label: "% Trễ không xuất tải",
      w20: 7.5,
      wtd: 7.3,
      target: 5,
      direction: "lower-better",
      greenAt: 5,
      amberAt: 8,
    },
    {
      key: "onTimeTransit4Shifts",
      label: "% On-time trung chuyển (hàng về BC còn ≥ 4 ca)",
      w20: 86.3,
      wtd: 86.2,
      target: 90,
      direction: "higher-better",
      greenAt: 90,
      amberAt: 85,
    },
    {
      key: "gtc",
      label: "%GTC — Giao thành công",
      w20: 64,
      wtd: 61,
      target: 75,
      direction: "higher-better",
      greenAt: 75,
      amberAt: 65,
    },
  ];

  // At default state (toàn quốc, không filter sâu) show the canonical numbers
  // exactly as ops team reports them. Only vary when user actually filters.
  const hasGeoFilter =
    (filter.regionCode && filter.regionCode !== "all") || !!filter.provinceCode;
  const regionMul =
    filter.regionCode && filter.regionCode !== "all"
      ? REGION_PENALTY[filter.regionCode as RegionCode] ?? 1
      : 1;
  const provinceMul = filter.provinceCode ? 0.99 : 1;
  const offset = hasGeoFilter
    ? noise(
        `scorecard:${filter.regionCode ?? ""}:${filter.provinceCode ?? ""}`,
        0.012,
      )
    : 0;

  return entries.map((e) => {
    const mul =
      e.direction === "higher-better"
        ? regionMul * provinceMul * (1 + offset)
        : (1 + (1 - regionMul) + (1 - provinceMul)) * (1 - offset);

    const w20 = round2(e.w20 * mul);
    const wtd = round2(e.wtd * mul);

    let status: Status;
    if (e.direction === "higher-better") {
      status = wtd >= e.greenAt ? "green" : wtd >= e.amberAt ? "amber" : "red";
    } else {
      status = wtd <= e.greenAt ? "green" : wtd <= e.amberAt ? "amber" : "red";
    }

    return {
      key: e.key,
      label: e.label,
      w20Value: w20,
      wtdValue: wtd,
      target: e.target,
      direction: e.direction,
      unit: "%",
      status,
      deltaPp: round2(wtd - w20),
      note: e.note,
    };
  });
}

export function getVolumeStack(filter: FilterState, days = 30): VolumeStack[] {
  const series = lastNDays(days, filter.to);
  return series.map((date) => {
    const meta = dayMeta(date);
    const base = BASE_VOLUME * meta.multiplier;
    return {
      date,
      standard: Math.round(base * 0.7 * (1 + noise(`vol:s:${date}`, 0.05))),
      bulky: Math.round(base * 0.18 * (1 + noise(`vol:b:${date}`, 0.06))),
      express: Math.round(base * 0.12 * (1 + noise(`vol:e:${date}`, 0.07))),
    };
  });
}

export function getCostTrend(filter: FilterState, days = 30): SeriesPoint[] {
  const series = lastNDays(days, filter.to);
  const spec = KPI.costPerParcel;
  return series.map((date) => {
    const meta = dayMeta(date);
    const offset = noise(`cost:${date}`, 0.04);
    const incidentPenalty = meta.incident ? 1.05 : 1;
    return {
      date,
      actual: Math.round(spec.baseline * (1 + offset) * incidentPenalty * 0.96),
      target: spec.target,
    };
  });
}

/**
 * Cấu trúc chi phí linehaul theo hạng mục — 5 categories the finance team
 * tracks separately: đối tác (3PL trip cost), nhiên liệu, lương, cầu đường,
 * thuê xe tải. Returns share + absolute amount per category over `days`.
 */
export function getCostByCategory(
  filter: FilterState,
  days = 30,
): CostByCategory {
  const series = lastNDays(days, filter.to);
  const total = series.reduce((sum, date) => {
    const meta = dayMeta(date);
    return sum + BASE_VOLUME * meta.multiplier * 8000;
  }, 0);

  const categories: { key: string; label: string; share: number; color: string }[] = [
    { key: "partner", label: "Chi phí đối tác", share: 0.35, color: "#6B7CB8" },
    { key: "fuel", label: "Chi phí nhiên liệu", share: 0.25, color: "#EEA060" },
    { key: "salary", label: "Chi phí lương", share: 0.2, color: "#84B26A" },
    { key: "tolls", label: "Chi phí cầu đường", share: 0.1, color: "#B85850" },
    { key: "rental", label: "Chi phí thuê xe tải", share: 0.1, color: "#6F8AAB" },
  ];

  // Tiny per-category noise that still sums to 1 after normalization.
  const noisy = categories.map((c) => ({
    ...c,
    rawShare: c.share * (1 + noise(`ccat:${c.key}:${filter.to}`, 0.06)),
  }));
  const sumRaw = noisy.reduce((a, b) => a + b.rawShare, 0);

  const rows: CostCategoryRow[] = noisy.map((c) => {
    const share = c.rawShare / sumRaw;
    return {
      key: c.key,
      label: c.label,
      amount: Math.round(total * share),
      share: round2(share),
      color: c.color,
    };
  });

  return { rows, total: Math.round(total) };
}

export function getCostStack(filter: FilterState, days = 30): CostStack[] {
  const series = lastNDays(days, filter.to);
  // Cost broken down by service type (Express / Freight / B2B).
  // Mix mirrors typical GHN volume mix: Express is the bulk of cost.
  return series.map((date) => {
    const meta = dayMeta(date);
    const base = BASE_VOLUME * meta.multiplier * 8000; // approximate VND
    return {
      date,
      standard: Math.round(base * 0.6 * (1 + noise(`csS:${date}`, 0.05))),
      bulky: Math.round(base * 0.25 * (1 + noise(`csB:${date}`, 0.05))),
      express: Math.round(base * 0.15 * (1 + noise(`csE:${date}`, 0.05))),
    };
  });
}

export function getLeadTime(filter: FilterState): LeadTime {
  const offset = noise(`lead:${filter.from}:${filter.to}`, 0.03);
  return {
    p50: round1(18 * (1 + offset)),
    p90: round1(34 * (1 + offset)),
    p99: round1(52 * (1 + offset)),
  };
}

export function getQualityRows(filter: FilterState): QualityRow[] {
  const entries: { key: keyof typeof KPI; href?: string }[] = [
    { key: "missortRate", href: "/network" },
    { key: "overstayRate", href: "/network" },
    { key: "sortAccuracy", href: "/network" },
    { key: "routingAccuracy", href: "/routing" },
  ];
  return entries.map(({ key, href }) => {
    const kpi = kpiFromBase(key, filter);
    return {
      label: kpi.label,
      value: kpi.value,
      unit: kpi.unit,
      deltaPct: kpi.deltaPct,
      status: kpi.status,
      direction: kpi.direction,
      href,
    };
  });
}

export function getPipelineHealth(filter: FilterState): PipelineHealthRow[] {
  // Top 5 provinces by KTC count — used as columns in the heatmap.
  const topProvinces = ["HCM", "HNI", "DNG", "BDG", "HPG"];
  const rows: PipelineHealthRow[] = [];

  for (const moduleName of ["ORS", "NDS + KTC"] as const) {
    const isORS = moduleName === "ORS";
    const regionTotals = topProvinces.map((pCode) => {
      const subFilter: FilterState = { ...filter, provinceCode: pCode };
      const kpi = isORS
        ? kpiFromBase("routingAccuracy", subFilter)
        : kpiFromBase("onTimeCutOff", subFilter);
      return {
        provinceCode: pCode,
        region: PROVINCES.find((p) => p.code === pCode)!.name,
        status: kpi.status,
        value: kpi.value,
        unit: kpi.unit,
      };
    });
    const totalKpi = isORS
      ? kpiFromBase("routingAccuracy", filter)
      : kpiFromBase("onTimeCutOff", filter);
    rows.push({
      module: moduleName,
      metricLabel: isORS ? "Routing accuracy" : "% trip đúng COT",
      regionTotals,
      totalStatus: totalKpi.status,
      totalValue: totalKpi.value,
      totalUnit: totalKpi.unit,
      drillHref: isORS ? "/routing" : "/network",
    });
  }
  return rows;
}

export function getOverallAlerts(filter: FilterState): AlertItem[] {
  const meta = dayMeta(filter.to);
  const seedR = seedrandom(MASTER_SEED + ":alerts-overall:" + filter.to);
  const out: AlertItem[] = [];

  // Deterministic minute offsets so timestamps don't shuffle across reloads.
  const baseHour = 13;
  const tstamp = (offset: number) =>
    `${String(baseHour - Math.floor(offset / 60)).padStart(2, "0")}:${String(
      59 - (offset % 60),
    ).padStart(2, "0")}`;

  out.push({
    id: "stuck-received",
    severity: "warning",
    title:
      "đơn ở trạng thái Transporting + RECEIVED_AT_SORTING (đã nhập KTC nhưng chưa update status)",
    count: 1200 + Math.floor(seedR() * 800),
    time: tstamp(18),
    href: "/network",
  });
  if (meta.incident) {
    out.push({
      id: "incident-day",
      severity: "critical",
      title: "Sự cố vận hành — volume thấp hơn bình thường ~17%, kiểm tra log network",
      time: tstamp(40),
      href: "/network",
    });
  }
  out.push({
    id: "low-fill",
    severity: "info",
    title: "lane fill rate <50% hôm nay",
    count: 3 + Math.floor(seedR() * 5),
    time: tstamp(95),
    href: "/network",
  });
  out.push({
    id: "trip-late",
    severity: "warning",
    title: "trip đang chạy trễ >30 phút",
    count: 14 + Math.floor(seedR() * 12),
    time: tstamp(150),
    href: "/network",
  });
  out.push({
    id: "tc-region-low",
    severity: "warning",
    title: "Region Trung %TC giảm xuống dưới target 92%",
    time: tstamp(205),
    href: "/routing?regionCode=trung",
  });
  out.push({
    id: "return-spike",
    severity: "info",
    title: "Tỷ lệ hoàn tuần này tăng +1.2 pt so với tuần trước",
    time: tstamp(280),
    href: "/order-journey",
  });
  return out;
}

// =======================================================================
// 9. Public API — Routing (ORS) page
// =======================================================================

export function getRoutingKpis(filter: FilterState): RoutingKpis {
  return {
    routingAccuracy: kpiFromBase("routingAccuracy", filter),
    misRouteRate: kpiFromBase("misRouteRate", filter),
    reRouteRate: kpiFromBase("reRouteRate", filter),
    addressErrorRate: kpiFromBase("addressErrorRate", filter),
    sortRoutingAccuracy: kpiFromBase("sortRoutingAccuracy", filter),
    crossDockRate: kpiFromBase("crossDockRate", filter),
    fallbackRate: kpiFromBase("fallbackRate", filter),
    hubAssignSuccess: kpiFromBase("hubAssignSuccess", filter),
    tuyenAssignAccuracy: kpiFromBase("tuyenAssignAccuracy", filter),
    ordersPerTuyen: kpiFromBase("ordersPerTuyen", filter),
    latencyP50: kpiFromBase("latencyP50", filter),
    latencyP95: kpiFromBase("latencyP95", filter),
    latencyP99: kpiFromBase("latencyP99", filter),
  };
}

export function getRoutingAccuracy24h(filter: FilterState): TimePoint[] {
  const spec = KPI.routingAccuracy;
  const out: TimePoint[] = [];
  for (let h = 0; h < 24; h++) {
    const isPeak = (h >= 8 && h <= 11) || (h >= 14 && h <= 17);
    const dip = isPeak ? -0.15 : 0;
    const random = noise(`r24:${filter.to}:${h}`, 0.4);
    out.push({
      date: `${String(h).padStart(2, "0")}:00`,
      value: round1(spec.baseline + dip + random),
    });
  }
  return out;
}

export function getLatencyHistogram(filter: FilterState): HistogramBucket[] {
  const buckets = ["0-100ms", "100-200ms", "200-300ms", "300-400ms", "400-600ms", ">600ms"];
  const weights = [0.32, 0.41, 0.16, 0.07, 0.03, 0.01];
  const total = 100_000;
  return buckets.map((bucket, i) => ({
    bucket,
    count: Math.round(total * weights[i] * (1 + noise(`lh:${filter.to}:${i}`, 0.05))),
  }));
}

export function getServiceBreakdown(filter: FilterState): ServiceBreakdownRow[] {
  return SERVICES.map((s) => {
    const baseTotal = 80_000 * (s === "standard" ? 1 : s === "bulky" ? 0.25 : 0.18);
    const misPct = s === "standard" ? 1.2 : s === "bulky" ? 2.3 : 1.6;
    const adjPct = misPct * (1 + noise(`sb:${s}:${filter.to}`, 0.06));
    const totalCount = Math.round(baseTotal);
    return {
      serviceType: s,
      totalCount,
      misRouteCount: Math.round((adjPct / 100) * totalCount),
      misRoutePct: round1(adjPct),
    };
  });
}

export function getServiceCoverage(filter: FilterState): ServiceCoverage[] {
  return SERVICES.map((s) => {
    const base = s === "standard" ? 99.4 : s === "bulky" ? 92 : 96;
    return {
      serviceType: s,
      coveredPct: round1(base * (1 + noise(`sc:${s}:${filter.to}`, 0.005))),
    };
  });
}

export function getMisRouteRows(filter: FilterState, limit = 20): MisRouteRow[] {
  const reasons = [
    "Sai mapping Phường/Xã",
    "BC nhận đóng (đang cập nhật)",
    "Vượt khả năng phục vụ",
    "Sai địa chỉ khách hàng",
    "Service không hỗ trợ vùng",
    "Routing fallback kích hoạt",
  ];
  const rng = seedrandom(MASTER_SEED + ":misroutes:" + filter.to);
  const out: MisRouteRow[] = [];
  for (let i = 0; i < limit; i++) {
    const sender = PROVINCES[Math.floor(rng() * PROVINCES.length)];
    let receiver = PROVINCES[Math.floor(rng() * PROVINCES.length)];
    if (receiver.code === sender.code) {
      receiver = PROVINCES[(PROVINCES.indexOf(sender) + 3) % PROVINCES.length];
    }
    const service = SERVICES[Math.floor(rng() * SERVICES.length)];
    const predicted = KTCS[Math.floor(rng() * KTCS.length)];
    let actual = KTCS[Math.floor(rng() * KTCS.length)];
    if (actual.code === predicted.code) {
      actual = KTCS[(KTCS.indexOf(predicted) + 4) % KTCS.length];
    }
    const date = parseISO(filter.to);
    const minutesAgo = Math.floor(rng() * 6 * 60);
    const created = new Date(date.getTime() - minutesAgo * 60_000);
    const yyyy = created.getFullYear();
    const mm = String(created.getMonth() + 1).padStart(2, "0");
    const dd = String(created.getDate()).padStart(2, "0");
    const HH = String(created.getHours()).padStart(2, "0");
    const MM = String(created.getMinutes()).padStart(2, "0");
    out.push({
      mvd: `GHN${(700_000_000 + Math.floor(rng() * 99_999_999)).toString()}`,
      createdAt: `${dd}/${mm}/${yyyy} ${HH}:${MM}`,
      senderProvince: sender.name,
      receiverProvince: receiver.name,
      serviceType: service,
      predictedKtc: predicted.name,
      actualKtc: actual.name,
      reason: reasons[Math.floor(rng() * reasons.length)],
    });
  }
  return out;
}

export function getRoutingAlerts(filter: FilterState): AlertItem[] {
  const seedR = seedrandom(MASTER_SEED + ":alerts-routing:" + filter.to);
  return [
    {
      id: "latency-spike",
      severity: "warning",
      title: "request routing có latency P95 > 400ms (peak hour)",
      count: 4 + Math.floor(seedR() * 6),
    },
    {
      id: "fallback-rate",
      severity: "info",
      title: "% đơn rơi vào fallback rule cao hơn baseline 0.4%",
    },
  ];
}

// =======================================================================
// 10. Public API — Network (NDS + KTC) page
// =======================================================================

export function getNetworkKpis(filter: FilterState): NetworkKpis {
  return {
    fillRate: kpiFromBase("fillRate", filter),
    onTimeCutOff: kpiFromBase("onTimeCutOff", filter),
    costPerOrder: kpiFromBase("costPerOrder", filter),
    sortAccuracy: kpiFromBase("sortAccuracy", filter),
    onTimeDeparture: kpiFromBase("onTimeDeparture", filter),
    onTimeArrival: kpiFromBase("onTimeArrival", filter),
    tatHub: kpiFromBase("tatHub", filter),
    forecastMape: kpiFromBase("forecastMape", filter),
    missortRate: kpiFromBase("missortRate", filter),
    overstayRate: kpiFromBase("overstayRate", filter),
    costPerKg: kpiFromBase("costPerKg", filter),
    costPerKm: kpiFromBase("costPerKm", filter),
    emptyBackhaul: kpiFromBase("emptyBackhaul", filter),
    firstLegOnTime: kpiFromBase("firstLegOnTime", filter),
    firstLegFill: kpiFromBase("firstLegFill", filter),
    firstLegLeadTime: kpiFromBase("firstLegLeadTime", filter),
    lastLegOnTime: kpiFromBase("lastLegOnTime", filter),
    lastLegFill: kpiFromBase("lastLegFill", filter),
    lastLegLeadTime: kpiFromBase("lastLegLeadTime", filter),
  };
}

export function getVolumeForecast(filter: FilterState, days = 30): SeriesPoint[] {
  const series = lastNDays(days, filter.to);
  return series.map((date) => {
    const meta = dayMeta(date);
    const actual = Math.round(BASE_VOLUME * meta.multiplier * (1 + noise(`vfa:${date}`, 0.03)));
    // Forecast lags reality slightly + has its own noise
    const forecast = Math.round(BASE_VOLUME * meta.multiplier * (1 + noise(`vff:${date}`, 0.04)) * 0.94);
    return { date, actual, forecast };
  });
}

export function getCutOffHeatmap(filter: FilterState): HeatmapData {
  const topKtcs = KTCS.slice(0, 10);
  const slots = ["Sáng (06-10)", "Trưa (10-14)", "Chiều (14-18)", "Tối (18-22)", "Đêm (22-02)"];
  const cells = topKtcs.flatMap((k) =>
    slots.map((slot) => {
      const baseline = 95;
      const ktcPenalty = KTC_PENALTY[k.code] ?? 1;
      const slotNoise = noise(`coh:${k.code}:${slot}:${filter.to}`, 0.04);
      const eveningPenalty = slot.startsWith("Tối") ? -3 : slot.startsWith("Đêm") ? -5 : 0;
      const value = round1(baseline * ktcPenalty + eveningPenalty + slotNoise * 10);
      return {
        row: k.name,
        col: slot,
        value,
        status: statusFromValue(KPI.onTimeCutOff, value),
      };
    }),
  );
  return {
    rows: topKtcs.map((k) => k.name),
    cols: slots,
    cells,
  };
}

export function getKtcOverstayFunnel(filter: FilterState): FunnelStep[] {
  const meta = dayMeta(filter.to);
  const arrived = Math.round(BASE_VOLUME * meta.multiplier * 0.6);
  const sorted = Math.round(arrived * 0.97);
  const packed = Math.round(sorted * 0.985);
  const dispatched = Math.round(packed * 0.975);
  return [
    { label: "Nhập KTC", count: arrived },
    {
      label: "Sort xong",
      count: sorted,
      dropoffPct: round1(((arrived - sorted) / arrived) * 100),
    },
    {
      label: "Đóng kiện",
      count: packed,
      dropoffPct: round1(((sorted - packed) / sorted) * 100),
    },
    {
      label: "Xuất hàng",
      count: dispatched,
      dropoffPct: round1(((packed - dispatched) / packed) * 100),
    },
  ];
}

export function getForecastMapeTrend(filter: FilterState, weeks = 12): TimePoint[] {
  const out: TimePoint[] = [];
  const endWeek = startOfWeek(parseISO(filter.to), { weekStartsOn: 1 });
  for (let i = weeks - 1; i >= 0; i--) {
    const d = addDays(endWeek, -7 * i);
    out.push({
      date: toISODate(d),
      value: round1(12 + noise(`mape:${toISODate(d)}`, 0.25) * 4),
    });
  }
  return out;
}

export function getLanePerf(filter: FilterState): LanePerfRow[] {
  const meta = dayMeta(filter.to);
  return LANES.slice(0, 20).map((l) => {
    const o = KTCS.find((k) => k.code === l.originKtc)!;
    const d = KTCS.find((k) => k.code === l.destKtc)!;
    const regionPenalty = (REGION_PENALTY[o.regionCode] + REGION_PENALTY[d.regionCode]) / 2;
    const ktcPenalty = (KTC_PENALTY[o.code] ?? 1) * (KTC_PENALTY[d.code] ?? 1);
    const fill = 76 * regionPenalty * ktcPenalty + noise(`lp:fill:${l.code}`, 0.06) * 10;
    const fillR = round1(fill);
    const costPerKg = Math.round(2300 * (1 + noise(`lp:cpk:${l.code}`, 0.08)));
    const onTimeD = round1(94 * regionPenalty + noise(`lp:otd:${l.code}`, 0.04) * 4);
    const onTimeA = round1(92 * regionPenalty + noise(`lp:ota:${l.code}`, 0.04) * 4);
    const miss = round1(0.6 + Math.abs(noise(`lp:miss:${l.code}`, 0.5)));
    const volume = Math.round(2000 * meta.multiplier * (1 + noise(`lp:vol:${l.code}`, 0.4)));
    const status = worst(
      statusFromValue(KPI.fillRate, fillR),
      statusFromValue(KPI.onTimeArrival, onTimeA),
      statusFromValue(KPI.missortRate, miss),
    );
    return {
      laneCode: l.code,
      laneName: l.name,
      volume,
      fillRate: fillR,
      costPerKg,
      onTimeDeparture: onTimeD,
      onTimeArrival: onTimeA,
      missortRate: miss,
      status,
    };
  });
}

export function getKtcStatus(filter: FilterState): KtcStatusRow[] {
  return KTCS.map((k) => {
    const ktcPenalty = KTC_PENALTY[k.code] ?? 1;
    const sortAcc = round1(99.4 * ktcPenalty + noise(`ks:sa:${k.code}`, 0.005) * 2);
    const tat = round1(5 + (1 - ktcPenalty) * 6 + noise(`ks:tat:${k.code}`, 0.2) * 2);
    const proc = Math.round(2400 * ktcPenalty + noise(`ks:p:${k.code}`, 0.2) * 800);
    const pending = Math.round(600 * (2 - ktcPenalty) + noise(`ks:pp:${k.code}`, 0.3) * 400);
    const ready = Math.round(900 + noise(`ks:r:${k.code}`, 0.3) * 400);
    const status = worst(
      statusFromValue(KPI.sortAccuracy, sortAcc),
      statusFromValue(KPI.tatHub, tat),
    );
    return {
      ktcCode: k.code,
      ktcName: k.name,
      regionCode: k.regionCode,
      processing: proc,
      pendingSort: pending,
      readyDispatch: ready,
      tatHours: tat,
      sortAccuracy: sortAcc,
      status,
    };
  });
}

export function getNetworkAlerts(filter: FilterState): AlertItem[] {
  const seedR = seedrandom(MASTER_SEED + ":alerts-network:" + filter.to);
  const meta = dayMeta(filter.to);
  const out: AlertItem[] = [
    {
      id: "stuck-received",
      severity: "warning",
      title:
        "đơn ở trạng thái Transporting + RECEIVED_AT_SORTING (đã nhập KTC nhưng chưa cập nhật status)",
      count: 1100 + Math.floor(seedR() * 900),
    },
    {
      id: "low-fill-lanes",
      severity: "info",
      title: "lane fill rate <50% hôm nay",
      count: 3 + Math.floor(seedR() * 4),
    },
  ];
  if (meta.incident) {
    out.push({
      id: "incident",
      severity: "critical",
      title: "Sự cố mạng — 17% volume bị ảnh hưởng, kiểm tra hub ở Trung",
    });
  }
  return out;
}

// =======================================================================
// 11. Misc — last data refresh timestamp + filter defaults
// =======================================================================

export function dataUpdatedAt(): Date {
  // 8 minutes ago relative to TODAY for visual realism.
  return new Date(parseISO(TODAY).getTime() + 9 * 60 * 60 * 1000 + 22 * 60 * 1000);
}

export function defaultFilter(): FilterState {
  return {
    preset: "month",
    from: toISODate(addDays(parseISO(TODAY), -29)),
    to: TODAY,
    granularity: "daily",
    regionCode: "all",
    serviceTypes: [],
    vehicleType: "all",
    carrier: "all",
  };
}

// =======================================================================
// 12. Helpers
// =======================================================================

function worst(...xs: Status[]): Status {
  if (xs.includes("red")) return "red";
  if (xs.includes("amber")) return "amber";
  return "green";
}

// =======================================================================
// 13. Journey — hành trình đơn hàng (5 chặng)
// =======================================================================

export function getJourneyOverview(filter: FilterState): JourneyStageSummary[] {
  const meta = dayMeta(filter.to);
  const totalDaily = Math.round(BASE_VOLUME * meta.multiplier);

  // Success rates pulled from each stage's main KPI; status derived likewise.
  const pickupSucc = kpiFromBase("pickupSuccessRate", filter);
  const bcNhanWrong = kpiFromBase("bcNhanWrongCode", filter);
  const ktcSort = kpiFromBase("sortAccuracy", filter);
  const gtcRate = kpiFromBase("gtcRate", filter);
  const returnSucc = kpiFromBase("returnSuccessRate", filter);

  return [
    {
      key: "pickup",
      step: 1,
      label: "Nhận hàng",
      shortLabel: "Pickup",
      description: "Bưu cục nhận — người gửi mang đến BC hoặc NVPTTT đi nhận tại địa chỉ.",
      successRate: pickupSucc.value,
      status: pickupSucc.status,
      throughput: totalDaily,
      tone: "green",
    },
    {
      key: "bcNhan",
      step: 2,
      label: "Bưu cục nhận: xử lý & phân kiện",
      shortLabel: "BC nhận xử lý",
      description: "Tạo & bắn đơn vào kiện → phân loại → đóng kiện → xuất KTC/BC giao.",
      // Success = 100 - wrong* - missing
      successRate: round1(100 - bcNhanWrong.value * 3),
      status: bcNhanWrong.status,
      throughput: Math.round(totalDaily * 0.965),
      tone: "blue",
    },
    {
      key: "ktc",
      step: 3,
      label: "Kho trung chuyển (KTC)",
      shortLabel: "KTC",
      description: "Nhập · phân loại · sort · đóng kiện · xuất → BC giao hoặc KTC tiếp.",
      successRate: ktcSort.value,
      status: ktcSort.status,
      throughput: Math.round(totalDaily * 0.95),
      tone: "violet",
    },
    {
      key: "bcGiao",
      step: 4,
      label: "Bưu cục giao: last-mile",
      shortLabel: "BC giao",
      description: "Nhập kiện · phân tuyến · NVBC giao. ✓ GTC · ~ GT1P · × GTB.",
      successRate: gtcRate.value,
      status: gtcRate.status,
      throughput: Math.round(totalDaily * 0.94),
      tone: "amber",
    },
    {
      key: "bcHoan",
      step: 5,
      label: "Bưu cục hoàn: hoàn trả",
      shortLabel: "BC hoàn",
      description: "GTB >3 lần hoặc yêu cầu hoàn → NVBC hoàn cho người gửi.",
      successRate: returnSucc.value,
      status: returnSucc.status,
      // ~7% of total volume goes through return
      throughput: Math.round(totalDaily * 0.07),
      tone: "rose",
    },
  ];
}

export function getJourneyKpis(filter: FilterState): JourneyKpis {
  return {
    pickup: getPickupKpis(filter),
    bcNhan: getBcNhanKpis(filter),
    bcGiao: getBcGiaoKpis(filter),
    bcHoan: getBcHoanKpis(filter),
  };
}

export function getPickupKpis(filter: FilterState): PickupKpis {
  return {
    successRate: kpiFromBase("pickupSuccessRate", filter),
    cancelRate: kpiFromBase("pickupCancelRate", filter),
    lateRate: kpiFromBase("pickupLateRate", filter),
    avgTatMin: kpiFromBase("pickupTatMin", filter),
  };
}

export function getBcNhanKpis(filter: FilterState): BcNhanKpis {
  return {
    wrongCodeRate: kpiFromBase("bcNhanWrongCode", filter),
    wrongPackageRate: kpiFromBase("bcNhanWrongPackage", filter),
    missingMvdRate: kpiFromBase("bcNhanMissingMvd", filter),
    processingTatMin: kpiFromBase("bcNhanTatMin", filter),
  };
}

export function getBcGiaoKpis(filter: FilterState): BcGiaoKpis {
  const meta = dayMeta(filter.to);
  const dailyOrders = BASE_VOLUME * meta.multiplier;
  // ~40% đơn có COD, giá trị TB ~280k/đơn
  const codCollected = Math.round(dailyOrders * 0.4 * 280_000 * (1 + noise(`cod:${filter.to}`, 0.03)));
  const codPendingDeposit = Math.round(codCollected * 0.18 * (1 + noise(`codp:${filter.to}`, 0.1)));
  return {
    gtcRate: kpiFromBase("gtcRate", filter),
    gt1pRate: kpiFromBase("gt1pRate", filter),
    gtbRate: kpiFromBase("gtbRate", filter),
    lostRate: kpiFromBase("lostRate", filter),
    codCollected,
    codPendingDeposit,
  };
}

export function getBcHoanKpis(filter: FilterState): BcHoanKpis {
  return {
    returnSuccessRate: kpiFromBase("returnSuccessRate", filter),
    returnFailRate: kpiFromBase("returnFailRate", filter),
    avgReturnDays: kpiFromBase("returnDays", filter),
    storedRate: kpiFromBase("storedRate", filter),
  };
}

/**
 * Funnel theo từng chặng — số đơn đi qua mỗi bước nhỏ trong chặng đó.
 * Volume khởi điểm dựa trên throughput của chặng đó.
 */
export function getJourneyFunnel(
  filter: FilterState,
  stage: JourneyStageKey,
): import("./types").FunnelStep[] {
  const meta = dayMeta(filter.to);
  const totalDaily = Math.round(BASE_VOLUME * meta.multiplier);

  const dropoff = (a: number, b: number) =>
    a === 0 ? 0 : round1(((a - b) / a) * 100);

  if (stage === "pickup") {
    const requested = totalDaily;
    const arrived = Math.round(requested * 0.985);
    const picked = Math.round(arrived * 0.975);
    const intoBc = Math.round(picked * 0.995);
    return [
      { label: "Yêu cầu pickup", count: requested },
      { label: "NVPTTT đến", count: arrived, dropoffPct: dropoff(requested, arrived) },
      { label: "Lấy thành công", count: picked, dropoffPct: dropoff(arrived, picked) },
      { label: "Nhập BC nhận", count: intoBc, dropoffPct: dropoff(picked, intoBc) },
    ];
  }

  if (stage === "bcNhan") {
    const created = Math.round(totalDaily * 0.985);
    const sorted = Math.round(created * 0.995);
    const packed = Math.round(sorted * 0.99);
    const shipped = Math.round(packed * 0.99);
    return [
      { label: "Tạo & bắn đơn", count: created },
      { label: "Phân loại", count: sorted, dropoffPct: dropoff(created, sorted) },
      { label: "Đóng kiện", count: packed, dropoffPct: dropoff(sorted, packed) },
      { label: "Xuất → KTC/BC giao", count: shipped, dropoffPct: dropoff(packed, shipped) },
    ];
  }

  if (stage === "ktc") {
    return getKtcOverstayFunnel(filter);
  }

  if (stage === "bcGiao") {
    const arrived = Math.round(totalDaily * 0.94);
    const routed = Math.round(arrived * 0.995);
    const onRoute = Math.round(routed * 0.98);
    const delivered = Math.round(onRoute * 0.94);
    return [
      { label: "Nhập BC giao", count: arrived },
      { label: "Phân tuyến", count: routed, dropoffPct: dropoff(arrived, routed) },
      { label: "Trên đường giao", count: onRoute, dropoffPct: dropoff(routed, onRoute) },
      { label: "Giao thành công", count: delivered, dropoffPct: dropoff(onRoute, delivered) },
    ];
  }

  // bcHoan
  const requested = Math.round(totalDaily * 0.07);
  const intake = Math.round(requested * 0.985);
  const route = Math.round(intake * 0.98);
  const done = Math.round(route * 0.91);
  return [
    { label: "Yêu cầu hoàn", count: requested },
    { label: "Nhập BC hoàn", count: intake, dropoffPct: dropoff(requested, intake) },
    { label: "NVBC giao hoàn", count: route, dropoffPct: dropoff(intake, route) },
    { label: "Hoàn thành công", count: done, dropoffPct: dropoff(route, done) },
  ];
}

/** Alerts về status anomaly từ flowchart (Transporting + RECEIVED_AT_SORTING, etc.) */
export function getJourneyAnomalies(filter: FilterState): AlertItem[] {
  const seedR = seedrandom(MASTER_SEED + ":journey-anomalies:" + filter.to);
  return [
    {
      id: "transporting-sorting",
      severity: "warning",
      title:
        "đơn ở trạng thái Transporting + RECEIVED_AT_SORTING (đã nhập KTC nhưng chưa cập nhật status)",
      count: 1100 + Math.floor(seedR() * 900),
    },
    {
      id: "storing-lastmile",
      severity: "warning",
      title:
        "đơn ở trạng thái Storing + RECEIVED_AT_LASTMILE (đã nhập BC giao/hoàn nhưng chưa cập nhật)",
      count: 800 + Math.floor(seedR() * 600),
    },
  ];
}

// =======================================================================
// 12. Public API — Page 0 (Executive Overview)
// =======================================================================

/**
 * 4 North Star big KPI cards.
 * - OTD: % đơn giao đúng SLA E2E (lower-level: kpi otdMidMile)
 * - CPP: VND / đơn (costPerParcel)
 * - Volume hôm nay: tổng đơn xử lý hôm nay (synthesized from volume stack)
 * - Lost rate: % thất lạc
 */
export function getOverviewBigKpis(filter: FilterState): OverviewBigKpis {
  const otd = kpiFromBase("otdMidMile", filter);
  const cpp = kpiFromBase("costPerParcel", filter);
  const lost = kpiFromBase("lostRate", filter);

  // Volume KPI from VolumeStack: today's total parcels vs same weekday avg.
  const stack14 = getVolumeStack(filter, 14);
  const today = stack14[stack14.length - 1];
  const todayValue = today
    ? today.standard + today.bulky + today.express
    : 0;
  const prev = stack14
    .slice(0, -1)
    .map((d) => d.standard + d.bulky + d.express);
  const prevAvg =
    prev.length > 0 ? prev.reduce((a, b) => a + b, 0) / prev.length : todayValue;
  const deltaPct = prevAvg > 0 ? ((todayValue - prevAvg) / prevAvg) * 100 : 0;
  const target = Math.round(prevAvg * 1.03);
  const volStatus: Status =
    todayValue >= target
      ? "green"
      : todayValue >= target * 0.92
        ? "amber"
        : "red";
  const volume: KpiValue = {
    label: "Volume hôm nay",
    value: todayValue,
    unit: "đơn",
    target,
    deltaPct,
    sparkline: stack14.map((d) => d.standard + d.bulky + d.express),
    status: volStatus,
    direction: "higher-better",
  };

  return {
    otd,
    costPerParcel: cpp,
    volume,
    lostRate: lost,
  };
}

/** Module strip — 8 compact health cards. */
export function getModuleHealth(filter: FilterState): ModuleHealthItem[] {
  const items: { key: keyof typeof KPI; module: string; metricLabel: string; href: string }[] = [
    { key: "routingAccuracy", module: "ORS", metricLabel: "Routing accuracy", href: "/routing" },
    { key: "pickupSuccessRate", module: "Pickup", metricLabel: "% Nhận thành công", href: "/order-journey" },
    { key: "sortAccuracy", module: "KTC", metricLabel: "Sort accuracy", href: "/network" },
    { key: "fillRate", module: "Linehaul", metricLabel: "Fill rate", href: "/network" },
    { key: "onTimeArrival", module: "Linehaul", metricLabel: "On-time arrival", href: "/network" },
    { key: "gtcRate", module: "Last-mile", metricLabel: "%TC", href: "/order-journey" },
    { key: "firstAttemptRate", module: "Last-mile", metricLabel: "% TC lần 1", href: "/order-journey" },
    { key: "returnRate", module: "Returns", metricLabel: "Tỷ lệ hoàn", href: "/order-journey" },
  ];
  return items.map(({ key, module, metricLabel, href }) => {
    const kpi = kpiFromBase(key, filter);
    return {
      key: String(key),
      module,
      metricLabel,
      href,
      value: kpi.value,
      unit: kpi.unit,
      status: kpi.status,
      direction: kpi.direction,
    };
  });
}

/** 4 trend series for the 2×2 trend panel — 30 days. */
export function getOverviewTrends(filter: FilterState): OverviewTrends {
  const days = lastNDays(30, filter.to);

  const spec = (key: keyof typeof KPI) => KPI[key];

  // OTD daily — wiggle around baseline with target line.
  const otdSpec = spec("otdMidMile");
  const otd: SeriesPoint[] = days.map((d) => {
    const meta = dayMeta(d);
    const wobble = noise(`otd-trend:${d}`, 0.018);
    const incident = meta.incident ? -3.2 : 0;
    return {
      date: d,
      actual: round1(otdSpec.baseline * (1 + wobble) + incident),
      target: otdSpec.target,
    };
  });

  // CPP daily — reuses logic similar to getCostTrend but locked here for consistency.
  const cppSpec = spec("costPerParcel");
  const costPerParcel: SeriesPoint[] = days.map((d) => {
    const meta = dayMeta(d);
    const wobble = noise(`cpp-trend:${d}`, 0.022);
    const incidentMul = meta.incident ? 1.045 : 1;
    return {
      date: d,
      actual: Math.round(cppSpec.baseline * (1 + wobble) * incidentMul),
      target: cppSpec.target,
    };
  });

  // Volume daily — actual + forecast band (forecast = previous-week avg with mild noise).
  const stack30 = getVolumeStack(filter, 30);
  const volume: SeriesPoint[] = stack30.map((d, i) => {
    const actual = d.standard + d.bulky + d.express;
    // forecast: 7-day MA of past days, slight optimism
    const lookback = stack30.slice(Math.max(0, i - 6), i);
    const lookbackAvg =
      lookback.length > 0
        ? lookback.reduce((a, b) => a + b.standard + b.bulky + b.express, 0) /
          lookback.length
        : actual;
    const forecast = Math.round(lookbackAvg * (1 + noise(`vol-fcast:${d.date}`, 0.02)));
    return { date: d.date, actual, forecast };
  });

  // Return rate daily — small drift up.
  const retSpec = spec("returnRate");
  const returnRate: SeriesPoint[] = days.map((d, i) => {
    const wobble = noise(`ret-trend:${d}`, 0.05);
    const drift = (i / days.length) * 0.4; // gentle rise to make trend obvious
    return {
      date: d,
      actual: round1(retSpec.baseline * (1 + wobble) + drift),
      target: retSpec.target,
    };
  });

  return { otd, costPerParcel, volume, returnRate };
}

/** 14 regional rows — volume + 3 health metrics + worst-of overall health. */
export function getRegionSnapshot(filter: FilterState): RegionSnapshotRow[] {
  const regions: { code: RegionCode; name: string; volShare: number }[] = [
    { code: "HCM", name: "Hồ Chí Minh", volShare: 0.18 },
    { code: "HNO", name: "Hà Nội", volShare: 0.17 },
    { code: "DSH", name: "ĐB Sông Hồng", volShare: 0.12 },
    { code: "DNB", name: "Đông Nam Bộ", volShare: 0.10 },
    { code: "DCL", name: "ĐB Cửu Long", volShare: 0.09 },
    { code: "DBB", name: "Đông Bắc Bộ", volShare: 0.06 },
    { code: "BTB", name: "Bắc Trung Bộ", volShare: 0.07 },
    { code: "TTB", name: "Trung Trung Bộ", volShare: 0.05 },
    { code: "NTB", name: "Nam Trung Bộ", volShare: 0.04 },
    { code: "TNB", name: "Tây Nam Bộ", volShare: 0.03 },
    { code: "TNG", name: "Tây Nguyên", volShare: 0.03 },
    { code: "XBG", name: "Xứ Bắc Giang", volShare: 0.02 },
    { code: "TBB", name: "Tây Bắc Bộ", volShare: 0.02 },
    { code: "TNT", name: "Tây Nam Thủ đô", volShare: 0.02 },
  ];

  const today = filter.to;
  const meta = dayMeta(today);
  const totalVolume = BASE_VOLUME * meta.multiplier;

  return regions.map((r) => {
    const subFilter: FilterState = { ...filter, regionCode: r.code };
    const otd = kpiFromBase("otdMidMile", subFilter);
    const gtc = kpiFromBase("gtcRate", subFilter);
    const cpp = kpiFromBase("costPerParcel", subFilter);
    const vol = Math.round(
      totalVolume * r.volShare * (1 + noise(`vol-region:${r.code}:${today}`, 0.06)),
    );

    // Health = worst of OTD/GTC/CPP statuses.
    const rank: Record<Status, number> = { green: 0, amber: 1, red: 2 };
    const worst = [otd.status, gtc.status, cpp.status].sort(
      (a, b) => rank[b] - rank[a],
    )[0];

    return {
      regionCode: r.code,
      regionName: r.name,
      volume: vol,
      otdPct: round1(otd.value),
      gtcPct: round1(gtc.value),
      costPerParcel: Math.round(cpp.value),
      health: worst,
    };
  });
}

/** 3 footer gauges — OTD %, Volume vs daily target, Cost vs budget. */
export function getOverviewGauges(filter: FilterState): OverviewGauge[] {
  const big = getOverviewBigKpis(filter);

  // OTD: progress = value / target (capped 1.05 visually).
  const otdProgress = clamp01(big.otd.value / big.otd.target);
  // Volume: today's value vs target.
  const volProgress = clamp01(big.volume.value / Math.max(1, big.volume.target));
  // Cost: lower is better. progress = target / value (capped).
  const cppProgress = clamp01(
    big.costPerParcel.target / Math.max(1, big.costPerParcel.value),
  );

  return [
    {
      key: "otd",
      label: "OTD hôm nay",
      value: big.otd.value,
      target: big.otd.target,
      unit: big.otd.unit,
      progress: otdProgress,
      status: big.otd.status,
      direction: big.otd.direction,
    },
    {
      key: "volume",
      label: "Volume vs target",
      value: big.volume.value,
      target: big.volume.target,
      unit: big.volume.unit,
      progress: volProgress,
      status: big.volume.status,
      direction: big.volume.direction,
    },
    {
      key: "cost",
      label: "CPP vs budget",
      value: big.costPerParcel.value,
      target: big.costPerParcel.target,
      unit: big.costPerParcel.unit,
      progress: cppProgress,
      status: big.costPerParcel.status,
      direction: big.costPerParcel.direction,
    },
  ];
}

// =======================================================================
// 13. Public API — Page 1 (Order Journey)
// =======================================================================

/** 6 KPI cards top-of-page. */
export function getOrderJourneyKpis(filter: FilterState): OrderJourneyKpis {
  // Total orders = sum of last 30 days × multiplier — derive synthetic KPI.
  const stack = getVolumeStack(filter, 30);
  const total = stack.reduce(
    (a, d) => a + d.standard + d.bulky + d.express,
    0,
  );
  const prev30Avg = total / 30;
  const todayValue = total; // 30-day rolling total
  const totalOrders: KpiValue = {
    label: "Tổng đơn (30 ngày)",
    value: todayValue,
    unit: "đơn",
    target: Math.round(prev30Avg * 30 * 1.05),
    deltaPct: 3.2,
    sparkline: stack.slice(-14).map((d) => d.standard + d.bulky + d.express),
    status: "green",
    direction: "higher-better",
  };

  const otd = kpiFromBase("otdMidMile", filter);
  const lost = kpiFromBase("lostRate", filter);
  const first = kpiFromBase("firstAttemptRate", filter);
  const ret = kpiFromBase("returnRate", filter);

  // Avg lead time — synthesize from leadTime helper, P50 in hours.
  const lead = getLeadTime(filter);
  const avgLeadTime: KpiValue = {
    label: "Lead time TB (P50)",
    value: lead.p50,
    unit: "h",
    target: 24,
    deltaPct: -2.4,
    sparkline: lastNDays(14, filter.to).map(
      (d) => round1(lead.p50 * (1 + noise(`lead-spark:${d}`, 0.04))),
    ),
    status: lead.p50 <= 24 ? "green" : lead.p50 <= 30 ? "amber" : "red",
    direction: "lower-better",
  };

  return {
    totalOrders,
    otd,
    avgLeadTime,
    firstAttempt: first,
    returnRate: ret,
    lostRate: lost,
  };
}

/** 10-step order funnel (forward + branch). */
export function getOrderFunnel(filter: FilterState): FunnelStep[] {
  // Use Total = 100k as a friendly base; scale slightly with day multiplier.
  const meta = dayMeta(filter.to);
  const base = Math.round(100_000 * meta.multiplier);
  const incidentMul = meta.incident ? 0.93 : 1;

  // Per-stage retention rate — incident days are harsher.
  const retentions = [
    1.0, // ORDER_CREATED
    0.985, // PICKUP_SUCCESS
    0.972, // AT_KTC_IN
    0.965 * incidentMul, // LINEHAUL_DONE
    0.960, // AT_KTC_OUT
    0.951, // AT_DELIVERY_POST
    0.935, // OUT_FOR_DELIVERY
    0.885 * incidentMul, // DELIVERED (OTD)
  ];
  const labels = [
    "ORDER_CREATED",
    "PICKUP_SUCCESS",
    "AT_KTC_IN",
    "LINEHAUL_DONE",
    "AT_KTC_OUT",
    "AT_DELIVERY_POST",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];
  const out: FunnelStep[] = [];
  let prev = base;
  for (let i = 0; i < labels.length; i++) {
    const count = Math.round(base * retentions[i]);
    const dropoff = i === 0 ? undefined : ((prev - count) / prev) * 100;
    out.push({ label: labels[i], count, dropoffPct: dropoff });
    prev = count;
  }
  // Branches: RETURNED + LOST come from non-delivered.
  const delivered = out[out.length - 1].count;
  const notDelivered = base - delivered;
  const returned = Math.round(notDelivered * 0.75);
  const lost = Math.round(notDelivered * 0.012);
  out.push({
    label: "RETURNED",
    count: returned,
    dropoffPct: (returned / base) * 100,
  });
  out.push({
    label: "LOST",
    count: lost,
    dropoffPct: (lost / base) * 100,
  });
  return out;
}

/** Lead time per stage — box plot data. */
export function getStageLeadTimes(filter: FilterState): LeadTimeBox[] {
  const stages: { stage: string; p50: number; spread: number; sla: number }[] = [
    { stage: "Pickup", p50: 2.5, spread: 1.8, sla: 4 },
    { stage: "BC nhận → xuất", p50: 1.2, spread: 0.9, sla: 2 },
    { stage: "First-mile linehaul", p50: 4.8, spread: 2.2, sla: 6 },
    { stage: "KTC sort", p50: 3.5, spread: 2.0, sla: 5 },
    { stage: "Inter-KTC linehaul", p50: 8.4, spread: 4.5, sla: 12 },
    { stage: "KTC out → BC giao", p50: 2.8, spread: 1.5, sla: 4 },
    { stage: "BC giao xử lý", p50: 1.0, spread: 0.7, sla: 2 },
    { stage: "Out for delivery", p50: 3.2, spread: 1.8, sla: 6 },
  ];

  return stages.map((s) => {
    const nz = noise(`lead-stage:${s.stage}:${filter.to}`, 0.06);
    const p50 = round1(s.p50 * (1 + nz));
    const p10 = round1(p50 - s.spread * 0.55);
    const p90 = round1(p50 + s.spread * 1.1);
    const p99 = round1(p90 + s.spread * 1.2);
    // 2–3 outlier points beyond p99
    const outliers = [
      round1(p99 + s.spread * 0.6),
      round1(p99 + s.spread * 1.2),
    ];
    return { stage: s.stage, p10, p50, p90, p99, outliers, sla: s.sla };
  });
}

/** Simplified Sankey flow edges between major states. */
export function getSankeyFlows(filter: FilterState): SankeyEdge[] {
  const funnel = getOrderFunnel(filter);
  const find = (name: string) =>
    funnel.find((s) => s.label === name)?.count ?? 0;

  const created = find("ORDER_CREATED");
  const pickup = find("PICKUP_SUCCESS");
  const ktcIn = find("AT_KTC_IN");
  const linehaul = find("LINEHAUL_DONE");
  const ktcOut = find("AT_KTC_OUT");
  const bcGiao = find("AT_DELIVERY_POST");
  const ofd = find("OUT_FOR_DELIVERY");
  const delivered = find("DELIVERED");
  const returned = find("RETURNED");
  const lost = find("LOST");

  return [
    { source: "ORDER_CREATED", target: "PICKUP_SUCCESS", value: pickup },
    { source: "ORDER_CREATED", target: "Cancelled", value: created - pickup, isFailure: true },
    { source: "PICKUP_SUCCESS", target: "AT_KTC_IN", value: ktcIn },
    { source: "AT_KTC_IN", target: "LINEHAUL_DONE", value: linehaul },
    { source: "LINEHAUL_DONE", target: "AT_KTC_OUT", value: ktcOut },
    { source: "AT_KTC_OUT", target: "AT_DELIVERY_POST", value: bcGiao },
    { source: "AT_DELIVERY_POST", target: "OUT_FOR_DELIVERY", value: ofd },
    { source: "OUT_FOR_DELIVERY", target: "DELIVERED", value: delivered },
    {
      source: "OUT_FOR_DELIVERY",
      target: "RETURNED",
      value: returned,
      isFailure: true,
    },
    { source: "OUT_FOR_DELIVERY", target: "LOST", value: lost, isFailure: true },
  ];
}

/** Delivery cohort heatmap — rows: created date (last 14d), cols: hours bucket. */
export function getDeliveryCohorts(filter: FilterState): HeatmapData {
  const cohortDates = lastNDays(14, filter.to);
  const buckets = ["0–12h", "12–24h", "24–48h", "48–72h", "72–96h"];

  // Cumulative % delivered by hours-since-created.
  // Realistic curve: ~15% by 12h, 45% by 24h, 80% by 48h, 93% by 72h, 97% by 96h.
  const baseCum = [0.15, 0.45, 0.8, 0.93, 0.97];
  const rows = cohortDates;
  const cols = buckets;

  const cells: HeatmapData["cells"] = [];
  for (const date of cohortDates) {
    const meta = dayMeta(date);
    // Incident days deliver slower.
    const slowdown = meta.incident ? 0.82 : 1;
    for (let i = 0; i < buckets.length; i++) {
      const nz = noise(`cohort:${date}:${buckets[i]}`, 0.04);
      const v = baseCum[i] * slowdown * (1 + nz) * 100;
      const value = round1(Math.min(100, Math.max(0, v)));
      // Status: how close to baseline at this hour bucket.
      const baseline = baseCum[i] * 100;
      const dev = value / baseline;
      const status: Status =
        dev >= 0.95 ? "green" : dev >= 0.85 ? "amber" : "red";
      cells.push({ row: date, col: buckets[i], value, status });
    }
  }
  return { rows, cols, cells };
}

/** Order tracker list — synthesized rows for the table. */
export function getOrderList(
  filter: FilterState,
  limit = 50,
): OrderRow[] {
  const shops = [
    "Tiki - Hà Nội",
    "Shopee - HCM",
    "Lazada - Đà Nẵng",
    "Sendo - Cần Thơ",
    "FPT Shop - Hải Phòng",
    "Bách Hoá Xanh - Bình Dương",
    "Concung - Nam Định",
    "Coolmate - HCM",
    "MWG - HCM",
    "Hasaki - HCM",
  ];
  const states = [
    "ORDER_CREATED",
    "PICKUP_SUCCESS",
    "AT_KTC_IN",
    "TRANSPORTING_LINEHAUL",
    "AT_KTC_OUT",
    "AT_DELIVERY_POST",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "RETURNED",
    "LOST",
  ];
  const services: ServiceType[] = ["standard", "bulky", "express"];

  const rng = seedrandom(MASTER_SEED + ":orderlist:" + filter.to);
  const out: OrderRow[] = [];
  for (let i = 0; i < limit; i++) {
    const ageHours = Math.floor(rng() * 96);
    const created = new Date(filter.to + "T08:00:00Z");
    created.setHours(created.getHours() - ageHours);
    const state = states[Math.min(states.length - 1, Math.floor(rng() * states.length))];
    const isFinal =
      state === "DELIVERED" || state === "RETURNED" || state === "LOST";
    const daysInState = isFinal
      ? Math.floor(rng() * 2)
      : Math.floor(rng() * 4);
    const slaDelta = round1((rng() - 0.55) * 36); // -20h ... +16h
    const slaStatus: Status =
      slaDelta <= 0 ? "green" : slaDelta <= 12 ? "amber" : "red";
    out.push({
      orderId: `ORD${(1000000 + i).toString()}`,
      mvd: `GHN${(8400000 + i).toString()}`,
      shop: shops[Math.floor(rng() * shops.length)],
      createdAt: created.toISOString(),
      currentState: state,
      daysInState,
      slaStatus,
      slaDeltaHours: slaDelta,
      serviceType: services[Math.floor(rng() * services.length)],
    });
  }
  return out;
}

/** Full timeline for one order — drives drill drawer. */
export function getOrderTimeline(orderId: string): OrderTimeline {
  const orders = getOrderList(defaultFilter(), 50);
  const order = orders.find((o) => o.orderId === orderId) ?? orders[0];
  const rng = seedrandom(MASTER_SEED + ":timeline:" + orderId);

  const states = [
    { state: "ORDER_CREATED", node: "Shop", offsetH: 0 },
    { state: "PICKUP_REQUESTED", node: "BC lấy", offsetH: 0.5 },
    { state: "PICKUP_SUCCESS", node: "BC lấy", offsetH: 2.2 },
    { state: "RECEIVED_AT_PICKUP_POST", node: "BC lấy", offsetH: 3 },
    {
      state: "TRANSPORTING_TO_KTC_IN",
      node: "BC lấy → KTC HCM",
      offsetH: 4.5,
    },
    { state: "RECEIVED_AT_KTC_IN", node: "KTC HCM 01", offsetH: 6.5 },
    {
      state: "TRANSPORTING_LINEHAUL",
      node: "KTC HCM → KTC HN",
      offsetH: 8,
    },
    { state: "RECEIVED_AT_KTC_OUT", node: "KTC HN 01", offsetH: 30 },
    {
      state: "TRANSPORTING_TO_DELIVERY",
      node: "KTC HN → BC giao 42",
      offsetH: 32,
    },
    {
      state: "RECEIVED_AT_DELIVERY_POST",
      node: "BC giao 42",
      offsetH: 35,
    },
    {
      state: "OUT_FOR_DELIVERY",
      node: "NVBC #128",
      offsetH: 38,
    },
    { state: "DELIVERED", node: "Khách hàng", offsetH: 41 },
  ];

  // Truncate based on order's current state.
  const currentStateIdx = states.findIndex(
    (s) => s.state === order.currentState,
  );
  const cutoff = currentStateIdx >= 0 ? currentStateIdx + 1 : states.length;

  const createdTs = new Date(order.createdAt);
  const events: OrderTimelineEvent[] = states.slice(0, cutoff).map((s, i) => {
    const ts = new Date(createdTs);
    const jitter = (rng() - 0.5) * 0.6;
    ts.setHours(ts.getHours() + s.offsetH + jitter);
    const planned = new Date(createdTs);
    planned.setHours(planned.getHours() + s.offsetH);
    return {
      ts: ts.toISOString(),
      state: s.state,
      node: s.node,
      plannedTs: planned.toISOString(),
      failureReason:
        order.currentState === "RETURNED" && i === states.length - 2
          ? "Khách hàng từ chối nhận hàng (lần 3)"
          : undefined,
    };
  });

  return {
    order,
    events,
    plannedPath: [
      "Shop",
      "BC lấy",
      "KTC HCM 01",
      "KTC HN 01",
      "BC giao 42",
      "Khách hàng",
    ],
    actualPath: events.map((e) => e.node),
  };
}

// =======================================================================
// 14. Public API — Page 2 (Routing / ORS) — new spec
// =======================================================================

/**
 * OD matrix: sender province × receiver province.
 * Toggle 3 metrics: volume | mis-route % | avg lead time (hours).
 * Returns HeatmapData ready for the existing Heatmap component.
 */
export function getOdMatrix(
  filter: FilterState,
  metric: OdMetric = "volume",
): HeatmapData {
  const provinces = PROVINCES;
  const rows = provinces.map((p) => p.name);
  const cols = provinces.map((p) => p.name);
  const cells: HeatmapData["cells"] = [];

  // Volume scaling: bigger provinces dominate (HCM/HNI), intra-region heavy.
  const provinceWeight: Record<string, number> = {};
  provinces.forEach((p) => {
    provinceWeight[p.code] =
      p.code === "HCM" ? 3.0 : p.code === "HNI" ? 2.6 : p.code === "DNG" ? 1.4 : 1.0;
  });

  const baseDaily = BASE_VOLUME * dayMeta(filter.to).multiplier;

  for (const s of provinces) {
    for (const r of provinces) {
      const sameRegion = s.regionCode === r.regionCode;
      const intra = s.code === r.code;
      const wS = provinceWeight[s.code];
      const wR = provinceWeight[r.code];

      // Base flow probability — intra-region > inter-region.
      const base =
        intra ? 0.08 : sameRegion ? 0.04 : 0.012;
      const volume = Math.round(
        baseDaily * base * wS * wR * (1 + noise(`od:${s.code}:${r.code}:${filter.to}`, 0.12)),
      );

      // Mis-route % grows with hop distance.
      const baseMis = intra ? 0.6 : sameRegion ? 1.8 : 3.2;
      const misPct = round1(
        baseMis * (1 + noise(`mis:${s.code}:${r.code}:${filter.to}`, 0.18)),
      );

      // Lead time grows with hop distance.
      const baseLead = intra ? 4 : sameRegion ? 18 : 38;
      const lead = round1(
        baseLead * (1 + noise(`ld:${s.code}:${r.code}:${filter.to}`, 0.1)),
      );

      let value: number;
      let status: Status;
      if (metric === "volume") {
        value = volume;
        // status: top deciles green, low red — but for volume, just use threshold.
        status = volume >= 500 ? "green" : volume >= 100 ? "amber" : "red";
      } else if (metric === "misRoutePct") {
        value = misPct;
        status = misPct <= 1 ? "green" : misPct <= 2.5 ? "amber" : "red";
      } else {
        value = lead;
        status = lead <= 12 ? "green" : lead <= 30 ? "amber" : "red";
      }

      cells.push({ row: s.name, col: r.name, value, status });
    }
  }
  return { rows, cols, cells };
}

/** Routing decision quality — hop distribution + match % per service. */
export function getRoutingDecisionQuality(
  filter: FilterState,
): RoutingDecisionRow[] {
  return SERVICES.map((s) => {
    const totalBase =
      s === "standard" ? 80_000 : s === "bulky" ? 22_000 : 14_000;
    const total = Math.round(
      totalBase * dayMeta(filter.to).multiplier *
        (1 + noise(`rdq:total:${s}:${filter.to}`, 0.05)),
    );
    // Service-specific hop distribution.
    const dist =
      s === "express"
        ? [0.62, 0.32, 0.05, 0.01] // intra-city / nhanh trong ngày
        : s === "standard"
          ? [0.28, 0.52, 0.16, 0.04]
          : [0.18, 0.38, 0.32, 0.12]; // bulky cần multi-hop
    const direct = Math.round(total * dist[0] * (1 + noise(`rdq:d:${s}:${filter.to}`, 0.04)));
    const oneHop = Math.round(total * dist[1] * (1 + noise(`rdq:1:${s}:${filter.to}`, 0.04)));
    const twoHop = Math.round(total * dist[2] * (1 + noise(`rdq:2:${s}:${filter.to}`, 0.04)));
    const threePlus = total - direct - oneHop - twoHop;
    const matchPct = round1(
      (s === "express" ? 99.1 : s === "standard" ? 97.8 : 96.4) *
        (1 + noise(`rdq:m:${s}:${filter.to}`, 0.003)),
    );
    return {
      serviceType: s,
      direct,
      oneHop,
      twoHop,
      threePlus: Math.max(0, threePlus),
      matchPct,
    };
  });
}

/** Re-route trigger breakdown — for pie chart. */
export function getReRouteTriggers(filter: FilterState): ReRouteTriggerRow[] {
  const seed = filter.to;
  const triggers: { reason: string; share: number; color: string }[] = [
    { reason: "Sender đổi địa chỉ", share: 0.32, color: "#F97316" },
    { reason: "BC nhận đóng / quá tải", share: 0.24, color: "#DC2626" },
    { reason: "KTC quá tải", share: 0.18, color: "#F59E0B" },
    { reason: "Missort phải sửa", share: 0.12, color: "#A855F7" },
    { reason: "Service không hỗ trợ", share: 0.08, color: "#0EA5E9" },
    { reason: "Manual override", share: 0.06, color: "#6B7280" },
  ];
  // Mis-route trigger volume scales with daily volume × reRouteRate.
  const reRoutePct = KPI.reRouteRate.baseline / 100;
  const totalRerouted = Math.round(
    BASE_VOLUME * dayMeta(seed).multiplier * reRoutePct,
  );
  const noisy = triggers.map((t) => ({
    ...t,
    rawShare: t.share * (1 + noise(`rt:${t.reason}:${seed}`, 0.08)),
  }));
  const sumRaw = noisy.reduce((a, b) => a + b.rawShare, 0);
  return noisy.map((t) => {
    const pct = round1((t.rawShare / sumRaw) * 100);
    const count = Math.round(totalRerouted * (t.rawShare / sumRaw));
    return { reason: t.reason, count, pct, color: t.color };
  });
}

/** Re-route rate trend — 30 days. */
export function getReRouteTrend(filter: FilterState): SeriesPoint[] {
  const days = lastNDays(30, filter.to);
  const spec = KPI.reRouteRate;
  return days.map((d) => {
    const meta = dayMeta(d);
    const wobble = noise(`rrtrend:${d}`, 0.06);
    const incidentPenalty = meta.incident ? 1.5 : 1;
    return {
      date: d,
      actual: round1(spec.baseline * (1 + wobble) * incidentPenalty),
      target: spec.target,
    };
  });
}

/** Province coverage — % orders with non-fallback routing per province. */
export function getProvinceCoverage(filter: FilterState): ProvinceCoverageRow[] {
  const baseDaily = BASE_VOLUME * dayMeta(filter.to).multiplier;
  return PROVINCES.map((p) => {
    const weight =
      p.code === "HCM" ? 3.0 : p.code === "HNI" ? 2.6 : p.code === "DNG" ? 1.4 : 1.0;
    // Coverage thấp hơn ở vùng xa, cao ở vùng metro.
    const baseCoverage =
      p.regionCode === "HCM" || p.regionCode === "HNO"
        ? 97.5
        : p.regionCode === "DSH" || p.regionCode === "DNB"
          ? 96.8
          : p.regionCode === "TBB" || p.regionCode === "TNG"
            ? 89
            : 93;
    const coveredPct = round1(
      baseCoverage * (1 + noise(`cov:${p.code}:${filter.to}`, 0.012)),
    );
    const totalOrders = Math.round(baseDaily * 0.05 * weight);
    const fallbackPct = round1(100 - coveredPct);
    const status: Status =
      coveredPct >= 97 ? "green" : coveredPct >= 93 ? "amber" : "red";
    return {
      provinceCode: p.code,
      provinceName: p.name,
      regionCode: p.regionCode,
      coveredPct,
      fallbackPct,
      totalOrders,
      status,
    };
  });
}


// =======================================================================
// ║                          PHASE 1 — EXTENSIONS                        ║
// ║  BC (1.200) · Channels · Loại BC · Ca · Fact tables (30k đơn)        ║
// ║  Tách rời với getters cũ — chưa thay thế, dùng song song              ║
// =======================================================================


// -----------------------------------------------------------------------
// Helper: weighted random pick (sum không cần = 1)
// -----------------------------------------------------------------------
function weightedPick<T>(rng: () => number, items: { value: T; weight: number }[]): T {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const it of items) {
    r -= it.weight;
    if (r <= 0) return it.value;
  }
  return items[items.length - 1].value;
}

function pickOne<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

// -----------------------------------------------------------------------
// Phase 1 — Channels (6) + Loại BC (8) + Ca (3)
// -----------------------------------------------------------------------

const CHANNELS: ChannelCode[] = ["tts", "spe", "sme", "ka", "b2b", "cb"];

/** Phân phối channel theo volume — TTS + SPE chiếm phần lớn. */
const CHANNEL_WEIGHT: { value: ChannelCode; weight: number }[] = [
  { value: "tts", weight: 28 },
  { value: "spe", weight: 25 },
  { value: "sme", weight: 28 },
  { value: "ka", weight: 10 },
  { value: "b2b", weight: 6 },
  { value: "cb", weight: 3 },
];

const LOAI_BC_LIST: LoaiBcCode[] = [
  "hon-hop",
  "chuyen-giao",
  "chuyen-lay",
  "b2b",
  "gxt",
  "hang-vua",
  "khl",
  "ahamove",
];

const LOAI_BC_WEIGHT: { value: LoaiBcCode; weight: number }[] = [
  { value: "hon-hop", weight: 50 },
  { value: "chuyen-giao", weight: 15 },
  { value: "chuyen-lay", weight: 10 },
  { value: "b2b", weight: 8 },
  { value: "gxt", weight: 7 },
  { value: "hang-vua", weight: 4 },
  { value: "khl", weight: 3 },
  { value: "ahamove", weight: 3 },
];

const CA_LIST: CaCode[] = ["ca1", "ca2", "ca3"];

// -----------------------------------------------------------------------
// Phase 1 — BCS (~1.200 bưu cục)
// HCM + HNI mỗi tỉnh ~200 BC, 32 tỉnh còn lại trung bình ~25 BC
// -----------------------------------------------------------------------

const BC_COUNT_BY_PROVINCE: Record<string, number> = {
  HCM: 200,
  HNI: 200,
};

// Phân BC còn lại theo trọng số volume
{
  const remaining = PROVINCES.filter((p) => !BC_COUNT_BY_PROVINCE[p.code]);
  const totalWeight = remaining.reduce(
    (a, p) => a + (PROVINCE_VOLUME_WEIGHT[p.code] ?? 1),
    0,
  );
  const totalBcRemaining = 800;
  for (const p of remaining) {
    const w = PROVINCE_VOLUME_WEIGHT[p.code] ?? 1;
    BC_COUNT_BY_PROVINCE[p.code] = Math.max(8, Math.round((w / totalWeight) * totalBcRemaining));
  }
}

const BCS: Bc[] = (() => {
  const rngLoai = seedrandom(MASTER_SEED + ":bc-loai");
  const out: Bc[] = [];
  for (const p of PROVINCES) {
    const count = BC_COUNT_BY_PROVINCE[p.code] ?? 25;
    // Mỗi BC gắn với KTC chính gần nhất (cùng province nếu có, không thì KTC đầu region)
    const ktcInProvince = KTCS.filter((k) => k.provinceCode === p.code);
    const ktcInRegion = KTCS.filter((k) => k.regionCode === p.regionCode);
    const defaultKtc = ktcInProvince[0]?.code ?? ktcInRegion[0]?.code ?? KTCS[0].code;
    for (let i = 1; i <= count; i++) {
      out.push({
        code: `BC-${p.code}-${String(i).padStart(3, "0")}`,
        name: `BC ${p.name} ${String(i).padStart(3, "0")}`,
        provinceCode: p.code,
        regionCode: p.regionCode,
        ktcCode: defaultKtc,
        loaiBc: weightedPick(rngLoai, LOAI_BC_WEIGHT),
      });
    }
  }
  return out;
})();

// -----------------------------------------------------------------------
// Phase 1 — Shops (cohort cho pattern shop size effect)
// ~600 shops, 60% small / 35% medium / 5% large
// -----------------------------------------------------------------------

type Shop = {
  id: string;
  sizeBucket: "small" | "medium" | "large";
  provinceCode: string;
  preferredChannel: ChannelCode;
};

const SHOPS: Shop[] = (() => {
  const rng = seedrandom(MASTER_SEED + ":shops");
  const out: Shop[] = [];
  const provinceWeights = PROVINCES.map((p) => ({
    value: p.code,
    weight: PROVINCE_VOLUME_WEIGHT[p.code] ?? 1,
  }));
  for (let i = 0; i < 600; i++) {
    const r = rng();
    const sizeBucket = r < 0.6 ? "small" : r < 0.95 ? "medium" : "large";
    out.push({
      id: `S${String(i + 1).padStart(5, "0")}`,
      sizeBucket,
      provinceCode: weightedPick(rng, provinceWeights),
      preferredChannel: weightedPick(rng, CHANNEL_WEIGHT),
    });
  }
  return out;
})();

// -----------------------------------------------------------------------
// Phase 1 — FACT_ORDER (30.000 đơn / 30 ngày gần nhất)
// Embed các pattern theo spec:
//   1. Tết drop (~67% ontime)
//   2. Shop nhỏ % không gán cao (~25%)
//   3. HN & HCM đổi kho mới gấp ~2x
//   4. Bulky/liên vùng leadtime dài hơn
//   5. final_status: 88% delivered / 8% returned / 3% in_progress / 1% lost
//   6. attempt: 80% lần 1, 15% lần 2, 5% lần 3
// -----------------------------------------------------------------------

const FACT_ORDER_DAYS = 30;
const FACT_ORDER_TARGET = 30_000;

function isTetPeriod(iso: string): boolean {
  // Tết 2026 Bính Ngọ: 17/2/2026 (mùng 1). Pre-Tết spike + drop ~7 ngày trước/sau.
  const md = iso.slice(5);
  return md >= "02-10" && md <= "02-23";
}

function isPeakSale(iso: string): boolean {
  const md = iso.slice(5);
  return md === "10-10" || md === "11-11" || md === "12-12";
}

/** Sinh fact_order với seedrandom — gọi 1 lần khi module load. */
const FACT_ORDERS: FactOrder[] = (() => {
  const rng = seedrandom(MASTER_SEED + ":fact-order");
  const out: FactOrder[] = [];
  const provinceWeights = PROVINCES.map((p) => ({
    value: p.code,
    weight: PROVINCE_VOLUME_WEIGHT[p.code] ?? 1,
  }));

  // Lấy 30 ngày gần nhất từ TODAY
  const recentDays = DAYS.slice(-FACT_ORDER_DAYS);
  const totalMultiplier = recentDays.reduce((a, d) => a + d.multiplier, 0);

  for (let i = 0; i < FACT_ORDER_TARGET; i++) {
    // Chọn ngày theo multiplier (volume cao = nhiều đơn hơn)
    let r = rng() * totalMultiplier;
    let day = recentDays[0];
    for (const d of recentDays) {
      r -= d.multiplier;
      if (r <= 0) {
        day = d;
        break;
      }
    }

    const shop = SHOPS[Math.floor(rng() * SHOPS.length)];
    const channel = rng() < 0.7 ? shop.preferredChannel : weightedPick(rng, CHANNEL_WEIGHT);

    // Sender province (theo shop) + receiver province (random theo trọng số volume)
    const senderProvinceCode = shop.provinceCode;
    const senderProvince = PROVINCES.find((p) => p.code === senderProvinceCode)!;
    const receiverProvinceCode = weightedPick(rng, provinceWeights);
    const receiverProvince = PROVINCES.find((p) => p.code === receiverProvinceCode)!;

    // BC lấy + BC giao
    const sendersBcs = BCS.filter((b) => b.provinceCode === senderProvinceCode);
    const receiversBcs = BCS.filter((b) => b.provinceCode === receiverProvinceCode);
    const bcLay = pickOne(rng, sendersBcs);
    const bcGiao = pickOne(rng, receiversBcs);

    const loaiTuyen: LoaiTuyen =
      senderProvince.regionCode === receiverProvince.regionCode ? "noi-vung" : "lien-vung";

    // KTC trung gian: của BC giao (last KTC trước khi về BC giao)
    const ktcCode = bcGiao.ktcCode;

    // Phường mới/cũ: 20% mới (consistent với spec "is_new_to_address")
    const phuongIsNew = rng() < 0.2;

    // Loại hàng: 85% standard, 15% bulky
    const loaiHang: LoaiHang = rng() < 0.85 ? "standard" : "bulky";

    // SLA days
    let slaDays: SlaDays;
    if (loaiTuyen === "noi-vung") {
      slaDays = rng() < 0.8 ? 1 : 2;
    } else {
      slaDays = rng() < 0.5 ? 2 : 3;
    }

    // Weight + COD
    const weightKg =
      loaiHang === "bulky"
        ? 5 + rng() * 25
        : 0.3 + rng() * 2.7;
    const hasCod = rng() < 0.4;
    const cod = hasCod ? Math.round(100_000 + rng() * 400_000) : 0;

    // is_changed_warehouse — phụ thuộc phuong + province
    let changeRate: number;
    if (phuongIsNew) {
      changeRate =
        senderProvinceCode === "HNI"
          ? 0.17
          : senderProvinceCode === "HCM"
            ? 0.14
            : 0.06;
    } else {
      changeRate = 0.03;
    }
    const isChangedWarehouse = rng() < changeRate;

    // Timestamps
    const createdHour = Math.floor(rng() * 24);
    const createdMin = Math.floor(rng() * 60);
    const createdTs = `${day.date}T${String(createdHour).padStart(2, "0")}:${String(createdMin).padStart(2, "0")}:00`;
    const createdMs = new Date(createdTs).getTime();

    // promised: created + sla_days * 24h
    const promisedMs = createdMs + slaDays * 24 * 3600 * 1000;
    const promisedTs = new Date(promisedMs).toISOString().slice(0, 19);

    // final_status — 88/8/3/1
    // Adjust by patterns:
    //   - Tết period: tỷ lệ returned cao hơn (12%) và in_progress cao (5%)
    //   - Shop nhỏ: % không gán cao → % in_progress cao
    //   - Bulky/liên vùng: returned + lost cao hơn nhẹ
    let pDelivered = 0.88;
    let pReturned = 0.08;
    let pInProgress = 0.03;
    let pLost = 0.01;
    if (isTetPeriod(day.date)) {
      pDelivered = 0.78;
      pReturned = 0.12;
      pInProgress = 0.08;
      pLost = 0.02;
    }
    if (shop.sizeBucket === "small") {
      pInProgress += 0.04;
      pDelivered -= 0.04;
    }
    if (loaiHang === "bulky" || loaiTuyen === "lien-vung") {
      pReturned += 0.02;
      pDelivered -= 0.02;
    }

    let finalStatus: FinalStatus;
    const rs = rng();
    if (rs < pDelivered) finalStatus = "delivered";
    else if (rs < pDelivered + pReturned) finalStatus = "returned";
    else if (rs < pDelivered + pReturned + pInProgress) finalStatus = "in_progress";
    else finalStatus = "lost";

    // current_state map theo final_status (simplified)
    let currentState: OrderState;
    let pickedTs: string | undefined;
    let deliveredTs: string | undefined;

    if (finalStatus === "delivered") {
      currentState = "DELIVER_IN_TRIP";
      // picked: created + lead time ~1.5-5h
      const pickLeadH = 1.5 + rng() * 3.5;
      pickedTs = new Date(createdMs + pickLeadH * 3600 * 1000).toISOString().slice(0, 19);
      // delivered: created + leadtime E2E (P50 36h, P90 60h, P99 90h)
      // Adjust by loaiTuyen + bulky + Tết
      const baseHours = loaiTuyen === "lien-vung" ? 48 : 24;
      let leadH = baseHours + rng() * 24; // ~24-72h
      if (loaiHang === "bulky") leadH *= 1.3;
      if (isTetPeriod(day.date)) leadH *= 1.5;
      deliveredTs = new Date(createdMs + leadH * 3600 * 1000).toISOString().slice(0, 19);
    } else if (finalStatus === "returned") {
      currentState = rng() < 0.5 ? "RETURN_IN_TRIP" : "RETURN_AT_WAREHOUSE";
      const pickLeadH = 2 + rng() * 4;
      pickedTs = new Date(createdMs + pickLeadH * 3600 * 1000).toISOString().slice(0, 19);
    } else if (finalStatus === "in_progress") {
      // Stuck ở 1 state trung gian
      const states: OrderState[] = [
        "RECEIVED_AT_SORTING",
        "TRANSPORTING",
        "ARRIVE_AT_LASTMILE",
        "START_DELIVERY_TRIP",
        "WAITING_TO_RETURN",
      ];
      currentState = pickOne(rng, states);
      if (rng() < 0.7) {
        const pickLeadH = 2 + rng() * 4;
        pickedTs = new Date(createdMs + pickLeadH * 3600 * 1000).toISOString().slice(0, 19);
      }
    } else {
      // lost / exception
      currentState = rng() < 0.5 ? "exception" : "lost";
      const pickLeadH = 2 + rng() * 4;
      pickedTs = new Date(createdMs + pickLeadH * 3600 * 1000).toISOString().slice(0, 19);
    }

    out.push({
      orderId: `GHN${(700_000_000 + i).toString()}`,
      channel,
      bcLayCode: bcLay.code,
      bcGiaoCode: bcGiao.code,
      ktcCode,
      regionCode: receiverProvince.regionCode,
      provinceCode: receiverProvinceCode,
      phuongIsNew,
      loaiHang,
      slaDays,
      loaiTuyen,
      createdTs,
      pickedTs,
      deliveredTs,
      promisedTs,
      currentState,
      finalStatus,
      weightKg: Math.round(weightKg * 100) / 100,
      cod,
      isChangedWarehouse,
      shopId: shop.id,
      shopSizeBucket: shop.sizeBucket,
    });
  }
  return out;
})();

// -----------------------------------------------------------------------
// Phase 1 — FACT_TRIP (~12.000 chuyến / 30 ngày)
// -----------------------------------------------------------------------

const FACT_TRIPS: FactTrip[] = (() => {
  const rng = seedrandom(MASTER_SEED + ":fact-trip");
  const out: FactTrip[] = [];
  const recentDays = DAYS.slice(-FACT_ORDER_DAYS);

  // Phân bổ ~400 chuyến/ngày theo type
  const tripTypeMix: { type: TripType; perDay: number }[] = [
    { type: "fm", perDay: 150 },
    { type: "lh", perDay: 50 },
    { type: "lm", perDay: 180 },
    { type: "rt", perDay: 20 },
  ];

  for (const day of recentDays) {
    for (const tm of tripTypeMix) {
      const count = Math.round(tm.perDay * day.multiplier);
      for (let i = 0; i < count; i++) {
        const tripId = `T${day.date.replace(/-/g, "")}-${tm.type.toUpperCase()}-${String(i + 1).padStart(4, "0")}`;
        // Origin + dest theo type
        let originCode: string, destCode: string, ktcCode: string | undefined;
        if (tm.type === "fm") {
          // BC → KTC
          const bc = BCS[Math.floor(rng() * BCS.length)];
          originCode = bc.code;
          destCode = bc.ktcCode;
          ktcCode = bc.ktcCode;
        } else if (tm.type === "lh") {
          // KTC ↔ KTC
          const k1 = pickOne(rng, KTCS);
          let k2 = pickOne(rng, KTCS);
          if (k1.code === k2.code) k2 = KTCS[(KTCS.indexOf(k1) + 1) % KTCS.length];
          originCode = k1.code;
          destCode = k2.code;
        } else if (tm.type === "lm") {
          // KTC → BC giao
          const bc = BCS[Math.floor(rng() * BCS.length)];
          originCode = bc.ktcCode;
          destCode = bc.code;
          ktcCode = bc.ktcCode;
        } else {
          // rt: BC → KTC (đảo chiều LM)
          const bc = BCS[Math.floor(rng() * BCS.length)];
          originCode = bc.code;
          destCode = bc.ktcCode;
          ktcCode = bc.ktcCode;
        }

        // Plan vs actual: 90% on-time, 10% trễ 15-90 phút
        const dateMs = new Date(day.date + "T08:00:00").getTime();
        const departHour = Math.floor(rng() * 16); // 0-16h
        const planDepartMs = dateMs + departHour * 3600 * 1000;
        const isOnTime = rng() < 0.93;
        const lateMs = isOnTime ? 0 : (15 + rng() * 75) * 60 * 1000;
        const actualDepartMs = planDepartMs + lateMs;
        // Trip duration: 1-12h tuỳ type
        const durH = tm.type === "lh" ? 4 + rng() * 8 : 1 + rng() * 5;
        const planArriveMs = planDepartMs + durH * 3600 * 1000;
        const actualArriveMs = actualDepartMs + durH * 3600 * 1000 + (rng() < 0.05 ? rng() * 3600 * 1000 : 0);

        // Fill rate: 40-95%, kg 55% TB, đơn 57% TB
        const fillRateKg = clamp01(0.4 + rng() * 0.55);
        const fillRateOrder = clamp01(fillRateKg + (rng() - 0.5) * 0.1);

        // Km + empty
        const totalKm = tm.type === "fm" || tm.type === "lm" ? 5 + rng() * 50 : 200 + rng() * 1500;
        const emptyKm = totalKm * (0.15 + rng() * 0.2); // 15-35%

        // Cost
        const cost = Math.round(totalKm * (8_000 + rng() * 7_000));

        // Parcels + weight
        const parcels = Math.round(fillRateOrder * (tm.type === "lh" ? 800 : 200));
        const weight = Math.round(fillRateKg * (tm.type === "lh" ? 3000 : 500));

        out.push({
          tripId,
          type: tm.type,
          originCode,
          destCode,
          ktcCode,
          planDepart: new Date(planDepartMs).toISOString().slice(0, 19),
          actualDepart: new Date(actualDepartMs).toISOString().slice(0, 19),
          planArrive: new Date(planArriveMs).toISOString().slice(0, 19),
          actualArrive: new Date(actualArriveMs).toISOString().slice(0, 19),
          fillRateKg: Math.round(fillRateKg * 1000) / 1000,
          fillRateOrder: Math.round(fillRateOrder * 1000) / 1000,
          emptyKm: Math.round(emptyKm),
          totalKm: Math.round(totalKm),
          cost,
          parcels,
          weight,
          vehicleType: weightedPick(rng, [
            { value: "truck" as const, weight: 60 },
            { value: "container" as const, weight: 25 },
            { value: "van" as const, weight: 15 },
          ]),
          carrier: weightedPick(rng, [
            { value: "internal" as const, weight: 40 },
            { value: "tpl-a" as const, weight: 25 },
            { value: "tpl-b" as const, weight: 20 },
            { value: "tpl-c" as const, weight: 15 },
          ]),
        });
      }
    }
  }
  return out;
})();

// -----------------------------------------------------------------------
// Phase 1 — FACT_PICKUP + FACT_DELIVERY (derived từ FACT_ORDERS)
// -----------------------------------------------------------------------

const FACT_PICKUPS: FactPickup[] = (() => {
  const rng = seedrandom(MASTER_SEED + ":fact-pickup");
  const out: FactPickup[] = [];
  for (const o of FACT_ORDERS) {
    if (!o.pickedTs) continue; // chỉ sinh cho đơn đã pickup
    const sizeFactor = o.shopSizeBucket === "small" ? 0.7 : o.shopSizeBucket === "medium" ? 0.88 : 0.95;
    const assigned = rng() < sizeFactor;
    const selfAssigned = !assigned && rng() < 0.5;
    const cutoffOk = rng() < 0.92;
    const leadtimeAssignSec = Math.round(1800 + rng() * 5400); // 30-120 phút
    const leadtimeLtcSec = leadtimeAssignSec + Math.round(7200 + rng() * 7200); // +2-4h
    out.push({
      orderId: o.orderId,
      nvpttt: `NV${(1000 + Math.floor(rng() * 9000)).toString()}`,
      bcCode: o.bcLayCode,
      assigned,
      selfAssigned,
      ltc: cutoffOk && assigned,
      cutoffOk,
      leadtimeAssignSec,
      leadtimeLtcSec,
    });
  }
  return out;
})();

const FACT_DELIVERIES: FactDelivery[] = (() => {
  const rng = seedrandom(MASTER_SEED + ":fact-delivery");
  const out: FactDelivery[] = [];
  for (const o of FACT_ORDERS) {
    // Chỉ sinh cho đơn đến giai đoạn delivery
    if (o.finalStatus === "in_progress" && !o.pickedTs) continue;

    // Attempt distribution: 80% lần 1, 15% lần 2, 5% lần 3+
    let attempts: number;
    const ar = rng();
    if (o.finalStatus === "delivered") {
      attempts = ar < 0.8 ? 1 : ar < 0.95 ? 2 : 3;
    } else if (o.finalStatus === "returned") {
      attempts = 3; // returned thường thử đủ 3 lần
    } else {
      attempts = 1 + Math.floor(rng() * 2);
    }

    const baseMs = o.pickedTs
      ? new Date(o.pickedTs).getTime() + 12 * 3600 * 1000
      : new Date(o.createdTs).getTime() + 24 * 3600 * 1000;
    const failReasons = [
      "Khách không nghe máy",
      "Sai địa chỉ",
      "Khách hẹn lại",
      "Khách từ chối nhận",
      "Không liên hệ được khách",
    ];

    for (let a = 1; a <= attempts; a++) {
      const attemptMs = baseMs + (a - 1) * 24 * 3600 * 1000;
      let outcome: "gtc" | "gtb" | "gt1p";
      if (a === attempts && o.finalStatus === "delivered") {
        outcome = rng() < 0.97 ? "gtc" : "gt1p";
      } else if (a < attempts) {
        outcome = "gtb";
      } else {
        outcome = "gtb";
      }
      out.push({
        orderId: o.orderId,
        nvbc: `NV${(2000 + Math.floor(rng() * 9000)).toString()}`,
        bcGiaoCode: o.bcGiaoCode,
        attemptNo: a,
        outcome,
        failReason: outcome === "gtb" ? pickOne(rng, failReasons) : undefined,
        attemptTs: new Date(attemptMs).toISOString().slice(0, 19),
      });
    }
  }
  return out;
})();

// -----------------------------------------------------------------------
// Phase 1 — Public API exposing dimensions + fact tables
// -----------------------------------------------------------------------

export function getBcs(): Bc[] {
  return BCS;
}

export function getBcsByProvince(provinceCode: string): Bc[] {
  return BCS.filter((b) => b.provinceCode === provinceCode);
}

export function getChannels(): ChannelCode[] {
  return CHANNELS;
}

export function getLoaiBcs(): LoaiBcCode[] {
  return LOAI_BC_LIST;
}

export function getCaList(): CaCode[] {
  return CA_LIST;
}

export function getFactOrders(): FactOrder[] {
  return FACT_ORDERS;
}

export function getFactTrips(): FactTrip[] {
  return FACT_TRIPS;
}

export function getFactPickups(): FactPickup[] {
  return FACT_PICKUPS;
}

export function getFactDeliveries(): FactDelivery[] {
  return FACT_DELIVERIES;
}

/** Stats nhanh để verify mock data — gọi từ dev tool / page debug. */
export function getFactStats() {
  const total = FACT_ORDERS.length;
  const byFinal = FACT_ORDERS.reduce(
    (a, o) => {
      a[o.finalStatus] = (a[o.finalStatus] ?? 0) + 1;
      return a;
    },
    {} as Record<FinalStatus, number>,
  );
  const changedWh = FACT_ORDERS.filter((o) => o.isChangedWarehouse).length;
  const newAddr = FACT_ORDERS.filter((o) => o.phuongIsNew);
  const newAddrChangedWh = newAddr.filter((o) => o.isChangedWarehouse).length;
  return {
    totalOrders: total,
    totalBcs: BCS.length,
    totalTrips: FACT_TRIPS.length,
    totalPickups: FACT_PICKUPS.length,
    totalDeliveries: FACT_DELIVERIES.length,
    finalStatusMix: {
      delivered: round1((byFinal.delivered / total) * 100),
      returned: round1((byFinal.returned / total) * 100),
      in_progress: round1((byFinal.in_progress / total) * 100),
      lost: round1((byFinal.lost / total) * 100),
    },
    changeWarehouseRate: {
      overall: round1((changedWh / total) * 100),
      newAddress:
        newAddr.length > 0
          ? round1((newAddrChangedWh / newAddr.length) * 100)
          : 0,
      newAddressHnHcm: (() => {
        const ha = newAddr.filter((o) => o.provinceCode === "HNI" || o.provinceCode === "HCM");
        const ch = ha.filter((o) => o.isChangedWarehouse).length;
        return ha.length > 0 ? round1((ch / ha.length) * 100) : 0;
      })(),
    },
  };
}
