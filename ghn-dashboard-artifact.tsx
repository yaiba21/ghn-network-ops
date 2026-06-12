/*
 * GHN Network Ops Dashboard — single-file artifact
 *
 * 5 pages bundled with sidebar navigation:
 *   - Tổng quan        (overall health, KPIs, pipeline heatmap)
 *   - Hành trình đơn   (5-stage journey drill-down)
 *   - Định tuyến (ORS) (routing along journey)
 *   - Mạng lưới        (3-leg linehaul + KTC)
 *   - Tải lên dữ liệu  (CSV upload demo)
 *
 * Self-contained: no Next.js, no router, no external mock libs.
 * Just paste into Claude Artifacts and it renders.
 *
 * Deps available in Artifacts sandbox: react, recharts, lucide-react.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  LayoutDashboard,
  Menu,
  Minus,
  RefreshCw,
  RotateCcw,
  Route,
  Search,
  Settings,
  Trash2,
  Truck,
  Upload as UploadIcon,
  UploadCloud,
  Workflow,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// =============================================================================
// 1. TYPES
// =============================================================================

type Status = "green" | "amber" | "red";
type RegionCode = "bac" | "trung" | "nam";
type ServiceType = "standard" | "bulky" | "express";
type KpiDirection = "higher-better" | "lower-better";
type KpiUnit =
  | "%"
  | "VND"
  | "ms"
  | "h"
  | "phút"
  | "ngày"
  | "đơn"
  | "kg"
  | "km";
type TimePreset = "today" | "week" | "month" | "custom";
type Granularity = "daily" | "weekly" | "monthly";

type FilterState = {
  preset: TimePreset;
  from: string;
  to: string;
  granularity: Granularity;
  regionCode?: RegionCode | "all";
  provinceCode?: string;
  serviceTypes: ServiceType[];
  ktcCode?: string;
  laneCode?: string;
};

type Region = { code: RegionCode; name: string };
type Province = { code: string; name: string; regionCode: RegionCode };
type Ktc = {
  code: string;
  name: string;
  regionCode: RegionCode;
  provinceCode: string;
  tier: "primary" | "secondary";
};
type Lane = {
  code: string;
  name: string;
  originKtc: string;
  destKtc: string;
  originRegion: RegionCode;
  destRegion: RegionCode;
  distanceKm: number;
};

type KpiValue = {
  label: string;
  value: number;
  unit: KpiUnit;
  target: number;
  deltaPct: number;
  sparkline: number[];
  status: Status;
  direction: KpiDirection;
};

type TimePoint = { date: string; value: number };
type SeriesPoint = {
  date: string;
  actual: number;
  forecast?: number;
  target?: number;
};
type VolumeStack = {
  date: string;
  standard: number;
  bulky: number;
  express: number;
};
type CostStack = VolumeStack;

type CostCategoryRow = {
  key: string;
  label: string;
  amount: number;
  share: number;
  color: string;
};

type LanePerfRow = {
  laneCode: string;
  laneName: string;
  volume: number;
  fillRate: number;
  costPerKg: number;
  onTimeDeparture: number;
  onTimeArrival: number;
  missortRate: number;
  status: Status;
};

type KtcStatusRow = {
  ktcCode: string;
  ktcName: string;
  regionCode: RegionCode;
  processing: number;
  pendingSort: number;
  readyDispatch: number;
  tatHours: number;
  sortAccuracy: number;
  status: Status;
};

type FunnelStep = { label: string; count: number; dropoffPct?: number };
type HeatmapCell = {
  row: string;
  col: string;
  value: number;
  status: Status;
};
type HeatmapData = { rows: string[]; cols: string[]; cells: HeatmapCell[] };
type HistogramBucket = { bucket: string; count: number };
type AlertItem = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  count?: number;
};
type QualityRow = {
  label: string;
  value: number;
  unit: KpiUnit;
  deltaPct: number;
  status: Status;
};
type MisRouteRow = {
  mvd: string;
  createdAt: string;
  senderProvince: string;
  receiverProvince: string;
  serviceType: ServiceType;
  predictedKtc: string;
  actualKtc: string;
  reason: string;
};
type ServiceBreakdownRow = {
  serviceType: ServiceType;
  misRouteCount: number;
  totalCount: number;
  misRoutePct: number;
};
type ServiceCoverage = { serviceType: ServiceType; coveredPct: number };

type OpsScorecardRow = {
  key: string;
  label: string;
  w20Value: number;
  wtdValue: number;
  target: number;
  direction: KpiDirection;
  unit: KpiUnit;
  status: Status;
  deltaPp: number;
};

type PipelineHealthRow = {
  module: "ORS" | "NDS + KTC";
  regionTotals: {
    region: string;
    status: Status;
    value: number;
    unit: KpiUnit;
  }[];
  totalStatus: Status;
  totalValue: number;
};

type JourneyStageKey = "pickup" | "bcNhan" | "ktc" | "bcGiao" | "bcHoan";
type StageTone = "green" | "blue" | "violet" | "amber" | "rose" | "slate";

type JourneyStageSummary = {
  key: JourneyStageKey;
  step: number;
  label: string;
  shortLabel: string;
  description: string;
  successRate: number;
  status: Status;
  throughput: number;
  tone: Extract<StageTone, "green" | "blue" | "violet" | "amber" | "rose">;
};

const SERVICE_LABEL_VI: Record<ServiceType, string> = {
  standard: "Express",
  bulky: "Freight",
  express: "B2B",
};

// =============================================================================
// 2. SEEDED PRNG + UTILS
// =============================================================================

// mulberry32 — small fast seeded PRNG, no deps.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngFor(seed: string) {
  return mulberry32(hashStr(seed));
}
function noise(seed: string, range = 0.04): number {
  return (rngFor(seed)() - 0.5) * 2 * range;
}

// Date helpers (no date-fns).
function parseISO(iso: string): Date {
  return new Date(iso + "T00:00:00Z");
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function lastNDays(n: number, endISO: string): string[] {
  const end = parseISO(endISO);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(toISO(addDays(end, -i)));
  return out;
}
function formatMMdd(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function formatDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function startOfMonth(d: Date): Date {
  const r = new Date(d);
  r.setUTCDate(1);
  return r;
}
function startOfWeek(d: Date): Date {
  const r = new Date(d);
  // Monday as week start
  const day = r.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(r, diff);
}

// Number formatters (vi-VN locale).
const nfVN = new Intl.NumberFormat("vi-VN");
const nfVN1 = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nfVN2 = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatInt(n: number): string {
  return nfVN.format(Math.round(n));
}
function formatVND(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_000_000_000) return `${nfVN1.format(n / 1_000_000_000)} tỷ`;
    if (n >= 1_000_000) return `${nfVN1.format(n / 1_000_000)} tr`;
    if (n >= 1_000) return `${nfVN1.format(n / 1_000)}K`;
  }
  return `${nfVN.format(Math.round(n))}đ`;
}
function formatPct(n: number, digits = 1): string {
  const f = digits === 0 ? nfVN : digits === 2 ? nfVN2 : nfVN1;
  return `${f.format(n)}%`;
}
function formatMs(n: number): string {
  if (n >= 1000) return `${nfVN1.format(n / 1000)}s`;
  return `${formatInt(n)}ms`;
}
function formatHours(n: number): string {
  return `${nfVN1.format(n)}h`;
}
function formatMinutes(n: number): string {
  return `${formatInt(n)} phút`;
}
function formatDays(n: number): string {
  return `${nfVN1.format(n)} ngày`;
}
function formatOrders(n: number): string {
  return `${formatInt(n)} đơn`;
}
function formatCompactInt(n: number): string {
  if (n >= 1_000_000) return `${nfVN1.format(n / 1_000_000)}M`;
  if (n >= 1_000) return `${nfVN1.format(n / 1_000)}K`;
  return formatInt(n);
}
function formatDelta(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  const f = digits === 0 ? nfVN : digits === 2 ? nfVN2 : nfVN1;
  return `${sign}${f.format(n)}%`;
}
function formatValue(value: number, unit: KpiUnit): string {
  switch (unit) {
    case "%": return formatPct(value);
    case "VND": return formatVND(value);
    case "ms": return formatMs(value);
    case "h": return formatHours(value);
    case "phút": return formatMinutes(value);
    case "ngày": return formatDays(value);
    case "đơn": return formatOrders(value);
    case "kg": return `${formatInt(value)} kg`;
    case "km": return `${formatInt(value)} km`;
    default: return formatInt(value);
  }
}

// Tailwind class merger (minimal — no twMerge needed).
function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(" ");
}

// =============================================================================
// 3. KPI CONFIG (single source of truth for green/amber/red)
// =============================================================================

type KpiSpec = {
  key: string;
  label: string;
  unit: KpiUnit;
  direction: KpiDirection;
  baseline: number;
  target: number;
  thresholds: [number, number];
};

const KPI: Record<string, KpiSpec> = {
  otdMidMile: { key: "otdMidMile", label: "OTD middle-mile", unit: "%", direction: "higher-better", baseline: 93.83, target: 95, thresholds: [95, 92] },
  costPerParcel: { key: "costPerParcel", label: "Chi phí / đơn linehaul", unit: "VND", direction: "lower-better", baseline: 8500, target: 7905, thresholds: [7905, 8925] },
  fillRate: { key: "fillRate", label: "Fill rate xe", unit: "%", direction: "higher-better", baseline: 72, target: 80, thresholds: [80, 70] },
  onTimeCutOff: { key: "onTimeCutOff", label: "% trip đúng COT", unit: "%", direction: "higher-better", baseline: 92.5, target: 95, thresholds: [95, 90] },
  routingAccuracy: { key: "routingAccuracy", label: "Routing accuracy", unit: "%", direction: "higher-better", baseline: 98.5, target: 99, thresholds: [99, 97] },
  misRouteRate: { key: "misRouteRate", label: "Tỷ lệ mis-route", unit: "%", direction: "lower-better", baseline: 1.5, target: 1, thresholds: [1, 2] },
  latencyP50: { key: "latencyP50", label: "Latency P50", unit: "ms", direction: "lower-better", baseline: 120, target: 100, thresholds: [100, 180] },
  latencyP95: { key: "latencyP95", label: "Latency P95", unit: "ms", direction: "lower-better", baseline: 250, target: 200, thresholds: [200, 400] },
  latencyP99: { key: "latencyP99", label: "Latency P99", unit: "ms", direction: "lower-better", baseline: 480, target: 400, thresholds: [400, 700] },
  hubAssignSuccess: { key: "hubAssignSuccess", label: "% gán hub/BC thành công", unit: "%", direction: "higher-better", baseline: 99, target: 99.5, thresholds: [99.5, 98] },
  reRouteRate: { key: "reRouteRate", label: "% đơn cần re-route", unit: "%", direction: "lower-better", baseline: 2, target: 1.5, thresholds: [1.5, 3] },
  fallbackRate: { key: "fallbackRate", label: "% rơi vào fallback rule", unit: "%", direction: "lower-better", baseline: 1, target: 0.5, thresholds: [0.5, 1.5] },
  addressErrorRate: { key: "addressErrorRate", label: "% đơn lỗi địa chỉ", unit: "%", direction: "lower-better", baseline: 1.2, target: 0.8, thresholds: [0.8, 1.5] },
  sortAccuracy: { key: "sortAccuracy", label: "Sort accuracy KTC", unit: "%", direction: "higher-better", baseline: 99.2, target: 99.5, thresholds: [99.5, 98.5] },
  overstayRate: { key: "overstayRate", label: "% đơn lưu qua đêm", unit: "%", direction: "lower-better", baseline: 3, target: 2, thresholds: [2, 5] },
  missortRate: { key: "missortRate", label: "% đơn missort tại KTC", unit: "%", direction: "lower-better", baseline: 0.8, target: 0.5, thresholds: [0.5, 1.5] },
  forecastMape: { key: "forecastMape", label: "Forecast MAPE", unit: "%", direction: "lower-better", baseline: 12, target: 10, thresholds: [10, 15] },
  emptyBackhaul: { key: "emptyBackhaul", label: "% chuyến rỗng chiều về", unit: "%", direction: "lower-better", baseline: 25, target: 20, thresholds: [20, 30] },
  onTimeDeparture: { key: "onTimeDeparture", label: "On-time departure", unit: "%", direction: "higher-better", baseline: 93, target: 95, thresholds: [95, 90] },
  onTimeArrival: { key: "onTimeArrival", label: "On-time arrival", unit: "%", direction: "higher-better", baseline: 91, target: 95, thresholds: [95, 88] },
  tatHub: { key: "tatHub", label: "TAT tại KTC", unit: "h", direction: "lower-better", baseline: 6, target: 4, thresholds: [4, 8] },
  costPerKg: { key: "costPerKg", label: "Chi phí / kg", unit: "VND", direction: "lower-better", baseline: 2400, target: 2200, thresholds: [2200, 2700] },
  costPerOrder: { key: "costPerOrder", label: "Chi phí / đơn linehaul", unit: "VND", direction: "lower-better", baseline: 8500, target: 7905, thresholds: [7905, 8925] },
  pickupSuccessRate: { key: "pickupSuccessRate", label: "Tỷ lệ nhận thành công", unit: "%", direction: "higher-better", baseline: 96.5, target: 98, thresholds: [98, 95] },
  pickupCancelRate: { key: "pickupCancelRate", label: "Tỷ lệ huỷ pickup", unit: "%", direction: "lower-better", baseline: 2.5, target: 2, thresholds: [2, 4] },
  pickupLateRate: { key: "pickupLateRate", label: "Tỷ lệ pickup trễ", unit: "%", direction: "lower-better", baseline: 4, target: 2.5, thresholds: [2.5, 5] },
  pickupTatMin: { key: "pickupTatMin", label: "TAT pickup trung bình", unit: "phút", direction: "lower-better", baseline: 45, target: 30, thresholds: [30, 60] },
  bcNhanWrongCode: { key: "bcNhanWrongCode", label: "% Sai mã", unit: "%", direction: "lower-better", baseline: 0.8, target: 0.5, thresholds: [0.5, 1.5] },
  bcNhanWrongPackage: { key: "bcNhanWrongPackage", label: "% Sai kiện", unit: "%", direction: "lower-better", baseline: 0.5, target: 0.3, thresholds: [0.3, 1] },
  bcNhanMissingMvd: { key: "bcNhanMissingMvd", label: "% Không có MVĐ", unit: "%", direction: "lower-better", baseline: 0.3, target: 0.2, thresholds: [0.2, 0.5] },
  bcNhanTatMin: { key: "bcNhanTatMin", label: "TAT xử lý tại BC nhận", unit: "phút", direction: "lower-better", baseline: 22, target: 15, thresholds: [15, 30] },
  gtcRate: { key: "gtcRate", label: "% Giao thành công (GTC)", unit: "%", direction: "higher-better", baseline: 92, target: 95, thresholds: [95, 90] },
  gt1pRate: { key: "gt1pRate", label: "% Giao 1 phần (GT1P)", unit: "%", direction: "lower-better", baseline: 3, target: 2, thresholds: [2, 5] },
  gtbRate: { key: "gtbRate", label: "% Giao thất bại (GTB)", unit: "%", direction: "lower-better", baseline: 4, target: 3, thresholds: [3, 6] },
  lostRate: { key: "lostRate", label: "% Thất lạc", unit: "%", direction: "lower-better", baseline: 0.3, target: 0.2, thresholds: [0.2, 0.5] },
  returnSuccessRate: { key: "returnSuccessRate", label: "% Hoàn thành công", unit: "%", direction: "higher-better", baseline: 88, target: 92, thresholds: [92, 85] },
  returnFailRate: { key: "returnFailRate", label: "% Hoàn thất bại", unit: "%", direction: "lower-better", baseline: 8, target: 5, thresholds: [5, 10] },
  returnDays: { key: "returnDays", label: "Thời gian hoàn TB", unit: "ngày", direction: "lower-better", baseline: 4.5, target: 3, thresholds: [3, 6] },
  storedRate: { key: "storedRate", label: "% Hàng lưu kho", unit: "%", direction: "lower-better", baseline: 4, target: 3, thresholds: [3, 6] },
  sortRoutingAccuracy: { key: "sortRoutingAccuracy", label: "Sort routing accuracy", unit: "%", direction: "higher-better", baseline: 99, target: 99.5, thresholds: [99.5, 98] },
  crossDockRate: { key: "crossDockRate", label: "% cross-dock", unit: "%", direction: "higher-better", baseline: 78, target: 85, thresholds: [85, 70] },
  tuyenAssignAccuracy: { key: "tuyenAssignAccuracy", label: "% đơn vào đúng tuyến", unit: "%", direction: "higher-better", baseline: 96, target: 98, thresholds: [98, 94] },
  ordersPerTuyen: { key: "ordersPerTuyen", label: "Đơn / tuyến / NVBC", unit: "đơn", direction: "higher-better", baseline: 28, target: 32, thresholds: [32, 22] },
  firstLegOnTime: { key: "firstLegOnTime", label: "On-time BC nhận → KTC", unit: "%", direction: "higher-better", baseline: 93, target: 95, thresholds: [95, 90] },
  firstLegFill: { key: "firstLegFill", label: "Fill rate BC nhận → KTC", unit: "%", direction: "higher-better", baseline: 70, target: 78, thresholds: [78, 65] },
  firstLegLeadTime: { key: "firstLegLeadTime", label: "Lead time BC nhận → KTC", unit: "h", direction: "lower-better", baseline: 6, target: 4.5, thresholds: [4.5, 8] },
  lastLegOnTime: { key: "lastLegOnTime", label: "On-time KTC → BC giao", unit: "%", direction: "higher-better", baseline: 91, target: 94, thresholds: [94, 88] },
  lastLegFill: { key: "lastLegFill", label: "Fill rate KTC → BC giao", unit: "%", direction: "higher-better", baseline: 72, target: 78, thresholds: [78, 65] },
  lastLegLeadTime: { key: "lastLegLeadTime", label: "Lead time KTC → BC giao", unit: "h", direction: "lower-better", baseline: 5, target: 3.5, thresholds: [3.5, 7] },
};

function statusFromValue(spec: KpiSpec, value: number): Status {
  const [a, b] = spec.thresholds;
  if (spec.direction === "higher-better") {
    if (value >= a) return "green";
    if (value >= b) return "amber";
    return "red";
  }
  if (value <= a) return "green";
  if (value <= b) return "amber";
  return "red";
}

const STATUS_DOT: Record<Status, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};
const STATUS_BG: Record<Status, string> = {
  green: "bg-emerald-50 border-emerald-200 text-emerald-700",
  amber: "bg-amber-50 border-amber-200 text-amber-700",
  red: "bg-red-50 border-red-200 text-red-700",
};
const STATUS_LABEL_VI: Record<Status, string> = {
  green: "Đạt",
  amber: "Cảnh báo",
  red: "Vượt ngưỡng",
};

// =============================================================================
// 4. GEO + KTC + LANES (static dimensions)
// =============================================================================

const TODAY = "2026-05-20";
const HISTORY_DAYS = 365;
const SPARKLINE_DAYS = 14;
const BASE_VOLUME = 50000;

const REGIONS: Region[] = [
  { code: "bac", name: "Miền Bắc" },
  { code: "trung", name: "Miền Trung" },
  { code: "nam", name: "Miền Nam" },
];

const PROVINCES: Province[] = [
  { code: "HNI", name: "Hà Nội", regionCode: "bac" },
  { code: "HPG", name: "Hải Phòng", regionCode: "bac" },
  { code: "QNH", name: "Quảng Ninh", regionCode: "bac" },
  { code: "BNH", name: "Bắc Ninh", regionCode: "bac" },
  { code: "HDG", name: "Hải Dương", regionCode: "bac" },
  { code: "NDH", name: "Nam Định", regionCode: "bac" },
  { code: "TNG", name: "Thái Nguyên", regionCode: "bac" },
  { code: "THA", name: "Thanh Hoá", regionCode: "trung" },
  { code: "NAN", name: "Nghệ An", regionCode: "trung" },
  { code: "DNG", name: "Đà Nẵng", regionCode: "trung" },
  { code: "QNM", name: "Quảng Nam", regionCode: "trung" },
  { code: "KHA", name: "Khánh Hoà", regionCode: "trung" },
  { code: "HCM", name: "TP. Hồ Chí Minh", regionCode: "nam" },
  { code: "BDG", name: "Bình Dương", regionCode: "nam" },
  { code: "DNI", name: "Đồng Nai", regionCode: "nam" },
  { code: "LAN", name: "Long An", regionCode: "nam" },
  { code: "CTO", name: "Cần Thơ", regionCode: "nam" },
  { code: "TGG", name: "Tiền Giang", regionCode: "nam" },
  { code: "AGG", name: "An Giang", regionCode: "nam" },
  { code: "KGG", name: "Kiên Giang", regionCode: "nam" },
];

const KTC_DIST: { provinceCode: string; count: number }[] = [
  { provinceCode: "HNI", count: 3 }, { provinceCode: "HPG", count: 1 },
  { provinceCode: "QNH", count: 1 }, { provinceCode: "BNH", count: 1 },
  { provinceCode: "HDG", count: 1 }, { provinceCode: "NDH", count: 1 },
  { provinceCode: "TNG", count: 1 }, { provinceCode: "THA", count: 1 },
  { provinceCode: "NAN", count: 1 }, { provinceCode: "DNG", count: 2 },
  { provinceCode: "QNM", count: 1 }, { provinceCode: "KHA", count: 1 },
  { provinceCode: "HCM", count: 3 }, { provinceCode: "BDG", count: 2 },
  { provinceCode: "DNI", count: 1 }, { provinceCode: "LAN", count: 1 },
  { provinceCode: "CTO", count: 1 }, { provinceCode: "TGG", count: 1 },
  { provinceCode: "AGG", count: 1 },
];

const KTCS: Ktc[] = (() => {
  const out: Ktc[] = [];
  for (const { provinceCode, count } of KTC_DIST) {
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

const LANES: Lane[] = (() => {
  const rng = rngFor("ghn:lanes");
  const out: Lane[] = [];
  const seen = new Set<string>();
  const push = (o: string, d: string, distance: number) => {
    const key = `${o}->${d}`;
    if (seen.has(key) || o === d) return;
    seen.add(key);
    const oK = KTCS.find((k) => k.code === o)!;
    const dK = KTCS.find((k) => k.code === d)!;
    out.push({
      code: `L-${o}-${d}`,
      name: `${oK.name} → ${dK.name}`,
      originKtc: o,
      destKtc: d,
      originRegion: oK.regionCode,
      destRegion: dK.regionCode,
      distanceKm: distance,
    });
  };
  const trunk = [
    ["HCM-KTC01", "HNI-KTC01", 1720],
    ["HNI-KTC01", "HCM-KTC01", 1720],
    ["HCM-KTC01", "DNG-KTC01", 970],
    ["DNG-KTC01", "HCM-KTC01", 970],
    ["HNI-KTC01", "DNG-KTC01", 760],
    ["DNG-KTC01", "HNI-KTC01", 760],
  ] as const;
  for (const [o, d, dist] of trunk) push(o, d, dist);
  let safety = 5000;
  while (out.length < 50 && safety-- > 0) {
    const a = KTCS[Math.floor(rng() * KTCS.length)];
    const b = KTCS[Math.floor(rng() * KTCS.length)];
    if (a.code === b.code) continue;
    const intra = a.regionCode === b.regionCode;
    const dist = intra
      ? 80 + Math.floor(rng() * 250)
      : 400 + Math.floor(rng() * 1300);
    push(a.code, b.code, dist);
  }
  return out.slice(0, 50);
})();

// =============================================================================
// 5. DAILY VOLUME PROFILE (seasonality + incidents)
// =============================================================================

type DayMeta = {
  date: string;
  dayIdx: number;
  dow: number;
  multiplier: number;
  incident: boolean;
};

const TODAY_DATE = parseISO(TODAY);
const START_DATE = addDays(TODAY_DATE, -(HISTORY_DAYS - 1));

const DAYS: DayMeta[] = (() => {
  const incRng = rngFor("ghn:incidents");
  const totalMonths = Math.ceil(HISTORY_DAYS / 30);
  const incidents = new Set<string>();
  for (let m = 0; m < totalMonths; m++) {
    const start = addDays(START_DATE, m * 30);
    const days = 1 + Math.floor(incRng() * 2);
    for (let i = 0; i < days; i++) {
      const offset = Math.floor(incRng() * 30);
      const d = addDays(start, offset);
      if (d > TODAY_DATE) continue;
      incidents.add(toISO(d));
    }
  }
  const out: DayMeta[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = addDays(START_DATE, i);
    const date = toISO(d);
    const dow = d.getUTCDay();
    const dowMul = dow === 1 ? 1.18 : dow === 6 ? 1.22 : dow === 0 ? 0.7 : 1.0;
    const trendMul = 1 + (i / 7) * 0.005;
    let seasonal = 1;
    const md = date.slice(5);
    if (md === "11-11") seasonal = 3;
    else if (md === "12-12") seasonal = 2.5;
    else if (md === "11-27" || md === "11-28" || md === "11-29") seasonal = 2;
    if ((md >= "01-15" && md <= "01-31") || (md >= "02-01" && md <= "02-07"))
      seasonal = 1.5;
    if (md >= "02-10" && md <= "02-17") seasonal = 0.6;
    const incident = incidents.has(date);
    const incMul = incident ? 0.83 : 1;
    out.push({
      date,
      dayIdx: i,
      dow,
      multiplier: dowMul * trendMul * seasonal * incMul,
      incident,
    });
  }
  return out;
})();
function dayMeta(date: string): DayMeta {
  return DAYS.find((d) => d.date === date) ?? DAYS[DAYS.length - 1];
}

// =============================================================================
// 6. MOCK GETTERS — KPI / charts / tables
// =============================================================================

const KTC_PENALTY: Record<string, number> = {
  "KHA-KTC01": 0.85,
  "QNM-KTC01": 0.88,
  "NAN-KTC01": 0.9,
  "AGG-KTC01": 0.92,
};

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
function roundForUnit(x: number, unit: KpiUnit): number {
  if (unit === "VND" || unit === "ms") return Math.round(x);
  if (unit === "%") return round1(x);
  if (unit === "h" || unit === "ngày") return round1(x);
  if (unit === "kg" || unit === "km" || unit === "đơn" || unit === "phút")
    return Math.round(x);
  return round2(x);
}
function avg(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function kpiFromBase(
  key: keyof typeof KPI,
  filter: FilterState,
  modifier = 1,
): KpiValue {
  const spec = KPI[key];
  const sparkDays = lastNDays(SPARKLINE_DAYS, filter.to);
  const seedKey = `${key}:${filter.from}:${filter.to}:${filter.regionCode ?? ""}:${filter.provinceCode ?? ""}:${filter.ktcCode ?? ""}`;
  const offset = noise(seedKey, 0.025);
  let v = spec.baseline * (1 + offset) * modifier;
  const fromDate = parseISO(filter.to);
  const dayIdx = Math.max(
    0,
    Math.floor(
      (fromDate.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );
  const progress = clamp01(dayIdx / HISTORY_DAYS);
  const targetWeight = 0.35 * progress;
  v = v * (1 - targetWeight) + spec.target * targetWeight;
  if (filter.regionCode === "trung")
    v = spec.direction === "higher-better" ? v * 0.985 : v * 1.04;
  if (filter.ktcCode && KTC_PENALTY[filter.ktcCode]) {
    const p = KTC_PENALTY[filter.ktcCode];
    v = spec.direction === "higher-better" ? v * p : v * (2 - p);
  }
  const sparkline = sparkDays.map((d, i) => {
    const meta = dayMeta(d);
    const dn = noise(`${key}:${d}`, 0.02);
    const ip = meta.incident
      ? spec.direction === "higher-better"
        ? 0.95
        : 1.08
      : 1;
    const drift =
      (i - sparkDays.length / 2) *
      0.001 *
      (spec.direction === "higher-better" ? 1 : -1);
    return v * (1 + dn + drift) * ip;
  });
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
}

function worst(...xs: Status[]): Status {
  if (xs.includes("red")) return "red";
  if (xs.includes("amber")) return "amber";
  return "green";
}

// ---- Overall page ----------------------------------------------------------

function getOverallKpis(filter: FilterState) {
  return {
    otdMidMile: kpiFromBase("otdMidMile", filter),
    costPerParcel: kpiFromBase("costPerParcel", filter),
    fillRate: kpiFromBase("fillRate", filter),
    onTimeCutOff: kpiFromBase("onTimeCutOff", filter),
  };
}

function getNetworkKpis(filter: FilterState) {
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
    emptyBackhaul: kpiFromBase("emptyBackhaul", filter),
    firstLegOnTime: kpiFromBase("firstLegOnTime", filter),
    firstLegFill: kpiFromBase("firstLegFill", filter),
    firstLegLeadTime: kpiFromBase("firstLegLeadTime", filter),
    lastLegOnTime: kpiFromBase("lastLegOnTime", filter),
    lastLegFill: kpiFromBase("lastLegFill", filter),
    lastLegLeadTime: kpiFromBase("lastLegLeadTime", filter),
  };
}

function getRoutingKpis(filter: FilterState) {
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

function getVolumeStack(filter: FilterState, days = 30): VolumeStack[] {
  return lastNDays(days, filter.to).map((date) => {
    const m = dayMeta(date);
    const base = BASE_VOLUME * m.multiplier;
    return {
      date,
      standard: Math.round(base * 0.7 * (1 + noise(`vol:s:${date}`, 0.05))),
      bulky: Math.round(base * 0.18 * (1 + noise(`vol:b:${date}`, 0.06))),
      express: Math.round(base * 0.12 * (1 + noise(`vol:e:${date}`, 0.07))),
    };
  });
}

function getCostTrend(filter: FilterState, days = 30): SeriesPoint[] {
  const spec = KPI.costPerParcel;
  return lastNDays(days, filter.to).map((date) => {
    const m = dayMeta(date);
    const off = noise(`cost:${date}`, 0.04);
    return {
      date,
      actual: Math.round(spec.baseline * (1 + off) * (m.incident ? 1.05 : 1) * 0.96),
      target: spec.target,
    };
  });
}

function getCostStack(filter: FilterState, days = 30): CostStack[] {
  return lastNDays(days, filter.to).map((date) => {
    const m = dayMeta(date);
    const base = BASE_VOLUME * m.multiplier * 8000;
    return {
      date,
      standard: Math.round(base * 0.6 * (1 + noise(`csS:${date}`, 0.05))),
      bulky: Math.round(base * 0.25 * (1 + noise(`csB:${date}`, 0.05))),
      express: Math.round(base * 0.15 * (1 + noise(`csE:${date}`, 0.05))),
    };
  });
}

function getCostByCategory(filter: FilterState, days = 30) {
  const series = lastNDays(days, filter.to);
  const total = series.reduce((sum, date) => {
    const m = dayMeta(date);
    return sum + BASE_VOLUME * m.multiplier * 8000;
  }, 0);
  const cats = [
    { key: "partner", label: "Chi phí đối tác", share: 0.35, color: "#6B7CB8" },
    { key: "fuel", label: "Chi phí nhiên liệu", share: 0.25, color: "#EEA060" },
    { key: "salary", label: "Chi phí lương", share: 0.2, color: "#84B26A" },
    { key: "tolls", label: "Chi phí cầu đường", share: 0.1, color: "#B85850" },
    { key: "rental", label: "Chi phí thuê xe tải", share: 0.1, color: "#6F8AAB" },
  ];
  const noisy = cats.map((c) => ({
    ...c,
    raw: c.share * (1 + noise(`ccat:${c.key}:${filter.to}`, 0.06)),
  }));
  const sumRaw = noisy.reduce((a, b) => a + b.raw, 0);
  const rows: CostCategoryRow[] = noisy.map((c) => {
    const share = c.raw / sumRaw;
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

function getLeadTime(filter: FilterState) {
  const off = noise(`lead:${filter.from}:${filter.to}`, 0.03);
  return {
    p50: round1(18 * (1 + off)),
    p90: round1(34 * (1 + off)),
    p99: round1(52 * (1 + off)),
  };
}

function getQualityRows(filter: FilterState): QualityRow[] {
  const keys = ["missortRate", "overstayRate", "sortAccuracy", "routingAccuracy"] as const;
  return keys.map((k) => {
    const kpi = kpiFromBase(k, filter);
    return {
      label: kpi.label,
      value: kpi.value,
      unit: kpi.unit,
      deltaPct: kpi.deltaPct,
      status: kpi.status,
    };
  });
}

function getPipelineHealth(filter: FilterState): PipelineHealthRow[] {
  const top = ["HCM", "HNI", "DNG", "BDG", "HPG"];
  const rows: PipelineHealthRow[] = [];
  for (const mod of ["ORS", "NDS + KTC"] as const) {
    const regionTotals = top.map((pCode) => {
      const sub: FilterState = { ...filter, provinceCode: pCode };
      const kpi =
        mod === "ORS"
          ? kpiFromBase("routingAccuracy", sub)
          : kpiFromBase("onTimeCutOff", sub);
      return {
        region: PROVINCES.find((p) => p.code === pCode)!.name,
        status: kpi.status,
        value: kpi.value,
        unit: kpi.unit,
      };
    });
    const tot =
      mod === "ORS"
        ? kpiFromBase("routingAccuracy", filter)
        : kpiFromBase("onTimeCutOff", filter);
    rows.push({
      module: mod,
      regionTotals,
      totalStatus: tot.status,
      totalValue: tot.value,
    });
  }
  return rows;
}

function getOverallAlerts(filter: FilterState): AlertItem[] {
  const m = dayMeta(filter.to);
  const rng = rngFor("ghn:alerts-overall:" + filter.to);
  const out: AlertItem[] = [
    {
      id: "stuck",
      severity: "warning",
      title: "đơn Transporting + RECEIVED_AT_SORTING (đã nhập KTC nhưng chưa update status)",
      count: 1200 + Math.floor(rng() * 800),
    },
    { id: "low-fill", severity: "info", title: "lane fill rate <50% hôm nay", count: 3 + Math.floor(rng() * 5) },
    { id: "late-trip", severity: "warning", title: "trip chạy trễ >30 phút", count: 14 + Math.floor(rng() * 12) },
  ];
  if (m.incident)
    out.unshift({
      id: "inc",
      severity: "critical",
      title: "Sự cố vận hành — volume giảm ~17%, kiểm tra log",
    });
  return out;
}

function getOpsScorecardKpis(filter: FilterState): OpsScorecardRow[] {
  const entries: {
    key: string; label: string; w20: number; wtd: number;
    target: number; direction: KpiDirection; greenAt: number; amberAt: number;
  }[] = [
    { key: "odr", label: "ODR — On-time Delivery Rate", w20: 93.83, wtd: 93.0, target: 95, direction: "higher-better", greenAt: 95, amberAt: 92 },
    { key: "opr16", label: "OPR (COT 16h)", w20: 95.17, wtd: 94.17, target: 96, direction: "higher-better", greenAt: 95, amberAt: 92 },
    { key: "oprNew", label: "OPR (COT 9h–19h)", w20: 77.98, wtd: 74.23, target: 90, direction: "higher-better", greenAt: 90, amberAt: 80 },
    { key: "fd", label: "FD — Failed Delivery", w20: 5.59, wtd: 5.35, target: 4, direction: "lower-better", greenAt: 4, amberAt: 6 },
    { key: "late", label: "% Trễ không xuất tải", w20: 7.5, wtd: 7.3, target: 5, direction: "lower-better", greenAt: 5, amberAt: 8 },
    { key: "tc", label: "% Ontime trung chuyển (≥4 ca)", w20: 86.3, wtd: 86.2, target: 90, direction: "higher-better", greenAt: 90, amberAt: 80 },
    { key: "gtc", label: "%GTC — Giao thành công", w20: 64, wtd: 61, target: 70, direction: "higher-better", greenAt: 70, amberAt: 55 },
  ];
  void filter;
  return entries.map((e) => {
    const status: Status =
      e.direction === "higher-better"
        ? e.wtd >= e.greenAt ? "green" : e.wtd >= e.amberAt ? "amber" : "red"
        : e.wtd <= e.greenAt ? "green" : e.wtd <= e.amberAt ? "amber" : "red";
    return {
      key: e.key,
      label: e.label,
      w20Value: e.w20,
      wtdValue: e.wtd,
      target: e.target,
      direction: e.direction,
      unit: "%",
      status,
      deltaPp: round2(e.wtd - e.w20),
    };
  });
}

// ---- Routing page ----------------------------------------------------------

function getRoutingAccuracy24h(filter: FilterState): TimePoint[] {
  const spec = KPI.routingAccuracy;
  const out: TimePoint[] = [];
  for (let h = 0; h < 24; h++) {
    const isPeak = (h >= 8 && h <= 11) || (h >= 14 && h <= 17);
    const dip = isPeak ? -0.15 : 0;
    const rnd = noise(`r24:${filter.to}:${h}`, 0.4);
    out.push({
      date: `${String(h).padStart(2, "0")}:00`,
      value: round1(spec.baseline + dip + rnd),
    });
  }
  return out;
}

function getLatencyHistogram(filter: FilterState): HistogramBucket[] {
  const buckets = ["0-100ms", "100-200ms", "200-300ms", "300-400ms", "400-600ms", ">600ms"];
  const weights = [0.32, 0.41, 0.16, 0.07, 0.03, 0.01];
  const total = 100_000;
  return buckets.map((b, i) => ({
    bucket: b,
    count: Math.round(total * weights[i] * (1 + noise(`lh:${filter.to}:${i}`, 0.05))),
  }));
}

function getServiceBreakdown(filter: FilterState): ServiceBreakdownRow[] {
  const svs: ServiceType[] = ["standard", "bulky", "express"];
  return svs.map((s) => {
    const baseTotal = 80_000 * (s === "standard" ? 1 : s === "bulky" ? 0.25 : 0.18);
    const misPct = s === "standard" ? 1.2 : s === "bulky" ? 2.3 : 1.6;
    const adj = misPct * (1 + noise(`sb:${s}:${filter.to}`, 0.06));
    const totalCount = Math.round(baseTotal);
    return {
      serviceType: s,
      totalCount,
      misRouteCount: Math.round((adj / 100) * totalCount),
      misRoutePct: round1(adj),
    };
  });
}

function getServiceCoverage(filter: FilterState): ServiceCoverage[] {
  const svs: ServiceType[] = ["standard", "bulky", "express"];
  return svs.map((s) => ({
    serviceType: s,
    coveredPct: round1(
      (s === "standard" ? 99.4 : s === "bulky" ? 92 : 96) *
        (1 + noise(`sc:${s}:${filter.to}`, 0.005)),
    ),
  }));
}

function getMisRouteRows(filter: FilterState, limit = 20): MisRouteRow[] {
  const reasons = [
    "Sai mapping Phường/Xã",
    "BC nhận đóng (đang cập nhật)",
    "Vượt khả năng phục vụ",
    "Sai địa chỉ khách hàng",
    "Service không hỗ trợ vùng",
    "Routing fallback kích hoạt",
  ];
  const rng = rngFor("ghn:mis:" + filter.to);
  const svs: ServiceType[] = ["standard", "bulky", "express"];
  const out: MisRouteRow[] = [];
  for (let i = 0; i < limit; i++) {
    const sender = PROVINCES[Math.floor(rng() * PROVINCES.length)];
    let receiver = PROVINCES[Math.floor(rng() * PROVINCES.length)];
    if (receiver.code === sender.code)
      receiver = PROVINCES[(PROVINCES.indexOf(sender) + 3) % PROVINCES.length];
    const service = svs[Math.floor(rng() * svs.length)];
    const predicted = KTCS[Math.floor(rng() * KTCS.length)];
    let actual = KTCS[Math.floor(rng() * KTCS.length)];
    if (actual.code === predicted.code)
      actual = KTCS[(KTCS.indexOf(predicted) + 4) % KTCS.length];
    const minutesAgo = Math.floor(rng() * 6 * 60);
    const created = new Date(parseISO(filter.to).getTime() - minutesAgo * 60_000);
    const cYYYY = created.getUTCFullYear();
    const cMM = String(created.getUTCMonth() + 1).padStart(2, "0");
    const cDD = String(created.getUTCDate()).padStart(2, "0");
    const cHH = String(created.getUTCHours()).padStart(2, "0");
    const cmm = String(created.getUTCMinutes()).padStart(2, "0");
    out.push({
      mvd: `GHN${(700_000_000 + Math.floor(rng() * 99_999_999)).toString()}`,
      createdAt: `${cDD}/${cMM}/${cYYYY} ${cHH}:${cmm}`,
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

// ---- Network page ----------------------------------------------------------

function getVolumeForecast(filter: FilterState, days = 30): SeriesPoint[] {
  return lastNDays(days, filter.to).map((date) => {
    const m = dayMeta(date);
    const actual = Math.round(BASE_VOLUME * m.multiplier * (1 + noise(`vfa:${date}`, 0.03)));
    const forecast = Math.round(BASE_VOLUME * m.multiplier * (1 + noise(`vff:${date}`, 0.04)) * 0.94);
    return { date, actual, forecast };
  });
}

function getCutOffHeatmap(filter: FilterState): HeatmapData {
  const top = KTCS.slice(0, 10);
  const slots = ["Sáng (06-10)", "Trưa (10-14)", "Chiều (14-18)", "Tối (18-22)", "Đêm (22-02)"];
  const cells = top.flatMap((k) =>
    slots.map((slot) => {
      const baseline = 95;
      const pen = KTC_PENALTY[k.code] ?? 1;
      const sn = noise(`coh:${k.code}:${slot}:${filter.to}`, 0.04);
      const evePen = slot.startsWith("Tối") ? -3 : slot.startsWith("Đêm") ? -5 : 0;
      const value = round1(baseline * pen + evePen + sn * 10);
      return { row: k.name, col: slot, value, status: statusFromValue(KPI.onTimeCutOff, value) };
    }),
  );
  return { rows: top.map((k) => k.name), cols: slots, cells };
}

function getKtcOverstayFunnel(filter: FilterState): FunnelStep[] {
  const m = dayMeta(filter.to);
  const a = Math.round(BASE_VOLUME * m.multiplier * 0.6);
  const s = Math.round(a * 0.97);
  const p = Math.round(s * 0.985);
  const d = Math.round(p * 0.975);
  return [
    { label: "Nhập KTC", count: a },
    { label: "Sort xong", count: s, dropoffPct: round1(((a - s) / a) * 100) },
    { label: "Đóng kiện", count: p, dropoffPct: round1(((s - p) / s) * 100) },
    { label: "Xuất hàng", count: d, dropoffPct: round1(((p - d) / p) * 100) },
  ];
}

function getForecastMapeTrend(filter: FilterState, weeks = 12): TimePoint[] {
  const out: TimePoint[] = [];
  const ew = startOfWeek(parseISO(filter.to));
  for (let i = weeks - 1; i >= 0; i--) {
    const d = addDays(ew, -7 * i);
    out.push({ date: toISO(d), value: round1(12 + noise(`mape:${toISO(d)}`, 0.25) * 4) });
  }
  return out;
}

function getLanePerf(filter: FilterState): LanePerfRow[] {
  const m = dayMeta(filter.to);
  return LANES.slice(0, 20).map((l) => {
    const o = KTCS.find((k) => k.code === l.originKtc)!;
    const d = KTCS.find((k) => k.code === l.destKtc)!;
    const pen = (KTC_PENALTY[o.code] ?? 1) * (KTC_PENALTY[d.code] ?? 1);
    const fillR = round1(76 * pen + noise(`lp:fill:${l.code}`, 0.06) * 10);
    const costPerKg = Math.round(2300 * (1 + noise(`lp:cpk:${l.code}`, 0.08)));
    const otd = round1(94 + noise(`lp:otd:${l.code}`, 0.04) * 4);
    const ota = round1(92 + noise(`lp:ota:${l.code}`, 0.04) * 4);
    const miss = round1(0.6 + Math.abs(noise(`lp:miss:${l.code}`, 0.5)));
    const volume = Math.round(2000 * m.multiplier * (1 + noise(`lp:vol:${l.code}`, 0.4)));
    const status = worst(
      statusFromValue(KPI.fillRate, fillR),
      statusFromValue(KPI.onTimeArrival, ota),
      statusFromValue(KPI.missortRate, miss),
    );
    return {
      laneCode: l.code,
      laneName: l.name,
      volume,
      fillRate: fillR,
      costPerKg,
      onTimeDeparture: otd,
      onTimeArrival: ota,
      missortRate: miss,
      status,
    };
  });
}

function getKtcStatus(filter: FilterState): KtcStatusRow[] {
  void filter;
  return KTCS.map((k) => {
    const pen = KTC_PENALTY[k.code] ?? 1;
    const sa = round1(99.4 * pen + noise(`ks:sa:${k.code}`, 0.005) * 2);
    const tat = round1(5 + (1 - pen) * 6 + noise(`ks:tat:${k.code}`, 0.2) * 2);
    const proc = Math.round(2400 * pen + noise(`ks:p:${k.code}`, 0.2) * 800);
    const pend = Math.round(600 * (2 - pen) + noise(`ks:pp:${k.code}`, 0.3) * 400);
    const ready = Math.round(900 + noise(`ks:r:${k.code}`, 0.3) * 400);
    return {
      ktcCode: k.code,
      ktcName: k.name,
      regionCode: k.regionCode,
      processing: proc,
      pendingSort: pend,
      readyDispatch: ready,
      tatHours: tat,
      sortAccuracy: sa,
      status: worst(
        statusFromValue(KPI.sortAccuracy, sa),
        statusFromValue(KPI.tatHub, tat),
      ),
    };
  });
}

// ---- Journey page ---------------------------------------------------------

function getJourneyOverview(filter: FilterState): JourneyStageSummary[] {
  const m = dayMeta(filter.to);
  const total = Math.round(BASE_VOLUME * m.multiplier);
  const pickup = kpiFromBase("pickupSuccessRate", filter);
  const wrong = kpiFromBase("bcNhanWrongCode", filter);
  const sort = kpiFromBase("sortAccuracy", filter);
  const gtc = kpiFromBase("gtcRate", filter);
  const ret = kpiFromBase("returnSuccessRate", filter);
  return [
    { key: "pickup", step: 1, label: "Nhận hàng", shortLabel: "Pickup", description: "Người gửi tới BC hoặc NVPTTT đi nhận.", successRate: pickup.value, status: pickup.status, throughput: total, tone: "green" },
    { key: "bcNhan", step: 2, label: "BC nhận xử lý & phân kiện", shortLabel: "BC nhận", description: "Tạo đơn → phân loại → đóng kiện → xuất.", successRate: round1(100 - wrong.value * 3), status: wrong.status, throughput: Math.round(total * 0.965), tone: "blue" },
    { key: "ktc", step: 3, label: "KTC: nhập · sort · xuất", shortLabel: "KTC", description: "Hub trung gian. Nhập → sort → đóng kiện điểm đến → xuất.", successRate: sort.value, status: sort.status, throughput: Math.round(total * 0.95), tone: "violet" },
    { key: "bcGiao", step: 4, label: "BC giao: last-mile", shortLabel: "BC giao", description: "Phân tuyến · NVBC giao. ✓ GTC · ~ GT1P · × GTB.", successRate: gtc.value, status: gtc.status, throughput: Math.round(total * 0.94), tone: "amber" },
    { key: "bcHoan", step: 5, label: "BC hoàn: hoàn trả", shortLabel: "BC hoàn", description: "GTB >3 lần hoặc yêu cầu hoàn → trả người gửi.", successRate: ret.value, status: ret.status, throughput: Math.round(total * 0.07), tone: "rose" },
  ];
}

function getPickupKpis(filter: FilterState) {
  return {
    successRate: kpiFromBase("pickupSuccessRate", filter),
    cancelRate: kpiFromBase("pickupCancelRate", filter),
    lateRate: kpiFromBase("pickupLateRate", filter),
    avgTatMin: kpiFromBase("pickupTatMin", filter),
  };
}
function getBcNhanKpis(filter: FilterState) {
  return {
    wrongCodeRate: kpiFromBase("bcNhanWrongCode", filter),
    wrongPackageRate: kpiFromBase("bcNhanWrongPackage", filter),
    missingMvdRate: kpiFromBase("bcNhanMissingMvd", filter),
    processingTatMin: kpiFromBase("bcNhanTatMin", filter),
  };
}
function getBcGiaoKpis(filter: FilterState) {
  const m = dayMeta(filter.to);
  const daily = BASE_VOLUME * m.multiplier;
  const codCollected = Math.round(daily * 0.4 * 280_000 * (1 + noise(`cod:${filter.to}`, 0.03)));
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
function getBcHoanKpis(filter: FilterState) {
  return {
    returnSuccessRate: kpiFromBase("returnSuccessRate", filter),
    returnFailRate: kpiFromBase("returnFailRate", filter),
    avgReturnDays: kpiFromBase("returnDays", filter),
    storedRate: kpiFromBase("storedRate", filter),
  };
}

function getJourneyFunnel(filter: FilterState, stage: JourneyStageKey): FunnelStep[] {
  const m = dayMeta(filter.to);
  const total = Math.round(BASE_VOLUME * m.multiplier);
  const drop = (a: number, b: number) => (a === 0 ? 0 : round1(((a - b) / a) * 100));
  if (stage === "pickup") {
    const r = total;
    const a = Math.round(r * 0.985);
    const p = Math.round(a * 0.975);
    const into = Math.round(p * 0.995);
    return [
      { label: "Yêu cầu pickup", count: r },
      { label: "NVPTTT đến", count: a, dropoffPct: drop(r, a) },
      { label: "Lấy thành công", count: p, dropoffPct: drop(a, p) },
      { label: "Nhập BC nhận", count: into, dropoffPct: drop(p, into) },
    ];
  }
  if (stage === "bcNhan") {
    const c = Math.round(total * 0.985);
    const s = Math.round(c * 0.995);
    const p = Math.round(s * 0.99);
    const sh = Math.round(p * 0.99);
    return [
      { label: "Tạo & bắn đơn", count: c },
      { label: "Phân loại", count: s, dropoffPct: drop(c, s) },
      { label: "Đóng kiện", count: p, dropoffPct: drop(s, p) },
      { label: "Xuất → KTC/BC giao", count: sh, dropoffPct: drop(p, sh) },
    ];
  }
  if (stage === "ktc") return getKtcOverstayFunnel(filter);
  if (stage === "bcGiao") {
    const a = Math.round(total * 0.94);
    const r = Math.round(a * 0.995);
    const o = Math.round(r * 0.98);
    const d = Math.round(o * 0.94);
    return [
      { label: "Nhập BC giao", count: a },
      { label: "Phân tuyến", count: r, dropoffPct: drop(a, r) },
      { label: "Trên đường giao", count: o, dropoffPct: drop(r, o) },
      { label: "Giao thành công", count: d, dropoffPct: drop(o, d) },
    ];
  }
  const req = Math.round(total * 0.07);
  const ik = Math.round(req * 0.985);
  const ro = Math.round(ik * 0.98);
  const dn = Math.round(ro * 0.91);
  return [
    { label: "Yêu cầu hoàn", count: req },
    { label: "Nhập BC hoàn", count: ik, dropoffPct: drop(req, ik) },
    { label: "NVBC giao hoàn", count: ro, dropoffPct: drop(ik, ro) },
    { label: "Hoàn thành công", count: dn, dropoffPct: drop(ro, dn) },
  ];
}

function getJourneyAnomalies(filter: FilterState): AlertItem[] {
  const rng = rngFor("ghn:journey-anomaly:" + filter.to);
  return [
    { id: "anom1", severity: "warning", title: "đơn Transporting + RECEIVED_AT_SORTING (đã nhập KTC nhưng chưa cập nhật status)", count: 1100 + Math.floor(rng() * 900) },
    { id: "anom2", severity: "warning", title: "đơn Storing + RECEIVED_AT_LASTMILE (đã nhập BC giao/hoàn nhưng chưa cập nhật)", count: 800 + Math.floor(rng() * 600) },
  ];
}

function getNetworkAlerts(filter: FilterState): AlertItem[] {
  const m = dayMeta(filter.to);
  const rng = rngFor("ghn:net:" + filter.to);
  const out: AlertItem[] = [
    { id: "stk", severity: "warning", title: "đơn Transporting + RECEIVED_AT_SORTING (đã nhập KTC chưa update)", count: 1100 + Math.floor(rng() * 900) },
    { id: "lf", severity: "info", title: "lane fill rate <50% hôm nay", count: 3 + Math.floor(rng() * 4) },
  ];
  if (m.incident)
    out.push({ id: "inc", severity: "critical", title: "Sự cố mạng — 17% volume bị ảnh hưởng" });
  return out;
}

function getRoutingAlerts(filter: FilterState): AlertItem[] {
  const rng = rngFor("ghn:rt:" + filter.to);
  return [
    { id: "lat", severity: "warning", title: "request routing có latency P95 > 400ms (peak hour)", count: 4 + Math.floor(rng() * 6) },
    { id: "fb", severity: "info", title: "% đơn rơi vào fallback rule cao hơn baseline 0.4%" },
  ];
}

function defaultFilter(): FilterState {
  return {
    preset: "month",
    from: toISO(addDays(parseISO(TODAY), -29)),
    to: TODAY,
    granularity: "daily",
    regionCode: "all",
    serviceTypes: [],
  };
}

function presetToRange(preset: TimePreset): { from: string; to: string } {
  const today = parseISO(TODAY);
  if (preset === "today") return { from: TODAY, to: TODAY };
  if (preset === "week")
    return { from: toISO(startOfWeek(today)), to: TODAY };
  if (preset === "month")
    return { from: toISO(startOfMonth(today)), to: TODAY };
  return { from: toISO(addDays(today, -29)), to: TODAY };
}

function dataUpdatedAt(): Date {
  return new Date(parseISO(TODAY).getTime() + 9 * 60 * 60 * 1000 + 22 * 60 * 1000);
}

// =============================================================================
// 7. CONTEXTS — filter + nav (replaces URL routing in Artifacts sandbox)
// =============================================================================

type FilterCtx = {
  filter: FilterState;
  setFilter: (patch: Partial<FilterState>) => void;
  resetFilter: () => void;
};
const FilterContext = createContext<FilterCtx | null>(null);

function FilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilterState] = useState<FilterState>(() => defaultFilter());
  const setFilter = useCallback((patch: Partial<FilterState>) => {
    setFilterState((prev) => {
      const next = { ...prev, ...patch };
      // Cascade: changing region clears province/ktc.
      if ("regionCode" in patch && patch.regionCode !== prev.regionCode) {
        next.provinceCode = undefined;
        next.ktcCode = undefined;
      }
      if ("provinceCode" in patch && patch.provinceCode !== prev.provinceCode) {
        next.ktcCode = undefined;
      }
      if ("preset" in patch && patch.preset && patch.preset !== "custom") {
        const r = presetToRange(patch.preset);
        next.from = r.from;
        next.to = r.to;
      }
      return next;
    });
  }, []);
  const resetFilter = useCallback(() => setFilterState(defaultFilter()), []);
  const value = useMemo(
    () => ({ filter, setFilter, resetFilter }),
    [filter, setFilter, resetFilter],
  );
  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}
function useFilter(): FilterCtx {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used inside FilterProvider");
  return ctx;
}

type PageKey = "overall" | "journey" | "routing" | "network" | "upload";
type NavCtx = {
  page: PageKey;
  setPage: (p: PageKey) => void;
  // Hash for anchor scrolling within a page.
  anchor: string | null;
  setAnchor: (a: string | null) => void;
};
const NavContext = createContext<NavCtx | null>(null);
function useNav(): NavCtx {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used inside NavProvider");
  return ctx;
}

type UploadCtx = {
  scorecard?: OpsScorecardRow[];
  costByCategory?: CostCategoryRow[];
  lanePerf?: LanePerfRow[];
  ktcStatus?: KtcStatusRow[];
  setData: (key: keyof UploadCtxStore, rows: unknown[]) => void;
  clear: (key: keyof UploadCtxStore) => void;
  clearAll: () => void;
};
type UploadCtxStore = {
  scorecard?: OpsScorecardRow[];
  costByCategory?: CostCategoryRow[];
  lanePerf?: LanePerfRow[];
  ktcStatus?: KtcStatusRow[];
};
const UploadContext = createContext<UploadCtx | null>(null);
function UploadProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<UploadCtxStore>({});
  const setData = useCallback((key: keyof UploadCtxStore, rows: unknown[]) => {
    setStore((p) => ({ ...p, [key]: rows as never }));
  }, []);
  const clear = useCallback((key: keyof UploadCtxStore) => {
    setStore((p) => ({ ...p, [key]: undefined }));
  }, []);
  const clearAll = useCallback(() => setStore({}), []);
  const value = useMemo<UploadCtx>(
    () => ({ ...store, setData, clear, clearAll }),
    [store, setData, clear, clearAll],
  );
  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  );
}
function useUpload(): UploadCtx {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used inside UploadProvider");
  return ctx;
}

// =============================================================================
// 8. UI PRIMITIVES
// =============================================================================

function StatusDot({
  status,
  size = 8,
  className,
}: {
  status: Status;
  size?: 6 | 8 | 10;
  className?: string;
}) {
  const sz = size === 6 ? "w-1.5 h-1.5" : size === 8 ? "w-2 h-2" : "w-2.5 h-2.5";
  return (
    <span
      className={cn("inline-block rounded-full shrink-0", sz, STATUS_DOT[status], className)}
    />
  );
}

function StatusBadge({
  status,
  label,
  size = "sm",
}: {
  status: Status;
  label?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
        STATUS_BG[status],
      )}
    >
      <StatusDot status={status} size={6} />
      <span className="truncate">{label ?? STATUS_LABEL_VI[status]}</span>
    </span>
  );
}

function Sparkline({
  data,
  width = 96,
  height = 28,
  status,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  status?: Status;
  className?: string;
}) {
  if (data.length < 2)
    return <div style={{ width, height }} className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const stroke = status === "green" ? "#10B981" : status === "amber" ? "#F59E0B" : status === "red" ? "#EF4444" : "#6B7280";
  const areaPath = `M0,${height} L${points.split(" ").join(" L")} L${width},${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path d={areaPath} fill={stroke} fillOpacity={0.08} />
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function Button({
  variant = "secondary",
  size = "md",
  icon,
  children,
  className,
  onClick,
  disabled,
  type = "button",
}: {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const vCls =
    variant === "primary"
      ? "bg-white border border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
      : variant === "danger"
        ? "bg-red-600 text-white border border-red-600 hover:opacity-90"
        : variant === "ghost"
          ? "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          : "bg-white border border-gray-200 text-gray-900 hover:bg-gray-100";
  const sCls =
    size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-10 px-4 text-sm" : "h-9 px-3.5 text-sm";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        vCls,
        sCls,
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Card({
  title,
  subtitle,
  actions,
  footer,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-gray-200 rounded-md bg-white",
        className,
      )}
    >
      {(title || subtitle || actions) && (
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="min-w-0">
            {title && (
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
      {footer && (
        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-500">
          {footer}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  deltaPct,
  sparkline,
  target,
  status,
  direction,
  hint,
  size = "md",
}: {
  label: string;
  value: number;
  unit: KpiUnit;
  deltaPct: number;
  sparkline?: number[];
  target?: number;
  status: Status;
  direction: KpiDirection;
  hint?: string;
  size?: "md" | "sm";
}) {
  const improving =
    direction === "higher-better" ? deltaPct >= 0 : deltaPct <= 0;
  const deltaColor =
    Math.abs(deltaPct) < 0.05
      ? "text-gray-500"
      : improving
        ? "text-emerald-600"
        : "text-red-600";
  const DeltaIcon =
    Math.abs(deltaPct) < 0.05 ? Minus : deltaPct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div
      className={cn(
        "border border-gray-200 rounded-md bg-white",
        size === "md" ? "p-4" : "p-3",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 truncate">
          {label}
        </div>
        <StatusDot status={status} />
      </div>
      <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
        <div
          className={cn(
            "font-semibold text-gray-900",
            size === "md" ? "text-3xl" : "text-2xl",
          )}
        >
          {formatValue(value, unit)}
        </div>
        {target !== undefined && (
          <div className="text-xs text-gray-500 truncate">
            mục tiêu {formatValue(target, unit)}
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className={cn("flex items-center gap-0.5 text-xs font-medium tabular-nums", deltaColor)}>
          <DeltaIcon className="w-3 h-3" />
          {formatDelta(deltaPct)}
          <span className="text-gray-500 ml-1 font-normal">vs tuần trước</span>
        </div>
        {sparkline && sparkline.length > 0 && (
          <Sparkline
            data={sparkline}
            status={status}
            width={size === "md" ? 96 : 72}
            height={size === "md" ? 28 : 22}
          />
        )}
      </div>
      {hint && <div className="mt-2 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}
function KpiCardFrom({
  kpi,
  hint,
  size,
}: {
  kpi: KpiValue;
  hint?: string;
  size?: "md" | "sm";
}) {
  return (
    <KpiCard
      label={kpi.label}
      value={kpi.value}
      unit={kpi.unit}
      deltaPct={kpi.deltaPct}
      sparkline={kpi.sparkline}
      target={kpi.target}
      status={kpi.status}
      direction={kpi.direction}
      hint={hint}
      size={size}
    />
  );
}

function AlertBanner({ alerts }: { alerts: AlertItem[] }) {
  if (!alerts.length) return null;
  const styles = {
    info: { bar: "bg-sky-50 border-sky-200", icon: "text-sky-600", text: "text-sky-900", Icon: Info },
    warning: { bar: "bg-amber-50 border-amber-200", icon: "text-amber-600", text: "text-amber-900", Icon: AlertTriangle },
    critical: { bar: "bg-red-50 border-red-200", icon: "text-red-600", text: "text-red-900", Icon: XCircle },
  };
  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const s = styles[a.severity];
        return (
          <div key={a.id} className={cn("flex items-start gap-3 px-3 py-2 border rounded-md text-sm", s.bar)}>
            <s.Icon className={cn("w-4 h-4 mt-0.5 shrink-0", s.icon)} />
            <div className={cn("flex-1 min-w-0", s.text)}>
              {a.count !== undefined && (
                <span className="font-semibold tabular-nums">{formatInt(a.count)} </span>
              )}
              <span>{a.title}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- MetricChart (Recharts wrapper) --------------------------------------

type SeriesConfig = {
  key: string;
  label: string;
  color?: string;
  type?: "line" | "bar" | "area";
  stackId?: string;
  yAxisId?: "left" | "right";
};
const DEFAULT_COLORS = ["#F97316", "#1F2937", "#DC2626", "#0EA5E9", "#10B981", "#A855F7"];
const AXIS_PROPS = { stroke: "#9CA3AF", fontSize: 11, tickLine: false, axisLine: false };

type TipEntry = { name?: string | number; value?: number | string; color?: string };
function tooltipContent(
  active: boolean | undefined,
  payload: readonly TipEntry[] | undefined,
  label: string | number | undefined,
  format?: (v: number, name: string) => string,
): ReactNode {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm px-3 py-2 text-xs">
      <div className="text-gray-500 mb-1">{String(label)}</div>
      <ul className="space-y-0.5">
        {payload.map((p, i) => {
          const num = typeof p.value === "number" ? p.value : Number(p.value);
          return (
            <li key={i} className="flex items-center gap-2 text-gray-900">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="text-gray-500">{String(p.name ?? "")}:</span>
              <span className="font-medium tabular-nums">
                {Number.isFinite(num)
                  ? format
                    ? format(num, String(p.name ?? ""))
                    : num.toLocaleString("vi-VN")
                  : "-"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MetricChart<T extends Record<string, unknown>>({
  type,
  data,
  xKey,
  series,
  height = 240,
  xTickFormatter,
  yTickFormatter,
  rightYTickFormatter,
  tooltipValueFormatter,
  grid = true,
  legend = false,
}: {
  type: "line" | "bar" | "area" | "stacked-bar" | "combo";
  data: T[];
  xKey: string;
  series: SeriesConfig[];
  height?: number;
  xTickFormatter?: (v: string | number) => string;
  yTickFormatter?: (v: number) => string;
  rightYTickFormatter?: (v: number) => string;
  tooltipValueFormatter?: (v: number, name: string) => string;
  grid?: boolean;
  legend?: boolean;
}) {
  const colorAt = (i: number, override?: string) =>
    override ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
  const showRight = series.some((s) => s.yAxisId === "right");
  const Common = () => (
    <>
      {grid && <CartesianGrid stroke="#F0F0F0" vertical={false} />}
      <XAxis dataKey={xKey} {...AXIS_PROPS} tickFormatter={xTickFormatter as ((v: unknown) => string) | undefined} minTickGap={20} />
      <YAxis yAxisId="left" {...AXIS_PROPS} tickFormatter={yTickFormatter} width={50} />
      {showRight && (
        <YAxis yAxisId="right" orientation="right" {...AXIS_PROPS} tickFormatter={rightYTickFormatter ?? yTickFormatter} width={50} />
      )}
      <Tooltip
        cursor={{ stroke: "#E5E5E5", strokeWidth: 1 }}
        content={({ active, payload, label }) =>
          tooltipContent(active, payload as unknown as readonly TipEntry[] | undefined, label as string | number | undefined, tooltipValueFormatter)
        }
      />
      {legend && (
        <Legend verticalAlign="top" align="right" height={24} iconType="rect" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
      )}
    </>
  );
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        {type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <Common />
            {series.map((s, i) => (
              <Line key={s.key} yAxisId="left" type="monotone" dataKey={s.key} name={s.label} stroke={colorAt(i, s.color)} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />
            ))}
          </LineChart>
        ) : type === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <Common />
            {series.map((s, i) => {
              const c = colorAt(i, s.color);
              return <Area key={s.key} yAxisId="left" type="monotone" dataKey={s.key} name={s.label} stroke={c} fill={c} fillOpacity={0.16} strokeWidth={2} isAnimationActive={false} />;
            })}
          </AreaChart>
        ) : type === "bar" || type === "stacked-bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <Common />
            {series.map((s, i) => (
              <Bar key={s.key} yAxisId="left" dataKey={s.key} name={s.label} stackId={type === "stacked-bar" ? (s.stackId ?? "stack") : undefined} fill={colorAt(i, s.color)} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        ) : (
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <Common />
            {series.map((s, i) => {
              const c = colorAt(i, s.color);
              const yId = s.yAxisId ?? "left";
              if (s.type === "bar")
                return <Bar key={s.key} yAxisId={yId} dataKey={s.key} name={s.label} fill={c} radius={[2, 2, 0, 0]} isAnimationActive={false} />;
              if (s.type === "area")
                return <Area key={s.key} yAxisId={yId} type="monotone" dataKey={s.key} name={s.label} stroke={c} fill={c} fillOpacity={0.16} strokeWidth={2} isAnimationActive={false} />;
              return <Line key={s.key} yAxisId={yId} type="monotone" dataKey={s.key} name={s.label} stroke={c} strokeWidth={2} dot={false} activeDot={{ r: 3 }} isAnimationActive={false} />;
            })}
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// ---- Donut ---------------------------------------------------------------

type DonutSlice = { key: string; label: string; value: number; color: string };
function Donut({
  data,
  height = 220,
  innerRadius = 60,
  outerRadius = 95,
  centerLabel,
  valueFormatter = (v) => v.toLocaleString("vi-VN"),
}: {
  data: DonutSlice[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: ReactNode;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            stroke="#ffffff"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0] as unknown as { value: number | string; payload: DonutSlice };
              const v = typeof p.value === "number" ? p.value : Number(p.value);
              return (
                <div className="bg-white border border-gray-200 rounded-md shadow-sm px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 text-gray-900">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.payload.color }} />
                    <span className="text-gray-500">{p.payload.label}:</span>
                    <span className="font-medium tabular-nums">{valueFormatter(v)}</span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {centerLabel}
        </div>
      )}
    </div>
  );
}

// ---- Funnel + Heatmap ----------------------------------------------------

function Funnel({ steps }: { steps: FunnelStep[] }) {
  if (!steps.length) return null;
  const max = Math.max(...steps.map((s) => s.count));
  const colors = ["#1F2937", "#374151", "#4B5563", "#6B7280", "#9CA3AF"];
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const pct = max === 0 ? 0 : (s.count / max) * 100;
        const color = colors[Math.min(i, colors.length - 1)];
        return (
          <div key={s.label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-xs text-gray-900 truncate">{s.label}</div>
            <div className="flex-1 relative h-7 bg-gray-100 rounded">
              <div
                className="absolute left-0 top-0 bottom-0 rounded transition-[width] duration-300"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
              <div
                className="absolute left-2 top-0 bottom-0 flex items-center text-xs font-medium tabular-nums"
                style={{ color: pct > 30 ? "white" : "#1F2937" }}
              >
                {formatInt(s.count)}
              </div>
            </div>
            <div className="w-24 shrink-0 text-right text-xs tabular-nums">
              {s.dropoffPct !== undefined ? (
                <span className="text-red-600">−{formatPct(s.dropoffPct)}</span>
              ) : (
                <span className="text-gray-500">khởi điểm</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const HEATMAP_BG: Record<Status, string> = {
  green: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
  amber: "bg-amber-100 hover:bg-amber-200 text-amber-900",
  red: "bg-red-100 hover:bg-red-200 text-red-900",
};
function Heatmap({
  data,
  valueFormat = (v) => v.toLocaleString("vi-VN"),
  rowLabel,
  colLabel,
}: {
  data: HeatmapData;
  valueFormat?: (v: number) => string;
  rowLabel?: string;
  colLabel?: string;
}) {
  const lookup = new Map<string, { value: number; status: Status }>();
  for (const c of data.cells) lookup.set(`${c.row}|${c.col}`, { value: c.value, status: c.status });
  const gridTemplate = `minmax(160px, 200px) repeat(${data.cols.length}, minmax(80px, 1fr))`;
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1 min-w-fit" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="px-2 py-1.5 text-[11px] uppercase tracking-wide text-gray-500">
          {rowLabel}
          {colLabel && <span className="opacity-50"> / {colLabel}</span>}
        </div>
        {data.cols.map((c) => (
          <div key={c} className="px-2 py-1.5 text-[11px] font-medium text-gray-900 text-center">
            {c}
          </div>
        ))}
        {data.rows.map((row) => (
          <React.Fragment key={row}>
            <div className="px-2 py-2 text-xs font-medium text-gray-900 truncate self-center">{row}</div>
            {data.cols.map((col) => {
              const cell = lookup.get(`${row}|${col}`);
              if (!cell)
                return (
                  <div key={col} className="px-2 py-2 text-xs text-gray-500 text-center bg-gray-100 rounded">-</div>
                );
              return (
                <div
                  key={col}
                  className={cn("px-2 py-2 text-xs tabular-nums text-center rounded", HEATMAP_BG[cell.status])}
                  title={`${row} — ${col}: ${valueFormat(cell.value)}`}
                >
                  {valueFormat(cell.value)}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        {(["green", "amber", "red"] as Status[]).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn("w-3 h-3 rounded-sm", STATUS_DOT[s])} />
            <span>{STATUS_LABEL_VI[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- DataTable -----------------------------------------------------------

type Column<T> = {
  key: string;
  label: string;
  accessor?: (row: T) => unknown;
  align?: "left" | "right" | "center";
  width?: number | string;
  render?: (row: T) => ReactNode;
  format?: (v: unknown, row: T) => string;
  sortable?: boolean;
  sortValue?: (row: T) => number | string;
  className?: string;
};
function getCellValue<T>(col: Column<T>, row: T): unknown {
  if (col.accessor) return col.accessor(row);
  return (row as Record<string, unknown>)[col.key];
}
function DataTable<T>({
  columns,
  data,
  rowKey,
  searchable = false,
  searchPlaceholder = "Tìm trong bảng...",
  pageSize,
  emptyText = "Không có dữ liệu",
}: {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  emptyText?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q) return data;
    const lower = q.toLowerCase();
    return data.filter((r) =>
      columns.some((c) => {
        const v = getCellValue(c, r);
        if (v === null || v === undefined) return false;
        return String(v).toLowerCase().includes(lower);
      }),
    );
  }, [data, q, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortValue ? col.sortValue(a) : (getCellValue(col, a) as number | string);
      const bv = col.sortValue ? col.sortValue(b) : (getCellValue(col, b) as number | string);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av).localeCompare(String(bv), "vi") * sign;
    });
  }, [filtered, sort, columns]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const rows = pageSize ? sorted.slice(page * pageSize, page * pageSize + pageSize) : sorted;

  return (
    <div className="flex flex-col gap-2">
      {searchable && (
        <div className="relative w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="w-full h-8 pl-8 pr-3 text-sm border border-gray-200 rounded-md outline-none focus:border-red-600"
          />
        </div>
      )}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map((col) => {
                  const sorting = sort?.key === col.key;
                  return (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className={cn(
                        "px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-gray-500",
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                      )}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSort((s) =>
                              s?.key === col.key
                                ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" }
                                : { key: col.key, dir: "asc" },
                            )
                          }
                          className={cn(
                            "inline-flex items-center gap-1 hover:text-gray-900",
                            col.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {col.label}
                          {sorting ? (
                            sort?.dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-500">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={rowKey(row)} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                    {columns.map((col) => {
                      const v = getCellValue(col, row);
                      const display = col.render
                        ? col.render(row)
                        : col.format
                          ? col.format(v, row)
                          : v === null || v === undefined || v === ""
                            ? "-"
                            : String(v);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3 text-gray-900 tabular-nums",
                            col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                            col.className,
                          )}
                        >
                          {display}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {pageSize && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
            <div>
              {sorted.length === 0
                ? "0"
                : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, sorted.length)}`}{" "}
              / {sorted.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-7 px-2 rounded border border-gray-200 disabled:opacity-40"
              >
                Trước
              </button>
              <span className="px-2">
                Trang {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="h-7 px-2 rounded border border-gray-200 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 9. FILTER COMPONENTS
// =============================================================================

type SelectOption<V extends string = string> = { value: V; label: string };

function Select<V extends string = string>({
  value,
  options,
  onChange,
  placeholder = "Chọn...",
  label,
  width,
  searchable = false,
  disabled = false,
}: {
  value: V | undefined;
  options: SelectOption<V>[];
  onChange: (v: V) => void;
  placeholder?: string;
  label?: ReactNode;
  width?: number | string;
  searchable?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <div className="relative" ref={rootRef} style={{ width }}>
      {label && (
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
          {label}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 rounded-md bg-white border border-gray-200",
          "hover:border-gray-400 focus:outline-none focus:border-red-600",
          "disabled:bg-gray-100 disabled:cursor-not-allowed",
          "h-9 text-sm",
        )}
      >
        <span className={cn("truncate text-left", selected ? "text-gray-900" : "text-gray-400")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-full max-h-72 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg">
          {searchable && (
            <div className="p-2 border-b border-gray-200">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm..."
                className="w-full h-8 px-2 text-sm border border-gray-200 rounded outline-none focus:border-red-600"
              />
            </div>
          )}
          <ul className="py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-500">Không có kết quả</li>
            ) : (
              filtered.map((o) => {
                const isSelected = o.value === value;
                return (
                  <li
                    key={o.value}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQ("");
                    }}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer",
                      isSelected ? "bg-red-50 text-red-600" : "text-gray-900 hover:bg-gray-100",
                    )}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function DimensionSelect<V extends string>({
  label,
  value,
  options,
  onChange,
  allOptionLabel = "Tất cả",
  disabled,
  width = 180,
  searchable,
}: {
  label: string;
  value: V | undefined;
  options: SelectOption<V>[];
  onChange: (v: V | undefined) => void;
  allOptionLabel?: string;
  disabled?: boolean;
  width?: number | string;
  searchable?: boolean;
}) {
  const ALL = "__all__" as const;
  type Opt = SelectOption<V | typeof ALL>;
  const full: Opt[] = [{ value: ALL as V | typeof ALL, label: allOptionLabel }, ...options];
  return (
    <Select<V | typeof ALL>
      label={label}
      value={(value ?? ALL) as V | typeof ALL}
      options={full}
      onChange={(v) => onChange(v === ALL ? undefined : (v as V))}
      disabled={disabled}
      width={width}
      searchable={searchable}
    />
  );
}

function GranularityToggle({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (v: Granularity) => void;
}) {
  const opts: { value: Granularity; label: string }[] = [
    { value: "daily", label: "Ngày" },
    { value: "weekly", label: "Tuần" },
    { value: "monthly", label: "Tháng" },
  ];
  return (
    <div className="inline-flex bg-white border border-gray-200 rounded-md p-0.5">
      {opts.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 h-7 text-xs font-medium rounded transition-colors",
              active ? "bg-red-50 text-red-600" : "text-gray-500 hover:text-gray-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DateRangePicker({
  preset,
  from,
  to,
  onChange,
}: {
  preset: TimePreset;
  from: string;
  to: string;
  onChange: (next: { preset: TimePreset; from: string; to: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const opts: { value: TimePreset; label: string }[] = [
    { value: "today", label: "Hôm nay" },
    { value: "week", label: "Tuần này" },
    { value: "month", label: "Tháng này" },
    { value: "custom", label: "Tuỳ chỉnh" },
  ];
  const buttonLabel =
    preset === "custom"
      ? `${formatDDMMYYYY(from)} → ${formatDDMMYYYY(to)}`
      : opts.find((o) => o.value === preset)?.label ?? "Khoảng thời gian";
  return (
    <div className="relative" ref={ref}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">
        Khoảng thời gian
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 inline-flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-md hover:border-gray-400 text-sm min-w-[220px]"
      >
        <span className="inline-flex items-center gap-2 truncate">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span className="truncate text-gray-900">{buttonLabel}</span>
        </span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 right-0 min-w-[320px] bg-white border border-gray-200 rounded-md shadow-lg p-3">
          <div className="grid grid-cols-2 gap-1 mb-3">
            {opts.map((o) => {
              const active = o.value === preset;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    if (o.value === "custom") onChange({ preset: "custom", from, to });
                    else {
                      const r = presetToRange(o.value);
                      onChange({ preset: o.value, from: r.from, to: r.to });
                      setOpen(false);
                    }
                  }}
                  className={cn(
                    "h-8 px-3 text-sm rounded border text-left",
                    active ? "bg-red-50 border-red-600 text-red-600" : "border-gray-200 text-gray-900 hover:bg-gray-100",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <div className={preset === "custom" ? "" : "opacity-50 pointer-events-none"}>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wide text-gray-500">Từ ngày</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => onChange({ preset: "custom", from: e.target.value, to })}
                  className="mt-1 w-full h-8 px-2 text-sm border border-gray-200 rounded outline-none focus:border-red-600"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] uppercase tracking-wide text-gray-500">Đến ngày</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => onChange({ preset: "custom", from, to: e.target.value })}
                  className="mt-1 w-full h-8 px-2 text-sm border border-gray-200 rounded outline-none focus:border-red-600"
                />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 px-3 text-xs font-medium bg-red-600 text-white rounded hover:opacity-90"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceTypeMulti({
  value,
  onChange,
}: {
  value: ServiceType[];
  onChange: (v: ServiceType[]) => void;
}) {
  const ALL: ServiceType[] = ["standard", "bulky", "express"];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const isAll = value.length === 0 || value.length === ALL.length;
  const buttonLabel = isAll ? "Tất cả dịch vụ" : value.map((s) => SERVICE_LABEL_VI[s]).join(", ");
  function toggle(s: ServiceType) {
    if (isAll) {
      onChange([s]);
      return;
    }
    if (value.includes(s)) {
      const next = value.filter((x) => x !== s);
      onChange(next.length === 0 ? [] : next);
    } else {
      const next = [...value, s];
      onChange(next.length === ALL.length ? [] : next);
    }
  }
  return (
    <div className="relative" ref={ref}>
      <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Loại dịch vụ</div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 inline-flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-md hover:border-gray-400 text-sm min-w-[180px]"
      >
        <span className="truncate text-gray-900">{buttonLabel}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
      </button>
      {open && (
        <ul className="absolute z-50 mt-1 left-0 min-w-full bg-white border border-gray-200 rounded-md shadow-lg py-1">
          {ALL.map((s) => {
            const active = isAll || value.includes(s);
            return (
              <li
                key={s}
                onClick={() => toggle(s)}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer",
                  active ? "text-red-600 bg-red-50" : "text-gray-900 hover:bg-gray-100",
                )}
              >
                <span>{SERVICE_LABEL_VI[s]}</span>
                {active && <Check className="w-3.5 h-3.5" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterBar({
  show = {},
}: {
  show?: {
    region?: boolean;
    province?: boolean;
    service?: boolean;
    granularity?: boolean;
    ktc?: boolean;
    lane?: boolean;
  };
}) {
  const { filter, setFilter, resetFilter } = useFilter();
  const cfg = {
    region: true,
    province: true,
    service: true,
    granularity: true,
    ktc: false,
    lane: false,
    ...show,
  };
  const regionOpts = REGIONS.map((r) => ({ value: r.code, label: r.name }));
  const provinceOpts = PROVINCES.filter(
    (p) => !filter.regionCode || filter.regionCode === "all" || p.regionCode === filter.regionCode,
  ).map((p) => ({ value: p.code, label: p.name }));
  const ktcOpts = KTCS.filter(
    (k) => !filter.regionCode || filter.regionCode === "all" || k.regionCode === filter.regionCode,
  )
    .filter((k) => !filter.provinceCode || k.provinceCode === filter.provinceCode)
    .map((k) => ({ value: k.code, label: k.name }));
  const laneOpts = LANES.map((l) => ({ value: l.code, label: l.name }));

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 border border-gray-200 bg-white rounded-md">
      <DateRangePicker
        preset={filter.preset}
        from={filter.from}
        to={filter.to}
        onChange={(next) => setFilter({ preset: next.preset, from: next.from, to: next.to })}
      />
      {cfg.region && (
        <DimensionSelect
          label="Vùng"
          value={filter.regionCode && filter.regionCode !== "all" ? filter.regionCode : undefined}
          options={regionOpts}
          onChange={(v) => setFilter({ regionCode: v ?? "all" })}
          allOptionLabel="Toàn quốc"
          width={150}
        />
      )}
      {cfg.province && (
        <DimensionSelect
          label="Tỉnh / Thành"
          value={filter.provinceCode}
          options={provinceOpts}
          onChange={(v) => setFilter({ provinceCode: v })}
          allOptionLabel="Tất cả Tỉnh / Thành"
          width={200}
          searchable
        />
      )}
      {cfg.ktc && (
        <DimensionSelect
          label="KTC"
          value={filter.ktcCode}
          options={ktcOpts}
          onChange={(v) => setFilter({ ktcCode: v })}
          allOptionLabel="Tất cả KTC"
          width={220}
          searchable
        />
      )}
      {cfg.lane && (
        <DimensionSelect
          label="Lane"
          value={filter.laneCode}
          options={laneOpts}
          onChange={(v) => setFilter({ laneCode: v })}
          allOptionLabel="Tất cả lane"
          width={240}
          searchable
        />
      )}
      {cfg.service && (
        <ServiceTypeMulti
          value={filter.serviceTypes}
          onChange={(v) => setFilter({ serviceTypes: v })}
        />
      )}
      {cfg.granularity && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Mức tổng hợp</div>
          <GranularityToggle
            value={filter.granularity}
            onChange={(v) => setFilter({ granularity: v })}
          />
        </div>
      )}
      <div className="ml-auto self-end">
        <button
          type="button"
          onClick={resetFilter}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md"
        >
          <RotateCcw className="w-3 h-3" /> Đặt lại
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// 10. SHELL — Sidebar, TopBar, PageHeader, StageHeader, JourneyFlow
// =============================================================================

const NAV_ITEMS: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overall", label: "Tổng quan", icon: LayoutDashboard },
  { key: "journey", label: "Hành trình đơn hàng", icon: Workflow },
  { key: "routing", label: "Định tuyến (ORS)", icon: Route },
  { key: "network", label: "Mạng lưới (NDS + KTC)", icon: Truck },
  { key: "upload", label: "Tải lên dữ liệu", icon: UploadIcon },
];

function Sidebar() {
  const { page, setPage } = useNav();
  return (
    <aside className="shrink-0 w-60 border-r border-gray-200 bg-white">
      <nav className="py-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = page === item.key;
          return (
            <button
              type="button"
              key={item.key}
              onClick={() => setPage(item.key)}
              className={cn(
                "w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm border-l-2",
                active
                  ? "bg-red-50 text-red-600 border-red-600 font-medium"
                  : "border-transparent text-gray-900 hover:bg-gray-100",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
        <div className="px-4 mt-4 pt-4 border-t border-gray-200">
          <button
            type="button"
            className="w-full text-left flex items-center gap-3 px-0 py-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Báo cáo</span>
          </button>
          <button
            type="button"
            className="w-full text-left flex items-center gap-3 px-0 py-2 text-sm text-gray-500 hover:text-gray-900"
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span>Cài đặt</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center px-3 gap-3">
      <button type="button" className="p-2 rounded hover:bg-gray-100 text-gray-500">
        <Menu className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2">
        <div className="bg-orange-500 text-white font-bold px-2 py-1 rounded text-sm leading-none">
          GHN
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-900 leading-tight">GiaoHangNhanh</div>
          <div className="text-[10px] text-gray-500 leading-tight">Giao Siêu Nhanh, Giao Siêu Tốt</div>
        </div>
      </div>
      <div className="ml-3 pl-3 border-l border-gray-200 text-sm font-medium text-gray-900">
        Network Ops
      </div>
      <div className="flex-1 flex justify-center">
        <div className="relative w-96 max-w-full">
          <input
            type="text"
            placeholder="Tìm lane, hub, BC, trip ID..."
            className="w-full h-9 pl-3 pr-12 text-sm bg-white border border-gray-200 rounded-md outline-none focus:border-red-600 placeholder:text-gray-400"
          />
          <button
            type="button"
            className="absolute right-0 top-0 h-9 w-10 rounded-r-md bg-orange-500 text-white flex items-center justify-center hover:opacity-90"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </div>
      <button type="button" className="flex items-center gap-2 h-9 px-3 text-sm border border-gray-200 rounded-md hover:bg-gray-100">
        <span className="text-gray-900 max-w-[220px] truncate">2315 - Bưu cục 89 Nguyễn Thị Định</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
      </button>
      <button type="button" className="relative p-2 rounded hover:bg-gray-100 text-gray-500">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-600" />
      </button>
      <div className="w-8 h-8 rounded-full bg-red-600 text-white text-xs font-semibold flex items-center justify-center">VP</div>
    </header>
  );
}

function PageHeader({
  breadcrumb,
  title,
  subtitle,
  updatedAt,
}: {
  breadcrumb?: { label: string; key?: PageKey }[];
  title: string;
  subtitle?: string;
  updatedAt?: Date;
}) {
  const { setPage } = useNav();
  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-gray-200">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-gray-500">
          {breadcrumb.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              {c.key ? (
                <button
                  type="button"
                  onClick={() => setPage(c.key!)}
                  className="hover:text-gray-900 transition-colors"
                >
                  {c.label}
                </button>
              ) : (
                <span>{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />}>
            Tải xuống dữ liệu
          </Button>
          <Button variant="primary" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Cập nhật dữ liệu
          </Button>
        </div>
      </div>
      {updatedAt && (
        <div className="text-xs text-gray-500">
          Thời gian cập nhật lần cuối: {updatedAt
            .toISOString()
            .slice(0, 10)
            .split("-")
            .reverse()
            .join("/")}{" "}
          {String(updatedAt.getUTCHours()).padStart(2, "0")}:
          {String(updatedAt.getUTCMinutes()).padStart(2, "0")}
        </div>
      )}
    </div>
  );
}

const STAGE_STRIP_TONE: Record<StageTone, string> = {
  green: "bg-emerald-500",
  blue: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-500",
};

function StageHeader({
  step,
  label,
  description,
  tone = "slate",
}: {
  step: number | string;
  label: string;
  description?: string;
  tone?: StageTone;
}) {
  return (
    <div className="flex items-start gap-3 pt-2">
      <span
        className={cn(
          "w-7 h-7 shrink-0 rounded-md text-white font-semibold flex items-center justify-center text-sm",
          STAGE_STRIP_TONE[tone],
        )}
      >
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-gray-900">{label}</h2>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

const STAGE_CARD_TONE: Record<
  Extract<StageTone, "green" | "blue" | "violet" | "amber" | "rose">,
  { bg: string; border: string; step: string }
> = {
  green: { bg: "bg-emerald-50", border: "border-emerald-200", step: "bg-emerald-600 text-white" },
  blue: { bg: "bg-sky-50", border: "border-sky-200", step: "bg-sky-600 text-white" },
  violet: { bg: "bg-violet-50", border: "border-violet-200", step: "bg-violet-600 text-white" },
  amber: { bg: "bg-amber-50", border: "border-amber-200", step: "bg-amber-600 text-white" },
  rose: { bg: "bg-rose-50", border: "border-rose-200", step: "bg-rose-600 text-white" },
};

function JourneyFlow({ stages }: { stages: JourneyStageSummary[] }) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
      {stages.map((s, i) => {
        const t = STAGE_CARD_TONE[s.tone];
        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <div className={cn("block min-w-[200px] xl:min-w-[220px] border rounded-md p-3", t.bg, t.border)}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center", t.step)}>
                  {s.step}
                </span>
                <span className="text-xs font-medium text-gray-900 truncate">{s.shortLabel}</span>
                <StatusDot status={s.status} className="ml-auto" />
              </div>
              <div className="text-xl font-semibold tabular-nums text-gray-900">
                {formatPct(s.successRate)}
              </div>
              <div className="text-[11px] text-gray-500 mt-1 tabular-nums">
                ~{formatCompactInt(s.throughput)} đơn/ngày
              </div>
            </div>
            {i < stages.length - 1 && <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// 11. PAGES
// =============================================================================

// ---- Overall page --------------------------------------------------------

function OverallPage() {
  const { filter, setFilter } = useFilter();
  const { setPage } = useNav();
  const { scorecard: uploadedScorecard, costByCategory: uploadedCostByCat } = useUpload();
  const kpis = getOverallKpis(filter);
  const network = getNetworkKpis(filter);
  const scorecard = uploadedScorecard ?? getOpsScorecardKpis(filter);
  const costByCategoryRaw = getCostByCategory(filter, 30);
  const costByCategory = uploadedCostByCat
    ? { rows: uploadedCostByCat, total: uploadedCostByCat.reduce((a, b) => a + b.amount, 0) }
    : costByCategoryRaw;
  const volume = getVolumeStack(filter, 30);
  const costTrend = getCostTrend(filter, 30);
  const costStack = getCostStack(filter, 30);
  const quality = getQualityRows(filter);
  const lead = getLeadTime(filter);
  const pipeline = getPipelineHealth(filter);
  const alerts = getOverallAlerts(filter);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops" }]}
        title="Tổng quan mạng middle-mile"
        subtitle="Sức khoẻ vận hành middle-mile + linehaul — từ lúc đơn được gán bưu cục cho đến khi về bưu cục giao cuối cùng."
        updatedAt={dataUpdatedAt()}
      />
      <FilterBar />
      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* 1. North Star (4 cards) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCardFrom kpi={kpis.otdMidMile} />
        <KpiCardFrom kpi={kpis.costPerParcel} />
        <KpiCardFrom kpi={kpis.fillRate} />
        <KpiCardFrom kpi={kpis.onTimeCutOff} />
      </section>

      {/* 2. Ops Scorecard tuần (W20 vs WTD) */}
      <Card
        title="Bảng điểm vận hành tuần"
        subtitle="W20 (tuần đã hoàn thành) ↔ WTD (tuần hiện tại tới hôm nay). Δ = WTD − W20."
      >
        <DataTable<OpsScorecardRow>
          rowKey={(r) => r.key}
          data={scorecard}
          columns={[
            { key: "label", label: "Chỉ số", sortable: true },
            {
              key: "w20Value",
              label: "W20",
              align: "right",
              sortable: true,
              sortValue: (r) => r.w20Value,
              render: (r) => <span className="tabular-nums">{formatPct(r.w20Value)}</span>,
            },
            {
              key: "wtdValue",
              label: "WTD",
              align: "right",
              sortable: true,
              sortValue: (r) => r.wtdValue,
              render: (r) => (
                <span className="tabular-nums font-medium flex items-center justify-end gap-1.5">
                  <StatusDot status={r.status} size={6} />
                  {formatPct(r.wtdValue)}
                </span>
              ),
            },
            {
              key: "deltaPp",
              label: "Δ vs W20",
              align: "right",
              sortable: true,
              sortValue: (r) => r.deltaPp,
              render: (r) => {
                const neutral = Math.abs(r.deltaPp) < 0.005;
                const improving =
                  r.direction === "higher-better" ? r.deltaPp >= 0 : r.deltaPp <= 0;
                return (
                  <span
                    className={cn(
                      "tabular-nums font-medium",
                      neutral ? "text-gray-500" : improving ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {formatDelta(r.deltaPp, 2)}
                  </span>
                );
              },
            },
            {
              key: "target",
              label: "Mục tiêu",
              align: "right",
              render: (r) => (
                <span className="text-gray-500 tabular-nums text-xs">
                  {r.direction === "lower-better" ? "≤ " : "≥ "}
                  {formatPct(r.target, 0)}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {/* 3. SLA + Volume */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card
          title="SLA middle-mile + Lead time KTC → KTC"
          subtitle="% đơn middle-mile đúng SLA + phân vị lead time P50/P90/P99 (giờ)."
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                % đơn đúng SLA
              </div>
              <div className="text-3xl font-semibold tabular-nums text-gray-900">
                {formatPct(kpis.otdMidMile.value)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                vs tuần trước · mục tiêu {formatPct(kpis.otdMidMile.target)}
              </div>
            </div>
            <div className="space-y-1.5">
              {[
                { p: "P50", v: lead.p50 },
                { p: "P90", v: lead.p90 },
                { p: "P99", v: lead.p99 },
              ].map(({ p, v }) => (
                <div key={p} className="flex items-center justify-between text-sm">
                  <span className="text-[10px] uppercase tracking-wide text-gray-500">{p}</span>
                  <span className="font-semibold tabular-nums">{formatHours(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card
          title="Volume xử lý / ngày theo loại dịch vụ (30 ngày)"
          subtitle="Stacked theo Express / Freight / B2B."
        >
          <MetricChart<VolumeStack>
            type="stacked-bar"
            data={volume}
            xKey="date"
            height={220}
            series={[
              { key: "standard", label: "Express", color: "#1F2937", stackId: "v" },
              { key: "bulky", label: "Freight", color: "#F97316", stackId: "v" },
              { key: "express", label: "B2B", color: "#DC2626", stackId: "v" },
            ]}
            legend
            xTickFormatter={(d) => formatMMdd(String(d))}
            yTickFormatter={(v) => formatCompactInt(v)}
            tooltipValueFormatter={(v) => `${formatInt(v)} đơn`}
          />
        </Card>
      </section>

      {/* 4. Cost trend + Cost stack */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card
          title="Linehaul cost / order trend vs target (30 ngày)"
          subtitle="Cost actual (line) vs target VND/order."
        >
          <MetricChart<SeriesPoint>
            type="line"
            data={costTrend}
            xKey="date"
            height={220}
            series={[
              { key: "actual", label: "Cost / đơn", color: "#DC2626" },
              { key: "target", label: "Mục tiêu", color: "#10B981" },
            ]}
            legend
            xTickFormatter={(d) => formatMMdd(String(d))}
            yTickFormatter={(v) => formatVND(v, true)}
            tooltipValueFormatter={(v) => formatVND(v)}
          />
        </Card>
        <Card
          title="Cấu trúc chi phí linehaul theo loại dịch vụ (30 ngày)"
          subtitle="Phân bổ chi phí giữa Express / Freight / B2B."
        >
          <MetricChart<CostStack>
            type="stacked-bar"
            data={costStack}
            xKey="date"
            height={220}
            series={[
              { key: "standard", label: "Express", color: "#1F2937", stackId: "c" },
              { key: "bulky", label: "Freight", color: "#F97316", stackId: "c" },
              { key: "express", label: "B2B", color: "#DC2626", stackId: "c" },
            ]}
            legend
            xTickFormatter={(d) => formatMMdd(String(d))}
            yTickFormatter={(v) => formatVND(v, true)}
            tooltipValueFormatter={(v) => formatVND(v)}
          />
        </Card>
      </section>

      {/* 4b. Cost by category — donut */}
      <Card
        title="Cơ cấu chi phí linehaul theo hạng mục"
        subtitle="Tỷ trọng 30 ngày qua 5 hạng mục: đối tác · nhiên liệu · lương · cầu đường · thuê xe tải."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <Donut
              data={costByCategory.rows.map((r) => ({
                key: r.key,
                label: r.label,
                value: r.amount,
                color: r.color,
              }))}
              height={240}
              innerRadius={62}
              outerRadius={98}
              valueFormatter={(v) => formatVND(v)}
              centerLabel={
                <>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500">
                    Tổng 30 ngày
                  </div>
                  <div className="text-lg font-semibold tabular-nums text-gray-900">
                    {formatVND(costByCategory.total, true)}
                  </div>
                </>
              }
            />
          </div>
          <div>
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md">
              {costByCategory.rows
                .slice()
                .sort((a, b) => b.share - a.share)
                .map((r) => (
                  <li
                    key={r.key}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="text-sm text-gray-900 truncate">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums shrink-0">
                      <span className="text-xs text-gray-500">{formatVND(r.amount, true)}</span>
                      <span className="text-sm font-semibold text-gray-900 w-14 text-right">
                        {formatPct(r.share * 100, 1)}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* 5. Productivity row */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCardFrom kpi={network.fillRate} size="sm" hint="Trung bình toàn mạng" />
        <KpiCardFrom kpi={network.emptyBackhaul} size="sm" hint="% chuyến rỗng chiều về" />
        <KpiCardFrom kpi={network.costPerKg} size="sm" />
      </section>

      {/* 6. Quality table */}
      <Card title="Chất lượng vận hành" subtitle="4 chỉ số chất lượng then chốt — sort hoặc click status để drill.">
        <DataTable<QualityRow>
          rowKey={(r) => r.label}
          data={quality}
          columns={[
            { key: "label", label: "Chỉ số", sortable: true },
            {
              key: "value",
              label: "Giá trị",
              align: "right",
              sortable: true,
              sortValue: (r) => r.value,
              render: (r) => formatValue(r.value, r.unit),
            },
            {
              key: "deltaPct",
              label: "Δ vs tuần trước",
              align: "right",
              sortable: true,
              sortValue: (r) => r.deltaPct,
              render: (r) => (
                <span className={r.deltaPct < 0 ? "text-emerald-600" : "text-red-600"}>
                  {formatDelta(r.deltaPct)}
                </span>
              ),
            },
            {
              key: "status",
              label: "Trạng thái",
              align: "right",
              render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div>,
            },
          ]}
        />
      </Card>

      {/* 7. Pipeline health heatmap (signature) */}
      <Card
        title="Sức khoẻ pipeline middle-mile (signature)"
        subtitle="Cross-tab module × top 5 Tỉnh — click ô để drill xuống module page."
        actions={
          <button
            type="button"
            onClick={() => setPage("network")}
            className="text-xs font-medium text-red-600 hover:underline inline-flex items-center gap-1"
          >
            Xem Mạng lưới <ArrowRight className="w-3 h-3" />
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th className="text-left text-[11px] uppercase tracking-wide text-gray-500 font-medium px-3 py-2">Module / Tỉnh</th>
                {pipeline[0]?.regionTotals.map((r) => (
                  <th key={r.region} className="text-center text-[11px] uppercase tracking-wide text-gray-500 font-medium px-3 py-2">
                    {r.region}
                  </th>
                ))}
                <th className="text-center text-[11px] uppercase tracking-wide text-gray-500 font-medium px-3 py-2">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.map((row) => (
                <tr key={row.module} className="border-t border-gray-100">
                  <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{row.module}</td>
                  {row.regionTotals.map((r) => {
                    // Find province code for drill
                    const provCode = PROVINCES.find((p) => p.name === r.region)?.code;
                    return (
                      <td
                        key={r.region}
                        className={cn(
                          "px-3 py-2.5 text-center text-sm tabular-nums cursor-pointer",
                          HEATMAP_BG[r.status],
                        )}
                        onClick={() => {
                          setFilter({ provinceCode: provCode });
                          setPage(row.module === "ORS" ? "routing" : "network");
                        }}
                      >
                        {formatPct(r.value)}
                      </td>
                    );
                  })}
                  <td className={cn("px-3 py-2.5 text-center text-sm font-medium tabular-nums", HEATMAP_BG[row.totalStatus])}>
                    {formatPct(row.totalValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---- Journey page ---------------------------------------------------------

function JourneyPage() {
  const { filter } = useFilter();
  const { setPage } = useNav();
  const stages = getJourneyOverview(filter);
  const anomalies = getJourneyAnomalies(filter);
  const pickup = getPickupKpis(filter);
  const bcNhan = getBcNhanKpis(filter);
  const bcGiao = getBcGiaoKpis(filter);
  const bcHoan = getBcHoanKpis(filter);
  const network = getNetworkKpis(filter);
  const ktcs = getKtcStatus(filter);
  const topUnderperformer =
    ktcs.slice().sort((a, b) => b.tatHours - a.tatHours).find((k) => k.status !== "green")?.ktcName ?? "—";

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", key: "overall" }, { label: "Hành trình đơn hàng" }]}
        title="Hành trình đơn hàng — drill down theo 5 chặng"
        subtitle="Từ lúc nhận đến khi giao thành công (hoặc hoàn)."
        updatedAt={dataUpdatedAt()}
      />
      <FilterBar />
      <Card title="Tổng quan hành trình" subtitle="Status + tỷ lệ pass + throughput mỗi chặng.">
        <JourneyFlow stages={stages} />
      </Card>
      {anomalies.length > 0 && <AlertBanner alerts={anomalies} />}

      {/* Stage 1: Pickup */}
      <StageHeader step={1} label="Nhận hàng — Pickup" tone="green" description="Người gửi mang đến BC hoặc NVPTTT đi nhận tại địa chỉ." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={pickup.successRate} size="sm" />
        <KpiCardFrom kpi={pickup.cancelRate} size="sm" />
        <KpiCardFrom kpi={pickup.lateRate} size="sm" />
        <KpiCardFrom kpi={pickup.avgTatMin} size="sm" hint="Từ lúc yêu cầu → nhập BC" />
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card title="Funnel pickup hôm nay" subtitle="Yêu cầu pickup → NVPTTT đến → Lấy thành công → Nhập BC nhận.">
            <Funnel steps={getJourneyFunnel(filter, "pickup")} />
          </Card>
        </div>
        <Card title="Phân bổ kênh pickup" subtitle="Tỷ trọng pickup tại nhà vs mang tới BC.">
          <div className="space-y-3">
            {[
              { label: "NVPTTT đến địa chỉ người gửi", pct: 62, color: "#F97316" },
              { label: "Người gửi mang đến BC", pct: 38, color: "#1F2937" },
            ].map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-900">{c.label}</span>
                  <span className="font-semibold tabular-nums">{c.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            Pickup tại nhà chiếm phần lớn — TAT trung bình +12 phút vs mang tới BC.
          </div>
        </Card>
      </div>

      {/* Stage 2: BC nhận */}
      <StageHeader step={2} label="Bưu cục nhận: xử lý & phân kiện" tone="blue" description="Tạo & bắn đơn → phân loại → đóng kiện → xuất KTC/BC giao." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={bcNhan.wrongCodeRate} size="sm" />
        <KpiCardFrom kpi={bcNhan.wrongPackageRate} size="sm" />
        <KpiCardFrom kpi={bcNhan.missingMvdRate} size="sm" />
        <KpiCardFrom kpi={bcNhan.processingTatMin} size="sm" hint="Tạo đơn → xuất kiện" />
      </section>
      <Card title="Funnel xử lý tại BC nhận">
        <Funnel steps={getJourneyFunnel(filter, "bcNhan")} />
      </Card>

      {/* Stage 3: KTC */}
      <StageHeader step={3} label="Kho trung chuyển (KTC)" tone="violet" description="Nhập · kiểm seal · phân loại · đóng kiện · xuất tiếp." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={network.sortAccuracy} size="sm" />
        <KpiCardFrom kpi={network.tatHub} size="sm" />
        <KpiCardFrom kpi={network.missortRate} size="sm" />
        <KpiCardFrom kpi={network.overstayRate} size="sm" />
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card title="Funnel overstay KTC hôm nay">
            <Funnel steps={getJourneyFunnel(filter, "ktc")} />
          </Card>
        </div>
        <Card title="KTC cần chú ý nhất" subtitle="Underperform xa nhất theo TAT + sort accuracy.">
          <div className="space-y-2">
            <div className="text-xl font-semibold text-gray-900">{topUnderperformer}</div>
            <button
              type="button"
              onClick={() => setPage("network")}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
            >
              Drill xuống Mạng lưới <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </Card>
      </div>

      {/* Stage 4: BC giao */}
      <StageHeader step={4} label="Bưu cục giao: last-mile" tone="amber" description="Phân tuyến · NVBC giao. ✓ GTC · ~ GT1P · × GTB (>3 lần → chuyển hoàn)." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={bcGiao.gtcRate} size="sm" hint="Giao thành công" />
        <KpiCardFrom kpi={bcGiao.gt1pRate} size="sm" hint="Giao 1 phần" />
        <KpiCardFrom kpi={bcGiao.gtbRate} size="sm" hint="Giao thất bại" />
        <KpiCardFrom kpi={bcGiao.lostRate} size="sm" hint="Thất lạc" />
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card title="Funnel last-mile hôm nay">
            <Funnel steps={getJourneyFunnel(filter, "bcGiao")} />
          </Card>
        </div>
        <Card title="COD hôm nay" subtitle="Tiền thu hộ — tổng & phần chưa nộp lại.">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Đã thu</div>
              <div className="text-2xl font-semibold tabular-nums text-gray-900">
                {formatVND(bcGiao.codCollected, true)}
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Chưa nộp lại</div>
              <div className="text-xl font-semibold tabular-nums text-gray-900">
                {formatVND(bcGiao.codPendingDeposit, true)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Stage 5: BC hoàn */}
      <StageHeader step={5} label="Bưu cục hoàn: hoàn trả" tone="rose" description="GTB >3 lần hoặc yêu cầu hoàn → NVBC hoàn cho người gửi." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={bcHoan.returnSuccessRate} size="sm" />
        <KpiCardFrom kpi={bcHoan.returnFailRate} size="sm" />
        <KpiCardFrom kpi={bcHoan.avgReturnDays} size="sm" hint="GTB → trả người gửi" />
        <KpiCardFrom kpi={bcHoan.storedRate} size="sm" hint="Lưu kho quá hạn" />
      </section>
      <Card title="Funnel hoàn trả">
        <Funnel steps={getJourneyFunnel(filter, "bcHoan")} />
      </Card>
    </div>
  );
}

// ---- Routing page (ORS) --------------------------------------------------

function RoutingPage() {
  const { filter } = useFilter();
  const k = getRoutingKpis(filter);
  const alerts = getRoutingAlerts(filter);
  const trend = getRoutingAccuracy24h(filter);
  const hist = getLatencyHistogram(filter);
  const breakdown = getServiceBreakdown(filter);
  const coverage = getServiceCoverage(filter);
  const rows = getMisRouteRows(filter, 20);

  const improving = (deltaPct: number, dir: KpiDirection) =>
    dir === "higher-better" ? deltaPct >= 0 : deltaPct <= 0;
  const dColor = (deltaPct: number, dir: KpiDirection) =>
    Math.abs(deltaPct) < 0.05
      ? "text-gray-500"
      : improving(deltaPct, dir)
        ? "text-emerald-600"
        : "text-red-600";

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", key: "overall" }, { label: "Định tuyến (ORS)" }]}
        title="Định tuyến đơn — drill down theo hành trình"
        subtitle="ORS quyết định ĐI ĐÂU ở 3 điểm: tại BC nhận khi tạo đơn, tại KTC khi sort, tại BC giao khi phân tuyến."
        updatedAt={dataUpdatedAt()}
      />
      <FilterBar />
      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* North Star */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCardFrom kpi={k.routingAccuracy} />
        <KpiCardFrom kpi={k.misRouteRate} />
        <div className="border border-gray-200 rounded-md bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 truncate">
              Latency định tuyến (P95)
            </div>
            <StatusDot status={k.latencyP95.status} />
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 tabular-nums">
            <div className="text-3xl font-semibold text-gray-900">{formatMs(k.latencyP95.value)}</div>
            <div className="text-xs text-gray-500 truncate">mục tiêu {formatMs(k.latencyP95.target)}</div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className={cn("inline-flex items-center gap-0.5 text-xs font-medium tabular-nums", dColor(k.latencyP95.deltaPct, k.latencyP95.direction))}>
              {Math.abs(k.latencyP95.deltaPct) < 0.05 ? <Minus className="w-3 h-3" /> : k.latencyP95.deltaPct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {formatDelta(k.latencyP95.deltaPct)}
            </div>
            <Sparkline data={k.latencyP95.sparkline} status={k.latencyP95.status} />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <StatusDot status={k.latencyP50.status} size={6} />
                <span className="text-[10px] uppercase tracking-wide text-gray-500">P50</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatMs(k.latencyP50.value)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <StatusDot status={k.latencyP99.status} size={6} />
                <span className="text-[10px] uppercase tracking-wide text-gray-500">P99</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatMs(k.latencyP99.value)}</span>
            </div>
          </div>
        </div>
        <KpiCardFrom kpi={k.hubAssignSuccess} />
      </section>

      {/* Stage 1-2 */}
      <StageHeader step="1–2" label="Định tuyến tại Bưu cục nhận" tone="green" description="ORS fires khi tạo đơn. Phát hiện mis-route tại đây sớm nhất." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={k.routingAccuracy} size="sm" />
        <KpiCardFrom kpi={k.misRouteRate} size="sm" />
        <KpiCardFrom kpi={k.reRouteRate} size="sm" hint="Đơn phải re-route sau initial" />
        <KpiCardFrom kpi={k.addressErrorRate} size="sm" />
      </section>
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card title="Routing accuracy 24h gần nhất" subtitle="Phát hiện spike lỗi vào giờ peak (8–11h, 14–17h).">
            <MetricChart<TimePoint>
              type="line"
              data={trend}
              xKey="date"
              height={240}
              series={[{ key: "value", label: "Accuracy %", color: "#DC2626" }]}
              xTickFormatter={(d) => String(d)}
              yTickFormatter={(v) => `${v.toFixed(1)}%`}
              tooltipValueFormatter={(v) => formatPct(v)}
            />
          </Card>
        </div>
        <Card title="Coverage theo loại dịch vụ">
          <div className="space-y-2.5">
            {coverage.map((c) => (
              <div key={c.serviceType}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-900">{SERVICE_LABEL_VI[c.serviceType]}</span>
                  <span className="font-semibold tabular-nums">{formatPct(c.coveredPct)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-300",
                      c.coveredPct >= 98 ? "bg-emerald-500" : c.coveredPct >= 90 ? "bg-amber-500" : "bg-red-500",
                    )}
                    style={{ width: `${Math.min(100, c.coveredPct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <Card title="Mis-route theo loại dịch vụ" subtitle="So sánh Express / Freight / B2B.">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {breakdown.map((b) => {
            const status: Status = b.misRoutePct <= 1 ? "green" : b.misRoutePct <= 2 ? "amber" : "red";
            return (
              <div key={b.serviceType} className="border border-gray-200 rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{SERVICE_LABEL_VI[b.serviceType]}</span>
                  <StatusBadge status={status} />
                </div>
                <div className="text-3xl font-semibold tabular-nums text-gray-900">{formatPct(b.misRoutePct)}</div>
                <div className="mt-1 text-xs text-gray-500 tabular-nums">
                  {formatCompactInt(b.misRouteCount)} đơn lỗi / {formatCompactInt(b.totalCount)} đơn
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Top 20 đơn mis-route gần nhất">
        <DataTable<MisRouteRow>
          rowKey={(r) => r.mvd}
          data={rows}
          searchable
          searchPlaceholder="Tìm MVĐ, Tỉnh, lý do..."
          columns={[
            { key: "mvd", label: "MVĐ", width: 140, sortable: true, render: (r) => <span className="font-mono text-xs">{r.mvd}</span> },
            { key: "createdAt", label: "Thời gian tạo", width: 150, sortable: true },
            { key: "senderProvince", label: "Gửi (Tỉnh)", sortable: true },
            { key: "receiverProvince", label: "Nhận (Tỉnh)", sortable: true },
            { key: "serviceType", label: "Dịch vụ", sortable: true, render: (r) => SERVICE_LABEL_VI[r.serviceType] },
            { key: "predictedKtc", label: "BC dự đoán", className: "text-gray-500" },
            { key: "actualKtc", label: "BC thực tế", render: (r) => <span className="font-medium">{r.actualKtc}</span> },
            { key: "reason", label: "Lý do", render: (r) => <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{r.reason}</span> },
          ]}
        />
      </Card>

      {/* Stage 3 */}
      <StageHeader step="3" label="Sort routing tại KTC" tone="violet" description="Quyết định chuyển đơn tới KTC tiếp hay BC giao. Cross-dock tốt = ít overstay." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={k.sortRoutingAccuracy} size="sm" />
        <KpiCardFrom kpi={k.crossDockRate} size="sm" hint="% đơn không qua đêm" />
        <KpiCardFrom kpi={k.fallbackRate} size="sm" />
        <div className="border border-gray-200 rounded-md bg-white p-3">
          <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">Cross-dock vs overnight</div>
          <div className="space-y-2">
            {[
              { label: "Cross-dock (qua trong ngày)", pct: k.crossDockRate.value, color: "#10B981" },
              { label: "Overnight tại KTC", pct: Math.max(0, 100 - k.crossDockRate.value), color: "#F59E0B" },
            ].map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-gray-900 truncate">{b.label}</span>
                  <span className="font-semibold tabular-nums">{b.pct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, b.pct)}%`, backgroundColor: b.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stage 4 */}
      <StageHeader step="4" label="Phân tuyến last-mile tại Bưu cục giao" tone="amber" description="Gán đơn vào tuyến NVBC. Mục tiêu: đủ tuyến, đúng tuyến, throughput cao." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={k.tuyenAssignAccuracy} size="sm" />
        <KpiCardFrom kpi={k.ordersPerTuyen} size="sm" />
        <KpiCardFrom kpi={k.hubAssignSuccess} size="sm" />
        <KpiCardFrom kpi={k.fallbackRate} size="sm" />
      </section>

      {/* System health */}
      <StageHeader step="Sys" label="Hiệu năng hệ thống ORS" tone="slate" description="Latency end-to-end của request routing. P95 < 200ms = không block tạo đơn." />
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card title="Phân phối latency request">
          <MetricChart<HistogramBucket>
            type="bar"
            data={hist}
            xKey="bucket"
            height={240}
            series={[{ key: "count", label: "Số request", color: "#F97316" }]}
            xTickFormatter={(d) => String(d)}
            yTickFormatter={(v) => formatCompactInt(v)}
            tooltipValueFormatter={(v) => formatInt(v)}
          />
        </Card>
        <Card title="Routing accuracy 24h">
          <MetricChart<TimePoint>
            type="line"
            data={trend}
            xKey="date"
            height={240}
            series={[{ key: "value", label: "Accuracy %", color: "#DC2626" }]}
            xTickFormatter={(d) => String(d)}
            yTickFormatter={(v) => `${v.toFixed(1)}%`}
            tooltipValueFormatter={(v) => formatPct(v)}
          />
        </Card>
      </section>
    </div>
  );
}

// ---- Network page --------------------------------------------------------

function NetworkPage() {
  const { filter } = useFilter();
  const { lanePerf: uploadedLanes, ktcStatus: uploadedKtcs } = useUpload();
  const k = getNetworkKpis(filter);
  const alerts = getNetworkAlerts(filter);
  const forecast = getVolumeForecast(filter, 30);
  const mape = getForecastMapeTrend(filter, 12);
  const heatmap = getCutOffHeatmap(filter);
  const funnel = getKtcOverstayFunnel(filter);
  const lanes = uploadedLanes ?? getLanePerf(filter);
  const ktcs = uploadedKtcs ?? getKtcStatus(filter);

  const regionLabel: Record<RegionCode, string> = { bac: "Bắc", trung: "Trung", nam: "Nam" };
  const worstOnTime = (() => {
    const xs = [k.onTimeDeparture.status, k.onTimeArrival.status];
    if (xs.includes("red")) return "red" as Status;
    if (xs.includes("amber")) return "amber" as Status;
    return "green" as Status;
  })();
  const totalActual = forecast.reduce((a, b) => a + b.actual, 0);
  const totalForecast = forecast.reduce((a, b) => a + (b.forecast ?? 0), 0);
  const drift = totalForecast === 0 ? 0 : ((totalActual - totalForecast) / totalForecast) * 100;
  const latestMape = mape[mape.length - 1]?.value ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", key: "overall" }, { label: "Mạng lưới (NDS + KTC)" }]}
        title="Mạng lưới linehaul — drill down theo 3 chặng"
        subtitle="BC nhận → KTC → KTC ↔ KTC → KTC → BC giao."
        updatedAt={dataUpdatedAt()}
      />
      <FilterBar show={{ region: true, province: true, ktc: true, lane: true, service: true, granularity: true }} />
      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* North Star */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiCardFrom kpi={k.fillRate} />
        <KpiCardFrom kpi={k.onTimeCutOff} />
        <KpiCardFrom kpi={k.costPerOrder} />
        <KpiCardFrom kpi={k.sortAccuracy} />
        <div className="border border-gray-200 rounded-md bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 truncate">
              On-time departure / arrival
            </div>
            <StatusDot status={worstOnTime} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            {[
              { label: "Xuất kho", kpi: k.onTimeDeparture },
              { label: "Đến nơi", kpi: k.onTimeArrival },
            ].map((d) => (
              <div key={d.label}>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{d.label}</div>
                <div className="mt-0.5 text-2xl font-semibold tabular-nums text-gray-900">{formatPct(d.kpi.value)}</div>
                <div className="mt-1.5">
                  <Sparkline data={d.kpi.sparkline} status={d.kpi.status} width={120} height={22} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chặng 1 */}
      <StageHeader step="1" label="Chặng 1: BC nhận → KTC (first leg)" tone="green" description="Đơn rời BC nhận, đi xe tải lên KTC gần nhất." />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCardFrom kpi={k.firstLegOnTime} size="sm" />
        <KpiCardFrom kpi={k.firstLegFill} size="sm" />
        <KpiCardFrom kpi={k.firstLegLeadTime} size="sm" hint="Trung bình toàn mạng" />
      </section>

      {/* Chặng 2 */}
      <StageHeader step="2" label="Chặng 2: KTC ↔ KTC (inter-KTC linehaul)" tone="violet" description="Nhập KTC → kiểm seal → phân loại → đóng kiện → xuất tiếp." />
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={k.tatHub} size="sm" hint="Turn-around time" />
        <KpiCardFrom kpi={k.forecastMape} size="sm" hint="MAPE" />
        <KpiCardFrom kpi={k.missortRate} size="sm" />
        <KpiCardFrom kpi={k.overstayRate} size="sm" />
      </section>
      <Card title="Cut-off compliance heatmap" subtitle="% manifest đúng cut-off, mỗi KTC × khung giờ. Đỏ = COT < 90%.">
        <Heatmap data={heatmap} valueFormat={(v) => formatPct(v)} rowLabel="KTC" colLabel="Khung giờ" />
      </Card>
      <section className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-2">
          <Card title="KTC overstay funnel" subtitle="Nhập → sort → đóng kiện → xuất.">
            <Funnel steps={funnel} />
          </Card>
        </div>
        <div className="xl:col-span-3">
          <Card title="Lane performance — Top 20 theo volume">
            <DataTable<LanePerfRow>
              rowKey={(r) => r.laneCode}
              data={lanes}
              searchable
              searchPlaceholder="Tìm lane..."
              pageSize={10}
              columns={[
                { key: "laneName", label: "Lane", sortable: true, render: (r) => <span className="truncate">{r.laneName}</span> },
                { key: "volume", label: "Volume", align: "right", sortable: true, sortValue: (r) => r.volume, render: (r) => formatCompactInt(r.volume) },
                {
                  key: "fillRate", label: "Fill rate", align: "right", sortable: true, sortValue: (r) => r.fillRate,
                  render: (r) => (
                    <span className={r.fillRate >= 80 ? "text-emerald-600" : r.fillRate >= 70 ? "text-amber-600" : "text-red-600"}>
                      {formatPct(r.fillRate)}
                    </span>
                  ),
                },
                { key: "costPerKg", label: "Cost/kg", align: "right", sortable: true, sortValue: (r) => r.costPerKg, render: (r) => formatVND(r.costPerKg) },
                { key: "onTimeDeparture", label: "OT dep", align: "right", sortable: true, sortValue: (r) => r.onTimeDeparture, render: (r) => formatPct(r.onTimeDeparture) },
                { key: "onTimeArrival", label: "OT arr", align: "right", sortable: true, sortValue: (r) => r.onTimeArrival, render: (r) => formatPct(r.onTimeArrival) },
                { key: "missortRate", label: "% missort", align: "right", sortable: true, sortValue: (r) => r.missortRate, render: (r) => formatPct(r.missortRate) },
                { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
              ]}
            />
          </Card>
        </div>
      </section>

      {/* Chặng 3 */}
      <StageHeader step="3" label="Chặng 3: KTC → BC giao (last linehaul leg)" tone="amber" description="Đơn rời KTC cuối cùng, về BC giao để giao last-mile." />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCardFrom kpi={k.lastLegOnTime} size="sm" />
        <KpiCardFrom kpi={k.lastLegFill} size="sm" />
        <KpiCardFrom kpi={k.lastLegLeadTime} size="sm" hint="Trung bình toàn mạng" />
      </section>

      {/* Cross-cutting: forecast + cost */}
      <StageHeader step="X" label="Cross-cutting: Forecast & chi phí" tone="slate" />
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card
            title="Volume forecast vs thực tế (30 ngày)"
            subtitle="NDS forecast vs actual. Drift > 10% = cần điều chỉnh lane planning."
            actions={
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">Drift 30 ngày</div>
                <div className={cn("text-lg font-semibold tabular-nums", Math.abs(drift) <= 5 ? "text-emerald-600" : Math.abs(drift) <= 10 ? "text-amber-600" : "text-red-600")}>
                  {drift >= 0 ? "+" : ""}{drift.toFixed(1)}%
                </div>
              </div>
            }
          >
            <MetricChart<SeriesPoint>
              type="combo"
              data={forecast}
              xKey="date"
              height={260}
              series={[
                { key: "actual", label: "Thực tế", color: "#F97316", type: "bar" },
                { key: "forecast", label: "Forecast", color: "#1F2937", type: "line" },
              ]}
              legend
              xTickFormatter={(d) => formatMMdd(String(d))}
              yTickFormatter={(v) => formatCompactInt(v)}
              tooltipValueFormatter={(v) => `${formatInt(v)} đơn`}
            />
          </Card>
        </div>
        <Card
          title="Forecast accuracy (MAPE) theo tuần"
          subtitle="Mục tiêu < 10%."
          actions={
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-gray-500">Tuần này</div>
              <div className={cn("text-lg font-semibold tabular-nums", latestMape <= 10 ? "text-emerald-600" : latestMape <= 15 ? "text-amber-600" : "text-red-600")}>
                {formatPct(latestMape)}
              </div>
            </div>
          }
        >
          <MetricChart<TimePoint>
            type="line"
            data={mape}
            xKey="date"
            height={260}
            series={[{ key: "value", label: "MAPE", color: "#DC2626" }]}
            xTickFormatter={(d) => formatMMdd(String(d))}
            yTickFormatter={(v) => `${v.toFixed(1)}%`}
            tooltipValueFormatter={(v) => formatPct(v)}
          />
        </Card>
      </section>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCardFrom kpi={k.costPerKg} size="sm" />
        <KpiCardFrom kpi={k.emptyBackhaul} size="sm" hint="Chuyến rỗng chiều về" />
        <KpiCardFrom kpi={k.costPerOrder} size="sm" />
      </section>

      {/* Live KTC */}
      <StageHeader step="Live" label="Trạng thái KTC realtime" tone="rose" description={`Snapshot ${ktcs.length} KTC. Filter để xem theo vùng.`} />
      <Card title="Trạng thái KTC realtime">
        <DataTable<KtcStatusRow>
          rowKey={(r) => r.ktcCode}
          data={ktcs}
          searchable
          searchPlaceholder="Tìm KTC, vùng..."
          pageSize={10}
          columns={[
            { key: "ktcName", label: "KTC", sortable: true, render: (r) => (
              <div className="flex items-center gap-2">
                <StatusDot status={r.status} size={6} />
                <span>{r.ktcName}</span>
              </div>
            ) },
            { key: "regionCode", label: "Vùng", sortable: true, render: (r) => <span className="text-xs text-gray-500">Miền {regionLabel[r.regionCode]}</span> },
            { key: "processing", label: "Đang xử lý", align: "right", sortable: true, sortValue: (r) => r.processing, render: (r) => formatCompactInt(r.processing) },
            { key: "pendingSort", label: "Chờ sort", align: "right", sortable: true, sortValue: (r) => r.pendingSort, render: (r) => formatCompactInt(r.pendingSort) },
            { key: "readyDispatch", label: "Sẵn sàng xuất", align: "right", sortable: true, sortValue: (r) => r.readyDispatch, render: (r) => formatCompactInt(r.readyDispatch) },
            {
              key: "tatHours", label: "TAT (h)", align: "right", sortable: true, sortValue: (r) => r.tatHours,
              render: (r) => (
                <span className={r.tatHours <= 4 ? "text-emerald-600" : r.tatHours <= 8 ? "text-amber-600" : "text-red-600"}>
                  {formatHours(r.tatHours)}
                </span>
              ),
            },
            { key: "sortAccuracy", label: "Sort acc", align: "right", sortable: true, sortValue: (r) => r.sortAccuracy, render: (r) => formatPct(r.sortAccuracy, 2) },
            { key: "status", label: "Trạng thái", align: "right", render: (r) => <div className="inline-flex"><StatusBadge status={r.status} /></div> },
          ]}
        />
      </Card>
    </div>
  );
}

// ---- Upload page ---------------------------------------------------------

type UploadDatasetKey = "scorecard" | "costByCategory" | "lanePerf" | "ktcStatus";
type DatasetSpec = {
  key: UploadDatasetKey;
  label: string;
  description: string;
  affects: string;
  affectsPage: PageKey;
  columnHints: { name: string; type: string; hint: string }[];
  headers: string[];
  sampleRows: (string | number)[][];
  parse: (csv: string) => { ok: true; rows: unknown[] } | { ok: false; error: string };
};

// Minimal CSV parser (no deps).
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const clean = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"'; i++;
        } else inQ = !inQ;
      } else if (c === "," && !inQ) {
        out.push(cur); cur = "";
      } else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = split(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const vals = split(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (vals[i] ?? "").trim()));
    return obj;
  });
  return { headers, rows };
}
function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}
function downloadCSV(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.style.display = "none";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function toNum(v: string | undefined, field: string): number {
  if (v === undefined || v === "") throw new Error(`Thiếu cột "${field}"`);
  const cleaned = v.replace(/[\s,]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n)) throw new Error(`Cột "${field}" không phải số: "${v}"`);
  return n;
}
function requireHeaders(actual: string[], expected: string[]): string | null {
  const missing = expected.filter((h) => !actual.includes(h));
  return missing.length ? `CSV thiếu cột: ${missing.join(", ")}` : null;
}

const UPLOAD_SPECS: DatasetSpec[] = [
  {
    key: "scorecard",
    label: "Bảng điểm vận hành tuần",
    description: "7 chỉ số ops-native với W20 vs WTD.",
    affects: "Tổng quan → Bảng điểm vận hành tuần",
    affectsPage: "overall",
    columnHints: [
      { name: "key", type: "string", hint: "Định danh nội bộ" },
      { name: "label", type: "string", hint: "Nhãn hiển thị" },
      { name: "w20", type: "number", hint: "Tuần trước (%)" },
      { name: "wtd", type: "number", hint: "Tuần này tới hôm nay (%)" },
      { name: "target", type: "number", hint: "Mục tiêu (%)" },
      { name: "direction", type: "enum", hint: "higher-better | lower-better" },
      { name: "green_at", type: "number", hint: "Ngưỡng xanh" },
      { name: "amber_at", type: "number", hint: "Ngưỡng vàng (đỏ nếu vượt)" },
    ],
    headers: ["key", "label", "w20", "wtd", "target", "direction", "green_at", "amber_at"],
    sampleRows: [
      ["odr", "ODR — On-time Delivery Rate", 93.83, 93.0, 95, "higher-better", 95, 92],
      ["oprCot16h", "OPR (COT 16h)", 95.17, 94.17, 96, "higher-better", 95, 92],
      ["oprNewCot", "OPR (COT 9h–19h)", 77.98, 74.23, 90, "higher-better", 90, 80],
      ["fd", "FD — Failed Delivery", 5.59, 5.35, 4, "lower-better", 4, 6],
      ["late", "% Trễ không xuất tải", 7.5, 7.3, 5, "lower-better", 5, 8],
      ["ontimeTc", "% Ontime trung chuyển (≥4 ca)", 86.3, 86.2, 90, "higher-better", 90, 80],
      ["gtc", "%GTC", 64, 61, 70, "higher-better", 70, 55],
    ],
    parse: (csv) => {
      const { headers, rows } = parseCSV(csv);
      const err = requireHeaders(headers, ["key", "label", "w20", "wtd", "target", "direction", "green_at", "amber_at"]);
      if (err) return { ok: false, error: err };
      const out: OpsScorecardRow[] = [];
      for (const r of rows) {
        try {
          const dir: KpiDirection = r.direction === "lower-better" ? "lower-better" : "higher-better";
          const w20 = toNum(r.w20, "w20");
          const wtd = toNum(r.wtd, "wtd");
          const target = toNum(r.target, "target");
          const greenAt = toNum(r.green_at, "green_at");
          const amberAt = toNum(r.amber_at, "amber_at");
          const status: Status =
            dir === "higher-better"
              ? wtd >= greenAt ? "green" : wtd >= amberAt ? "amber" : "red"
              : wtd <= greenAt ? "green" : wtd <= amberAt ? "amber" : "red";
          out.push({
            key: r.key, label: r.label, w20Value: w20, wtdValue: wtd, target,
            direction: dir, unit: "%", status, deltaPp: round2(wtd - w20),
          });
        } catch { /* skip bad row */ }
      }
      return out.length ? { ok: true, rows: out } : { ok: false, error: "Không có dòng hợp lệ" };
    },
  },
  {
    key: "costByCategory",
    label: "Cơ cấu chi phí theo hạng mục",
    description: "5 hạng mục — donut + breakdown list.",
    affects: "Tổng quan → Cơ cấu chi phí linehaul theo hạng mục",
    affectsPage: "overall",
    columnHints: [
      { name: "key", type: "string", hint: "Định danh" },
      { name: "label", type: "string", hint: "Nhãn" },
      { name: "amount", type: "number", hint: "Tổng VND" },
      { name: "color", type: "hex", hint: "Màu (vd #6B7CB8)" },
    ],
    headers: ["key", "label", "amount", "color"],
    sampleRows: [
      ["partner", "Chi phí đối tác", 4_200_000_000, "#6B7CB8"],
      ["fuel", "Chi phí nhiên liệu", 3_000_000_000, "#EEA060"],
      ["salary", "Chi phí lương", 2_400_000_000, "#84B26A"],
      ["tolls", "Chi phí cầu đường", 1_200_000_000, "#B85850"],
      ["rental", "Chi phí thuê xe tải", 1_200_000_000, "#6F8AAB"],
    ],
    parse: (csv) => {
      const { headers, rows } = parseCSV(csv);
      const err = requireHeaders(headers, ["key", "label", "amount", "color"]);
      if (err) return { ok: false, error: err };
      const interim = rows
        .map((r) => {
          try {
            return { key: r.key, label: r.label, amount: toNum(r.amount, "amount"), color: r.color || "#6B7280" };
          } catch {
            return null;
          }
        })
        .filter((x): x is { key: string; label: string; amount: number; color: string } => x !== null);
      if (!interim.length) return { ok: false, error: "Không có dòng hợp lệ" };
      const total = interim.reduce((a, b) => a + b.amount, 0);
      const out: CostCategoryRow[] = interim.map((c) => ({
        key: c.key, label: c.label, amount: c.amount,
        share: total > 0 ? round2(c.amount / total) : 0, color: c.color,
      }));
      return { ok: true, rows: out };
    },
  },
  {
    key: "lanePerf",
    label: "Hiệu suất lane",
    description: "Top lanes theo volume. Status tự derive.",
    affects: "Mạng lưới → Lane performance",
    affectsPage: "network",
    columnHints: [
      { name: "lane_code", type: "string", hint: "Mã lane" },
      { name: "lane_name", type: "string", hint: "Tên (A → B)" },
      { name: "volume", type: "number", hint: "Đơn/ngày" },
      { name: "fill_rate", type: "number", hint: "%" },
      { name: "cost_per_kg", type: "number", hint: "VND/kg" },
      { name: "on_time_departure", type: "number", hint: "%" },
      { name: "on_time_arrival", type: "number", hint: "%" },
      { name: "missort_rate", type: "number", hint: "%" },
    ],
    headers: ["lane_code", "lane_name", "volume", "fill_rate", "cost_per_kg", "on_time_departure", "on_time_arrival", "missort_rate"],
    sampleRows: [
      ["L-HCM-KTC01-HNI-KTC01", "KTC TP. Hồ Chí Minh 01 → KTC Hà Nội 01", 3200, 82.5, 2150, 94, 91, 0.6],
      ["L-HNI-KTC01-HCM-KTC01", "KTC Hà Nội 01 → KTC TP. Hồ Chí Minh 01", 3100, 78.0, 2280, 92, 89, 0.8],
      ["L-DNG-KTC01-HCM-KTC01", "KTC Đà Nẵng 01 → KTC TP. Hồ Chí Minh 01", 1800, 71.0, 2400, 88, 85, 1.2],
      ["L-BDG-KTC01-HCM-KTC01", "KTC Bình Dương 01 → KTC TP. Hồ Chí Minh 01", 2500, 85.0, 1900, 96, 94, 0.4],
      ["L-HCM-KTC01-DNG-KTC01", "KTC TP. Hồ Chí Minh 01 → KTC Đà Nẵng 01", 1900, 74.0, 2350, 90, 87, 1.1],
    ],
    parse: (csv) => {
      const { headers, rows } = parseCSV(csv);
      const expected = ["lane_code", "lane_name", "volume", "fill_rate", "cost_per_kg", "on_time_departure", "on_time_arrival", "missort_rate"];
      const err = requireHeaders(headers, expected);
      if (err) return { ok: false, error: err };
      const out: LanePerfRow[] = [];
      for (const r of rows) {
        try {
          const fillRate = toNum(r.fill_rate, "fill_rate");
          const onTimeDeparture = toNum(r.on_time_departure, "on_time_departure");
          const onTimeArrival = toNum(r.on_time_arrival, "on_time_arrival");
          const missortRate = toNum(r.missort_rate, "missort_rate");
          out.push({
            laneCode: r.lane_code,
            laneName: r.lane_name,
            volume: toNum(r.volume, "volume"),
            fillRate, costPerKg: toNum(r.cost_per_kg, "cost_per_kg"),
            onTimeDeparture, onTimeArrival, missortRate,
            status: worst(
              statusFromValue(KPI.fillRate, fillRate),
              statusFromValue(KPI.onTimeArrival, onTimeArrival),
              statusFromValue(KPI.missortRate, missortRate),
            ),
          });
        } catch { /* skip */ }
      }
      return out.length ? { ok: true, rows: out } : { ok: false, error: "Không có dòng hợp lệ" };
    },
  },
  {
    key: "ktcStatus",
    label: "Trạng thái KTC realtime",
    description: "Snapshot từng KTC.",
    affects: "Mạng lưới → Trạng thái KTC realtime",
    affectsPage: "network",
    columnHints: [
      { name: "ktc_code", type: "string", hint: "Mã KTC" },
      { name: "ktc_name", type: "string", hint: "Tên KTC" },
      { name: "region_code", type: "enum", hint: "bac | trung | nam" },
      { name: "processing", type: "number", hint: "Đơn đang xử lý" },
      { name: "pending_sort", type: "number", hint: "Đơn chờ sort" },
      { name: "ready_dispatch", type: "number", hint: "Sẵn sàng xuất" },
      { name: "tat_hours", type: "number", hint: "TAT (h)" },
      { name: "sort_accuracy", type: "number", hint: "%" },
    ],
    headers: ["ktc_code", "ktc_name", "region_code", "processing", "pending_sort", "ready_dispatch", "tat_hours", "sort_accuracy"],
    sampleRows: [
      ["HCM-KTC01", "KTC TP. Hồ Chí Minh 01", "nam", 3200, 800, 1200, 4.5, 99.5],
      ["HCM-KTC02", "KTC TP. Hồ Chí Minh 02", "nam", 2800, 700, 1100, 5.0, 99.4],
      ["HNI-KTC01", "KTC Hà Nội 01", "bac", 3000, 750, 1150, 4.8, 99.5],
      ["DNG-KTC01", "KTC Đà Nẵng 01", "trung", 1800, 600, 800, 6.0, 99.0],
      ["BDG-KTC01", "KTC Bình Dương 01", "nam", 2400, 650, 900, 4.6, 99.5],
      ["KHA-KTC01", "KTC Khánh Hoà 01", "trung", 1200, 900, 600, 9.5, 98.6],
    ],
    parse: (csv) => {
      const { headers, rows } = parseCSV(csv);
      const expected = ["ktc_code", "ktc_name", "region_code", "processing", "pending_sort", "ready_dispatch", "tat_hours", "sort_accuracy"];
      const err = requireHeaders(headers, expected);
      if (err) return { ok: false, error: err };
      const out: KtcStatusRow[] = [];
      for (const r of rows) {
        try {
          const region = r.region_code as RegionCode;
          if (!["bac", "trung", "nam"].includes(region)) continue;
          const sortAccuracy = toNum(r.sort_accuracy, "sort_accuracy");
          const tatHours = toNum(r.tat_hours, "tat_hours");
          out.push({
            ktcCode: r.ktc_code, ktcName: r.ktc_name, regionCode: region,
            processing: toNum(r.processing, "processing"),
            pendingSort: toNum(r.pending_sort, "pending_sort"),
            readyDispatch: toNum(r.ready_dispatch, "ready_dispatch"),
            tatHours, sortAccuracy,
            status: worst(
              statusFromValue(KPI.sortAccuracy, sortAccuracy),
              statusFromValue(KPI.tatHub, tatHours),
            ),
          });
        } catch { /* skip */ }
      }
      return out.length ? { ok: true, rows: out } : { ok: false, error: "Không có dòng hợp lệ" };
    },
  },
];

function UploadPage() {
  const upload = useUpload();
  const { setPage } = useNav();
  const uploadedKeys: UploadDatasetKey[] = ["scorecard", "costByCategory", "lanePerf", "ktcStatus"];
  const uploadedCount = uploadedKeys.filter((k) => (upload as unknown as Record<string, unknown>)[k] !== undefined).length;

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", key: "overall" }, { label: "Tải lên dữ liệu" }]}
        title="Tải lên dữ liệu vận hành"
        subtitle="Tải template CSV về, điền số liệu thực tế, upload lại để dashboard hiển thị thay cho mock data."
        updatedAt={dataUpdatedAt()}
      />
      <AlertBanner
        alerts={[
          {
            id: "demo-only",
            severity: "info",
            title: "Demo Artifact: dữ liệu lưu trong React state (không persist khi reload artifact). Bản Next.js dùng localStorage.",
          },
        ]}
      />
      <div className="border border-gray-200 rounded-md bg-white p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">Tình trạng datasets</span>
            <div className="mt-0.5">
              <span className="text-2xl font-semibold tabular-nums text-gray-900">{uploadedCount}</span>
              <span className="ml-1 text-sm text-gray-500">/ 4 đang dùng dữ liệu upload</span>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => uploadedCount > 0 && upload.clearAll()}
            disabled={uploadedCount === 0}
          >
            Xoá tất cả
          </Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {UPLOAD_SPECS.map((s) => {
            const rows = (upload as unknown as Record<string, unknown[]>)[s.key];
            const isUp = rows !== undefined;
            return (
              <div
                key={s.key}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs",
                  isUp ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white",
                )}
              >
                {isUp ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-gray-900">{s.label}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {isUp ? `${formatInt(rows.length)} dòng upload` : "Đang dùng mock"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {UPLOAD_SPECS.map((spec) => (
          <DatasetCard key={spec.key} spec={spec} onView={(p) => setPage(p)} />
        ))}
      </div>
    </div>
  );
}

function DatasetCard({
  spec,
  onView,
}: {
  spec: DatasetSpec;
  onView: (p: PageKey) => void;
}) {
  const upload = useUpload();
  const rows = (upload as unknown as Record<string, unknown[]>)[spec.key];
  const isUp = rows !== undefined;
  const [status, setStatus] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setStatus({ kind: "err", text: "Chỉ chấp nhận file .csv" });
      return;
    }
    try {
      const text = await file.text();
      const result = spec.parse(text);
      if (!result.ok) {
        setStatus({ kind: "err", text: result.error });
        return;
      }
      upload.setData(spec.key as keyof UploadCtxStore, result.rows);
      setStatus({ kind: "ok", text: `Đã nạp ${result.rows.length} dòng` });
      setShowPreview(true);
    } catch (e) {
      setStatus({ kind: "err", text: `Lỗi đọc file: ${(e as Error).message}` });
    }
  }

  return (
    <Card
      title={spec.label}
      subtitle={spec.description}
      actions={
        isUp ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-md">
            <CheckCircle2 className="w-3 h-3" />
            {formatInt(rows.length)} dòng upload
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border border-gray-200 text-gray-500 rounded-md">
            Đang dùng mock
          </span>
        )
      }
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-500">
            <span className="font-medium">Áp dụng vào:</span> {spec.affects}
          </span>
          {isUp && (
            <button
              type="button"
              onClick={() => onView(spec.affectsPage)}
              className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline shrink-0"
            >
              Xem trên dashboard <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0]; if (f) handleFile(f);
          }}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors",
            dragOver ? "border-red-600 bg-red-50" : "border-gray-200 hover:bg-gray-100",
          )}
        >
          <UploadCloud className={cn("w-6 h-6 mx-auto mb-1.5", dragOver ? "text-red-600" : "text-gray-500")} />
          <div className="text-sm font-medium text-gray-900">Kéo thả file CSV vào đây</div>
          <div className="text-xs text-gray-500 mt-0.5">hoặc click để chọn từ máy</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary" size="sm"
            icon={<Download className="w-3.5 h-3.5" />}
            onClick={() => downloadCSV(`ghn-template-${spec.key}.csv`, toCSV(spec.headers, spec.sampleRows))}
          >
            Tải template CSV
          </Button>
          <Button variant="primary" size="sm" icon={<UploadIcon className="w-3.5 h-3.5" />} onClick={() => inputRef.current?.click()}>
            Chọn file
          </Button>
          {isUp && (
            <>
              <Button
                variant="ghost" size="sm"
                icon={showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                onClick={() => setShowPreview((v) => !v)}
              >
                {showPreview ? "Ẩn preview" : "Xem preview"}
              </Button>
              <Button
                variant="ghost" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => { upload.clear(spec.key as keyof UploadCtxStore); setStatus(null); setShowPreview(false); }}
              >
                Xoá upload
              </Button>
            </>
          )}
          <input
            ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </div>

        {status && (
          <div className={cn(
            "flex items-start gap-2 px-3 py-2 text-xs rounded-md border",
            status.kind === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
            status.kind === "warn" ? "bg-amber-50 border-amber-200 text-amber-800" :
            "bg-red-50 border-red-200 text-red-800",
          )}>
            {status.kind === "ok" ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
            <span>{status.text}</span>
          </div>
        )}

        <details className="border border-gray-100 rounded-md">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-900 hover:bg-gray-100 select-none">
            Xem định nghĩa cột ({spec.columnHints.length} cột)
          </summary>
          <table className="w-full text-xs border-t border-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-1.5 text-gray-500 font-medium">Cột</th>
                <th className="text-left px-3 py-1.5 text-gray-500 font-medium">Kiểu</th>
                <th className="text-left px-3 py-1.5 text-gray-500 font-medium">Giải thích</th>
              </tr>
            </thead>
            <tbody>
              {spec.columnHints.map((c) => (
                <tr key={c.name} className="border-t border-gray-100">
                  <td className="px-3 py-1.5 font-mono text-[11px] text-gray-900">{c.name}</td>
                  <td className="px-3 py-1.5 text-gray-500">{c.type}</td>
                  <td className="px-3 py-1.5 text-gray-900">{c.hint}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {isUp && showPreview && rows && rows.length > 0 && (
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-gray-500 bg-gray-50">
              Preview {Math.min(5, rows.length)} / {rows.length} dòng
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(rows[0] as Record<string, unknown>).map((h) => (
                      <th key={h} className="text-left px-3 py-1.5 text-gray-500 font-medium border-t border-gray-100">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(rows as Record<string, unknown>[]).slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {Object.keys(rows[0] as Record<string, unknown>).map((h) => {
                        const v = r[h];
                        return (
                          <td key={h} className="px-3 py-1.5 text-gray-900 tabular-nums whitespace-nowrap">
                            {v === null || v === undefined || v === "" ? "-" : typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// =============================================================================
// 12. ROOT APP
// =============================================================================

export default function App() {
  const [page, setPage] = useState<PageKey>("overall");
  const [anchor, setAnchor] = useState<string | null>(null);
  const nav = useMemo(() => ({ page, setPage, anchor, setAnchor }), [page, anchor]);

  return (
    <NavContext.Provider value={nav}>
      <FilterProvider>
        <UploadProvider>
          <div className="min-h-screen flex flex-col bg-white text-gray-900" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
            <TopBar />
            <div className="flex flex-1 min-h-0">
              <Sidebar />
              <main className="flex-1 min-w-0 p-6 overflow-x-hidden">
                {page === "overall" && <OverallPage />}
                {page === "journey" && <JourneyPage />}
                {page === "routing" && <RoutingPage />}
                {page === "network" && <NetworkPage />}
                {page === "upload" && <UploadPage />}
              </main>
            </div>
          </div>
        </UploadProvider>
      </FilterProvider>
    </NavContext.Provider>
  );
}
