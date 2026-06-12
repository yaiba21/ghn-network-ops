// Core domain types for GHN Network Ops dashboard.
// Function signatures using these mirror the future real API surface
// so swapping mock → fetch is a 1:1 replacement.

export type Status = "green" | "amber" | "red";

export type RegionCode = "bac" | "trung" | "nam";

export type ServiceType = "standard" | "bulky" | "express";

export const SERVICE_LABEL_VI: Record<ServiceType, string> = {
  standard: "Express",
  bulky: "Freight",
  express: "B2B",
};

export type Region = {
  code: RegionCode;
  name: string;
};

export type Province = {
  code: string;
  name: string;
  regionCode: RegionCode;
};

export type District = {
  code: string;
  name: string;
  provinceCode: string;
};

export type Ward = {
  code: string;
  name: string;
  districtCode: string;
};

export type Ktc = {
  code: string;
  name: string;
  regionCode: RegionCode;
  provinceCode: string;
  tier: "primary" | "secondary";
};

export type LaneCategory = "intra" | "inter" | "express";

export type Lane = {
  code: string;
  name: string;
  originKtc: string;
  destKtc: string;
  originRegion: RegionCode;
  destRegion: RegionCode;
  distanceKm: number;
  category: LaneCategory;
};

export type VehicleType = "truck" | "container" | "van";
export type Carrier = "internal" | "tpl-a" | "tpl-b" | "tpl-c";

// --- Filter state --------------------------------------------------------

export type TimePreset = "today" | "week" | "month" | "custom";
export type Granularity = "daily" | "weekly" | "monthly";

export type FilterState = {
  preset: TimePreset;
  from: string; // ISO date (yyyy-MM-dd)
  to: string;
  granularity: Granularity;
  regionCode?: RegionCode | "all";
  provinceCode?: string;
  districtCode?: string;
  wardCode?: string;
  serviceTypes: ServiceType[];
  ktcCode?: string;
  laneCode?: string;
  vehicleType?: VehicleType | "all";
  carrier?: Carrier | "all";
};

// --- KPI shape -----------------------------------------------------------

export type KpiUnit =
  | "%"
  | "VND"
  | "ms"
  | "h"
  | "phút"
  | "ngày"
  | "đơn"
  | "kg"
  | "km";
export type KpiDirection = "higher-better" | "lower-better";

export type KpiValue = {
  label: string;
  value: number;
  unit: KpiUnit;
  target: number;
  // Percentage change vs previous comparable period.
  deltaPct: number;
  // Last N daily values used for the sparkline.
  sparkline: number[];
  status: Status;
  direction: KpiDirection;
};

// --- Page-level KPI bundles ---------------------------------------------

export type OverallKpis = {
  otdMidMile: KpiValue;
  costPerParcel: KpiValue;
  fillRate: KpiValue;
  onTimeCutOff: KpiValue;
};

// =======================================================================
// Page 0 — Executive Overview
// =======================================================================

/** 4 North Star big KPI cards. Volume is "đơn", others use their own units. */
export type OverviewBigKpis = {
  otd: KpiValue;
  costPerParcel: KpiValue;
  volume: KpiValue;
  lostRate: KpiValue;
};

/** Module strip — 8 compact health cards. */
export type ModuleHealthItem = {
  key: string;
  module: string;
  /** Short metric label shown under module name. */
  metricLabel: string;
  /** Where to jump when user clicks the card. */
  href: string;
  value: number;
  unit: KpiUnit;
  status: Status;
  direction: KpiDirection;
};

/** 4 trend series for the 2×2 trend panel. */
export type OverviewTrends = {
  otd: SeriesPoint[];
  costPerParcel: SeriesPoint[];
  volume: SeriesPoint[];
  returnRate: SeriesPoint[];
};

/** 3 regional rows used by the Vietnam mini-map + side table. */
export type RegionSnapshotRow = {
  regionCode: RegionCode;
  regionName: string;
  volume: number;
  otdPct: number;
  gtcPct: number;
  costPerParcel: number;
  health: Status;
};

// =======================================================================
// Page 2 — Định tuyến (Routing / ORS)
// =======================================================================

/** OD matrix selectable metric. */
export type OdMetric = "volume" | "misRoutePct" | "leadTimeHours";

/** One row of the routing decision quality stacked bar. */
export type RoutingDecisionRow = {
  serviceType: ServiceType;
  direct: number;     // count đi thẳng (0 hop)
  oneHop: number;     // 1 KTC
  twoHop: number;     // 2 KTC
  threePlus: number;  // 3+ KTC
  matchPct: number;   // % đơn match planned_path
};

/** Re-route trigger breakdown — pie + trend. */
export type ReRouteTriggerRow = {
  reason: string;
  count: number;
  pct: number;
  color: string;
};

/** Province coverage row — choropleth fallback. */
export type ProvinceCoverageRow = {
  provinceCode: string;
  provinceName: string;
  regionCode: RegionCode;
  coveredPct: number;       // % đơn có rule routing chuẩn
  fallbackPct: number;
  totalOrders: number;
  status: Status;
};

// =======================================================================
// Page 1 — Hành trình đơn hàng (Order Journey)
// =======================================================================

/** 6 KPI cards top of Page 1. */
export type OrderJourneyKpis = {
  totalOrders: KpiValue;
  otd: KpiValue;
  avgLeadTime: KpiValue;
  firstAttempt: KpiValue;
  returnRate: KpiValue;
  lostRate: KpiValue;
};

/** Box plot row for "Lead time per stage" — hours. */
export type LeadTimeBox = {
  stage: string;
  p10: number;
  p50: number;
  p90: number;
  p99: number;
  /** Optional outlier dots — same unit as p10/p99. */
  outliers?: number[];
  /** SLA target line for this stage. */
  sla: number;
};

/** Sankey flow edge between two states. */
export type SankeyEdge = {
  source: string;
  target: string;
  value: number;
  isFailure?: boolean;
};

/** Order tracker row. */
export type OrderRow = {
  orderId: string;
  mvd: string;
  shop: string;
  createdAt: string; // ISO datetime
  currentState: string;
  daysInState: number;
  slaStatus: Status;
  /** Hours over/under SLA — negative = under (good). */
  slaDeltaHours: number;
  serviceType: ServiceType;
};

/** Single event in an order's timeline. */
export type OrderTimelineEvent = {
  ts: string;
  state: string;
  node: string;
  /** Planned timestamp for this state if available. */
  plannedTs?: string;
  failureReason?: string;
};

/** Full timeline payload for drill drawer. */
export type OrderTimeline = {
  order: OrderRow;
  events: OrderTimelineEvent[];
  plannedPath: string[];
  actualPath: string[];
};

/** 3 footer gauges: OTD, Volume, Cost progress vs target. */
export type OverviewGauge = {
  key: "otd" | "volume" | "cost";
  label: string;
  value: number;
  target: number;
  unit: KpiUnit;
  /** 0..1, where 1 = on/above target (higher-better) or 1 = at/under target (lower-better). */
  progress: number;
  status: Status;
  direction: KpiDirection;
};

export type RoutingKpis = {
  // Stage 1-2: routing tại BC nhận
  routingAccuracy: KpiValue;
  misRouteRate: KpiValue;
  reRouteRate: KpiValue;
  addressErrorRate: KpiValue;
  // Stage 3: sort routing tại KTC
  sortRoutingAccuracy: KpiValue;
  crossDockRate: KpiValue;
  fallbackRate: KpiValue;
  // Stage 4: phân tuyến last-mile tại BC giao
  hubAssignSuccess: KpiValue;
  tuyenAssignAccuracy: KpiValue;
  ordersPerTuyen: KpiValue;
  // System health
  latencyP50: KpiValue;
  latencyP95: KpiValue;
  latencyP99: KpiValue;
};

export type NetworkKpis = {
  fillRate: KpiValue;
  onTimeCutOff: KpiValue;
  costPerOrder: KpiValue;
  sortAccuracy: KpiValue;
  onTimeDeparture: KpiValue;
  onTimeArrival: KpiValue;
  tatHub: KpiValue;
  forecastMape: KpiValue;
  missortRate: KpiValue;
  overstayRate: KpiValue;
  costPerKg: KpiValue;
  costPerKm: KpiValue;
  emptyBackhaul: KpiValue;
  // Linehaul legs
  firstLegOnTime: KpiValue;
  firstLegFill: KpiValue;
  firstLegLeadTime: KpiValue;
  lastLegOnTime: KpiValue;
  lastLegFill: KpiValue;
  lastLegLeadTime: KpiValue;
};

// --- Series & tabular shapes --------------------------------------------

export type TimePoint = {
  date: string; // ISO
  value: number;
};

export type SeriesPoint = {
  date: string;
  actual: number;
  forecast?: number;
  target?: number;
};

export type VolumeStack = {
  date: string;
  standard: number;
  bulky: number;
  express: number;
};

export type CostStack = {
  date: string;
  standard: number;
  bulky: number;
  express: number;
};

export type CostCategoryRow = {
  key: string;
  label: string;
  amount: number;
  share: number; // 0..1, normalized so sum across rows ≈ 1
  color: string;
};

export type CostByCategory = {
  rows: CostCategoryRow[];
  total: number;
};

// =======================================================================
// Journey — hành trình đơn hàng GHN (5 chặng)
// =======================================================================

export type JourneyStageKey = "pickup" | "bcNhan" | "ktc" | "bcGiao" | "bcHoan";

export type JourneyStageSummary = {
  key: JourneyStageKey;
  step: number;
  label: string;
  shortLabel: string;
  description: string;
  /** Tỷ lệ đơn pass qua chặng này thành công (%). */
  successRate: number;
  status: Status;
  /** Số đơn trung bình qua chặng / ngày. */
  throughput: number;
  tone: "green" | "blue" | "violet" | "amber" | "rose";
};

export type PickupKpis = {
  successRate: KpiValue;
  cancelRate: KpiValue;
  lateRate: KpiValue;
  avgTatMin: KpiValue;
};

export type BcNhanKpis = {
  wrongCodeRate: KpiValue;
  wrongPackageRate: KpiValue;
  missingMvdRate: KpiValue;
  processingTatMin: KpiValue;
};

export type BcGiaoKpis = {
  gtcRate: KpiValue;
  gt1pRate: KpiValue;
  gtbRate: KpiValue;
  lostRate: KpiValue;
  codCollected: number; // VND
  codPendingDeposit: number; // VND
};

export type BcHoanKpis = {
  returnSuccessRate: KpiValue;
  returnFailRate: KpiValue;
  avgReturnDays: KpiValue;
  storedRate: KpiValue;
};

export type JourneyKpis = {
  pickup: PickupKpis;
  bcNhan: BcNhanKpis;
  bcGiao: BcGiaoKpis;
  bcHoan: BcHoanKpis;
};

export type LeadTime = { p50: number; p90: number; p99: number };

export type MisRouteRow = {
  mvd: string;
  createdAt: string;
  senderProvince: string;
  receiverProvince: string;
  serviceType: ServiceType;
  predictedKtc: string;
  actualKtc: string;
  reason: string;
};

export type LanePerfRow = {
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

export type KtcStatusRow = {
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

export type HeatmapCell = {
  row: string;
  col: string;
  value: number;
  status: Status;
};

export type HeatmapData = {
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
};

export type PipelineHealthCell = {
  provinceCode: string;
  region: string;
  status: Status;
  value: number;
  unit: KpiUnit;
};

export type PipelineHealthRow = {
  module: "ORS" | "NDS + KTC";
  metricLabel: string;
  regionTotals: PipelineHealthCell[];
  totalStatus: Status;
  totalValue: number;
  totalUnit: KpiUnit;
  drillHref: string;
};

export type FunnelStep = {
  label: string;
  count: number;
  dropoffPct?: number;
};

export type AlertItem = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  count?: number;
  hint?: string;
  /** When clicked, jump to this page (e.g. drill into /network filtered). */
  href?: string;
  /** Display time stamp (e.g. "13:42"). */
  time?: string;
};

export type OpsScorecardRow = {
  key: string;
  /** Display label, may contain abbreviation + Vietnamese gloss. */
  label: string;
  /** Last completed week (e.g. W20). */
  w20Value: number;
  /** Week-to-date (current week up to today). */
  wtdValue: number;
  target: number;
  direction: KpiDirection;
  unit: KpiUnit;
  status: Status;
  /** WTD - W20, expressed in percentage points. */
  deltaPp: number;
  note?: string;
};

export type QualityRow = {
  label: string;
  value: number;
  unit: KpiUnit;
  deltaPct: number;
  status: Status;
  direction: KpiDirection;
  /** Optional href to drill into the owning module page. */
  href?: string;
};

// --- Histogram shape ----------------------------------------------------

export type HistogramBucket = {
  bucket: string; // e.g. "0–100ms"
  count: number;
};

// --- Service breakdown (grouped bars) -----------------------------------

export type ServiceBreakdownRow = {
  serviceType: ServiceType;
  misRouteCount: number;
  totalCount: number;
  misRoutePct: number;
};

// --- Coverage by service ------------------------------------------------

export type ServiceCoverage = {
  serviceType: ServiceType;
  coveredPct: number;
};
