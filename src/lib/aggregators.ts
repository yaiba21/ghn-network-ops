// =============================================================================
// Aggregators — tính các metric Tổng Quan từ 4 fact table (Phase 1).
// Mỗi function nhận FilterState, filter fact tables tương ứng, rồi compute.
// Không dùng kpiFromBase cũ — số liệu phản ánh dữ liệu thật (mock seedrandom
// nhưng deterministic + có pattern).
// =============================================================================

import {
  getBcs,
  getFactDeliveries,
  getFactOrders,
  getFactPickups,
  getFactTrips,
  getKtcs,
} from "./mock-data";
import { KPI, statusFromValue } from "./kpi-config";
import type {
  AlertItem,
  FactOrder,
  FactPickup,
  FactTrip,
  FilterState,
  FinalStatus,
  HeatmapData,
  KpiValue,
  RegionCode,
  Status,
} from "./types";
import { lastNDays } from "./utils";

// =============================================================================
// Helpers: filter từng fact table theo FilterState
// =============================================================================

function dateInRange(iso: string, from: string, to: string): boolean {
  const d = iso.slice(0, 10);
  return d >= from && d <= to;
}

/** Filter fact_order theo geo + channel + loại BC + loại hàng + tuyến + SLA + ngày tạo. */
function filterOrders(filter: FilterState, source = getFactOrders()): FactOrder[] {
  const bcMap = new Map(getBcs().map((b) => [b.code, b]));
  return source.filter((o) => {
    if (
      filter.regionCode &&
      filter.regionCode !== "all" &&
      o.regionCode !== filter.regionCode
    )
      return false;
    if (filter.provinceCode && o.provinceCode !== filter.provinceCode) return false;
    if (filter.bcCode && o.bcGiaoCode !== filter.bcCode) return false;
    if (
      filter.channelCode &&
      filter.channelCode !== "all" &&
      o.channel !== filter.channelCode
    )
      return false;
    if (filter.loaiHoatDong && filter.loaiHoatDong !== "all") {
      const bc = bcMap.get(o.bcGiaoCode);
      if (bc?.loaiHoatDong !== filter.loaiHoatDong) return false;
    }
    if (filter.loaiDichVu && filter.loaiDichVu !== "all") {
      const bc = bcMap.get(o.bcGiaoCode);
      if (bc?.loaiDichVu !== filter.loaiDichVu) return false;
    }
    if (
      filter.loaiHang &&
      filter.loaiHang !== "all" &&
      o.loaiHang !== filter.loaiHang
    )
      return false;
    if (
      filter.loaiTuyen &&
      filter.loaiTuyen !== "all" &&
      o.loaiTuyen !== filter.loaiTuyen
    )
      return false;
    if (filter.slaDays && filter.slaDays !== "all" && o.slaDays !== filter.slaDays)
      return false;
    if (!dateInRange(o.createdTs, filter.from, filter.to)) return false;
    return true;
  });
}

function filterTrips(filter: FilterState): FactTrip[] {
  const trips = getFactTrips();
  return trips.filter((t) => {
    if (!dateInRange(t.planDepart, filter.from, filter.to)) return false;
    if (filter.vehicleType && filter.vehicleType !== "all" && t.vehicleType !== filter.vehicleType)
      return false;
    if (filter.carrier && filter.carrier !== "all" && t.carrier !== filter.carrier)
      return false;
    // Mã tuyến = origin->dest
    if (filter.laneCode && `${t.originCode}->${t.destCode}` !== filter.laneCode)
      return false;
    return true;
  });
}

function filterPickups(filter: FilterState, orderIds: Set<string>): FactPickup[] {
  return getFactPickups().filter((p) => orderIds.has(p.orderId));
}

// =============================================================================
// Compute primitives — pure functions trên arrays đã filter
// =============================================================================

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function computeOntimeNetwork(orders: FactOrder[]): number {
  // Đơn ontime: deliveredTs <= promisedTs
  const delivered = orders.filter((o) => o.finalStatus === "delivered" && o.deliveredTs);
  if (delivered.length === 0) return 0;
  const ontime = delivered.filter((o) => o.deliveredTs! <= o.promisedTs);
  return round1(pct(ontime.length, delivered.length));
}

function computeOtdRate(orders: FactOrder[]): number {
  // Tính trên đơn đã có deliveredTs (gồm cả delivered + một số trạng thái khác)
  const finished = orders.filter((o) => o.deliveredTs);
  return round1(
    pct(
      finished.filter((o) => o.deliveredTs! <= o.promisedTs).length,
      finished.length,
    ),
  );
}

function computeCostPerKg(trips: FactTrip[]): number {
  const totalCost = trips.reduce((a, b) => a + b.cost, 0);
  const totalWeight = trips.reduce((a, b) => a + b.weight, 0);
  if (totalWeight === 0) return 0;
  return Math.round(totalCost / totalWeight);
}

function computeHangVeBc4Ca(orders: FactOrder[]): number {
  // Approx: tỉ lệ đơn có lead time pickup → giao đủ 4 ca trước promisedTs.
  // 1 ca ~5h, 4 ca ~20h. Đơn được "về BC ≥4 ca" = có ít nhất 20h trước promised.
  const finished = orders.filter((o) => o.pickedTs && o.deliveredTs);
  if (finished.length === 0) return 0;
  const ok = finished.filter((o) => {
    const arriveBcMs = new Date(o.deliveredTs!).getTime() - 4 * 3600 * 1000; // arrived 4h before
    const promisedMs = new Date(o.promisedTs).getTime();
    return promisedMs - arriveBcMs >= 20 * 3600 * 1000;
  });
  return round1(pct(ok.length, finished.length));
}

function computeNddAchieve(orders: FactOrder[]): number {
  // NDD = SLA 1 day. % NDD ontime.
  const ndd = orders.filter((o) => o.slaDays === 1 && o.deliveredTs);
  if (ndd.length === 0) return 0;
  const ontime = ndd.filter((o) => o.deliveredTs! <= o.promisedTs);
  return round1(pct(ontime.length, ndd.length));
}

function computeOntimeVanTai(trips: FactTrip[]): number {
  // % chuyến on-time arrival (actual <= plan + 15 phút buffer)
  if (trips.length === 0) return 0;
  const ontime = trips.filter((t) => {
    const planMs = new Date(t.planArrive).getTime();
    const actualMs = new Date(t.actualArrive).getTime();
    return actualMs - planMs <= 15 * 60 * 1000;
  });
  return round1(pct(ontime.length, trips.length));
}

function computeDoiKhoOverall(orders: FactOrder[]): number {
  if (orders.length === 0) return 0;
  return round1(pct(orders.filter((o) => o.isChangedWarehouse).length, orders.length));
}

function computeDoiKhoMoi(orders: FactOrder[]): number {
  const newAddr = orders.filter((o) => o.phuongIsNew);
  if (newAddr.length === 0) return 0;
  return round1(pct(newAddr.filter((o) => o.isChangedWarehouse).length, newAddr.length));
}

// Map orderId → finalStatus (memo 1 lần) để tính %GTC per-order nhanh.
let _orderStatusMap: Map<string, FinalStatus> | null = null;
function orderStatusMap(): Map<string, FinalStatus> {
  if (!_orderStatusMap) {
    _orderStatusMap = new Map(
      getFactOrders().map((o) => [o.orderId, o.finalStatus]),
    );
  }
  return _orderStatusMap;
}

function computePctTc(orderIds: Set<string>): number {
  // %GTC = đơn GTC / đơn đã đến quyết định giao tại BC giao.
  // Mẫu số = delivered + delivery_failed + returned_success + returned_failed
  // (returns = đơn GTB rồi hoàn). Loại exception/lost/cancelled/in_progress.
  // Range thực tế 88-96%.
  const sm = orderStatusMap();
  let gtc = 0;
  let denom = 0;
  for (const id of orderIds) {
    const s = sm.get(id);
    if (
      s === "delivered" ||
      s === "delivery_failed" ||
      s === "returned_success" ||
      s === "returned_failed"
    ) {
      denom += 1;
      if (s === "delivered") gtc += 1;
    }
  }
  return denom === 0 ? 0 : round1(pct(gtc, denom));
}

function computePctTb(orderIds: Set<string>): number {
  const deliveries = getFactDeliveries().filter((d) => orderIds.has(d.orderId));
  if (deliveries.length === 0) return 0;
  return round1(
    pct(deliveries.filter((d) => d.outcome === "gtb").length, deliveries.length),
  );
}

/**
 * FD — Failed Delivery Rate.
 * Tử số: số đơn có ít nhất 1 attempt GTB (giao thất bại).
 * Mẫu số: tổng số đơn đã có ít nhất 1 attempt giao.
 */
function computeFailedDeliveryRate(orderIds: Set<string>): number {
  const deliveries = getFactDeliveries().filter((d) => orderIds.has(d.orderId));
  if (deliveries.length === 0) return 0;
  const byOrder = new Map<string, boolean>();
  for (const d of deliveries) {
    if (d.outcome === "gtb") byOrder.set(d.orderId, true);
    else if (!byOrder.has(d.orderId)) byOrder.set(d.orderId, false);
  }
  const total = byOrder.size;
  const failed = Array.from(byOrder.values()).filter((v) => v).length;
  return round1(pct(failed, total));
}

function computeFillRateKg(trips: FactTrip[]): number {
  if (trips.length === 0) return 0;
  const avg = trips.reduce((a, b) => a + b.fillRateKg, 0) / trips.length;
  return round1(avg * 100);
}

function computeFillRateOrder(trips: FactTrip[]): number {
  if (trips.length === 0) return 0;
  const avg = trips.reduce((a, b) => a + b.fillRateOrder, 0) / trips.length;
  return round1(avg * 100);
}

function computeEmptyMileage(trips: FactTrip[]): number {
  const totalEmpty = trips.reduce((a, b) => a + b.emptyKm, 0);
  const totalKm = trips.reduce((a, b) => a + b.totalKm, 0);
  return round1(pct(totalEmpty, totalKm));
}

function computePctLtc(pickups: FactPickup[]): number {
  if (pickups.length === 0) return 0;
  return round1(pct(pickups.filter((p) => p.ltc).length, pickups.length));
}

function computePctDaGan(pickups: FactPickup[]): number {
  if (pickups.length === 0) return 0;
  return round1(pct(pickups.filter((p) => p.assigned).length, pickups.length));
}

function computeAvgLeadtimeAssignMin(pickups: FactPickup[]): number {
  if (pickups.length === 0) return 0;
  return round1(
    pickups.reduce((a, b) => a + b.leadtimeAssignSec, 0) / pickups.length / 60,
  );
}

function computeFdRate(orderIds: Set<string>): number {
  // %FD = đơn delivered ngay attempt 1 / đơn finished
  const deliveries = getFactDeliveries().filter((d) => orderIds.has(d.orderId));
  // group by order, find first attempt and outcome
  const byOrder = new Map<string, { firstAttempt: number; finalOutcome: string }>();
  for (const d of deliveries) {
    const cur = byOrder.get(d.orderId);
    if (!cur || d.attemptNo < cur.firstAttempt) {
      byOrder.set(d.orderId, { firstAttempt: d.attemptNo, finalOutcome: d.outcome });
    }
  }
  const total = byOrder.size;
  if (total === 0) return 0;
  // FD = attemptNo=1 + outcome=gtc
  const fd = Array.from(byOrder.values()).filter(
    (v) => v.firstAttempt === 1 && v.finalOutcome === "gtc",
  ).length;
  return round1(pct(fd, total));
}

function computePctReturn(orders: FactOrder[]): number {
  if (orders.length === 0) return 0;
  return round1(pct(orders.filter((o) => o.finalStatus === "returned_success").length, orders.length));
}

function computePctLost(orders: FactOrder[]): number {
  if (orders.length === 0) return 0;
  return round1(pct(orders.filter((o) => o.finalStatus === "lost").length, orders.length));
}

// =============================================================================
// Sparkline helper — 7 ngày gần nhất
// =============================================================================

function sparkline7Days(
  filter: FilterState,
  computeForDay: (dayFilter: FilterState) => number,
): number[] {
  const days = lastNDays(7, filter.to);
  return days.map((day) =>
    computeForDay({ ...filter, from: day, to: day }),
  );
}

// =============================================================================
// Build KpiValue helper
// =============================================================================

function buildKpi(
  kpiKey: keyof typeof KPI,
  value: number,
  sparkline: number[],
  prevValue?: number,
): KpiValue {
  const spec = KPI[kpiKey];
  const deltaPct =
    prevValue && prevValue !== 0 ? ((value - prevValue) / prevValue) * 100 : 0;
  return {
    label: spec.label,
    value,
    unit: spec.unit,
    target: spec.target,
    deltaPct: round1(deltaPct),
    sparkline,
    status: statusFromValue(spec, value),
    direction: spec.direction,
  };
}

// =============================================================================
// PUBLIC API — Tổng Quan (Trang 0)
// =============================================================================

export type OverviewNorthStar = {
  ontimeNetwork: KpiValue;
  costPerKg: KpiValue;
  hangVeBc4Ca: KpiValue;
  fdRate: KpiValue;
  ontimeVanTai: KpiValue;
  doiKhoOverall: KpiValue;
};

export type ModuleSubMetric = {
  label: string;
  value: number;
  unit: string;
  status: Status;
  format?: "pct" | "vnd" | "min";
};

export type ModuleHealth = {
  key: "first-mile" | "middle-mile" | "last-mile" | "routing" | "transport";
  name: string;
  subMetrics: ModuleSubMetric[];
  status: Status;
};

function worstStatus(...arr: Status[]): Status {
  if (arr.includes("red")) return "red";
  if (arr.includes("amber")) return "amber";
  return "green";
}

export function getOverviewNorthStar(filter: FilterState): OverviewNorthStar {
  const orders = filterOrders(filter);
  const trips = filterTrips(filter);

  const ontime = computeOntimeNetwork(orders);
  const cpk = computeCostPerKg(trips);
  const hang4ca = computeHangVeBc4Ca(orders);
  const orderIds0 = new Set(orders.map((o) => o.orderId));
  const fd = computeFailedDeliveryRate(orderIds0);
  const ovt = computeOntimeVanTai(trips);
  const dk = computeDoiKhoOverall(orders);

  // Sparkline 7 ngày: compute từng metric cho từng ngày
  const sparkOntime = sparkline7Days(filter, (f) => computeOntimeNetwork(filterOrders(f)));
  const sparkCpk = sparkline7Days(filter, (f) => computeCostPerKg(filterTrips(f)));
  const sparkHang = sparkline7Days(filter, (f) => computeHangVeBc4Ca(filterOrders(f)));
  const sparkFd = sparkline7Days(filter, (f) =>
    computeFailedDeliveryRate(new Set(filterOrders(f).map((o) => o.orderId))),
  );
  const sparkOvt = sparkline7Days(filter, (f) => computeOntimeVanTai(filterTrips(f)));
  const sparkDk = sparkline7Days(filter, (f) => computeDoiKhoOverall(filterOrders(f)));

  // Delta vs trung bình 6 ngày trước (so với hôm nay)
  const half = 3;
  const delta = (arr: number[]) => {
    const prev = arr.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
    const cur = arr.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, arr.length - half);
    return prev;
  };

  return {
    ontimeNetwork: buildKpi("ontimeNetwork", ontime, sparkOntime, delta(sparkOntime)),
    costPerKg: buildKpi("costPerKgNetwork", cpk, sparkCpk, delta(sparkCpk)),
    hangVeBc4Ca: buildKpi("hangVeBc4Ca", hang4ca, sparkHang, delta(sparkHang)),
    fdRate: buildKpi("fdRate", fd, sparkFd, delta(sparkFd)),
    ontimeVanTai: buildKpi("ontimeVanTai", ovt, sparkOvt, delta(sparkOvt)),
    doiKhoOverall: buildKpi("doiKhoOverall", dk, sparkDk, delta(sparkDk)),
  };
}

export function getOverviewModuleHealth(filter: FilterState): ModuleHealth[] {
  const orders = filterOrders(filter);
  const orderIds = new Set(orders.map((o) => o.orderId));
  const trips = filterTrips(filter);
  const pickups = filterPickups(filter, orderIds);

  // First Mile
  const pctDaGan = computePctDaGan(pickups);
  const pctLtc = computePctLtc(pickups);
  const leadAssign = computeAvgLeadtimeAssignMin(pickups);
  const firstMile: ModuleHealth = {
    key: "first-mile",
    name: "First Mile (Lấy hàng)",
    subMetrics: [
      {
        label: "% Đã gán",
        value: pctDaGan,
        unit: "%",
        status: statusFromValue(KPI.pctDaGan, pctDaGan),
        format: "pct",
      },
      {
        label: "% LTC",
        value: pctLtc,
        unit: "%",
        status: statusFromValue(KPI.pctLTC, pctLtc),
        format: "pct",
      },
      {
        label: "Leadtime gán",
        value: leadAssign,
        unit: "phút",
        status: statusFromValue(KPI.leadtimeGanMin, leadAssign),
        format: "min",
      },
    ],
    status: worstStatus(
      statusFromValue(KPI.pctDaGan, pctDaGan),
      statusFromValue(KPI.pctLTC, pctLtc),
      statusFromValue(KPI.leadtimeGanMin, leadAssign),
    ),
  };

  // Middle Mile
  const ontimeNet = computeOntimeNetwork(orders);
  const hang4 = computeHangVeBc4Ca(orders);
  const cpk = computeCostPerKg(trips);
  const middleMile: ModuleHealth = {
    key: "middle-mile",
    name: "Middle Mile (KTC + Linehaul)",
    subMetrics: [
      {
        label: "Ontime Network",
        value: ontimeNet,
        unit: "%",
        status: statusFromValue(KPI.ontimeNetwork, ontimeNet),
        format: "pct",
      },
      {
        label: "% Hàng ≥4 ca",
        value: hang4,
        unit: "%",
        status: statusFromValue(KPI.hangVeBc4Ca, hang4),
        format: "pct",
      },
      {
        label: "Cost/kg",
        value: cpk,
        unit: "đ/kg",
        status: statusFromValue(KPI.costPerKgNetwork, cpk),
        format: "vnd",
      },
    ],
    status: worstStatus(
      statusFromValue(KPI.ontimeNetwork, ontimeNet),
      statusFromValue(KPI.hangVeBc4Ca, hang4),
      statusFromValue(KPI.costPerKgNetwork, cpk),
    ),
  };

  // Last Mile
  const tc = computePctTc(orderIds);
  const fd = computeFdRate(orderIds);
  const tb = computePctTb(orderIds);
  const lastMile: ModuleHealth = {
    key: "last-mile",
    name: "Last Mile (Giao hàng)",
    subMetrics: [
      {
        label: "%GTC",
        value: tc,
        unit: "%",
        status: statusFromValue(KPI.pctTC, tc),
        format: "pct",
      },
      {
        label: "%FD",
        value: fd,
        unit: "%",
        status: statusFromValue(KPI.pctFD, fd),
        format: "pct",
      },
      {
        label: "%TB",
        value: tb,
        unit: "%",
        status:
          tb <= 5
            ? "green"
            : tb <= 8
              ? "amber"
              : "red",
        format: "pct",
      },
    ],
    status: worstStatus(
      statusFromValue(KPI.pctTC, tc),
      statusFromValue(KPI.pctFD, fd),
    ),
  };

  // Routing
  const dkOverall = computeDoiKhoOverall(orders);
  const dkMoi = computeDoiKhoMoi(orders);
  const ptrlOk = round1(100 - dkOverall); // approx % phân tuyến đúng
  const routing: ModuleHealth = {
    key: "routing",
    name: "Routing (ORS + Allocation)",
    subMetrics: [
      {
        label: "% phân tuyến đúng",
        value: ptrlOk,
        unit: "%",
        status: statusFromValue(KPI.pctPhanTuyenDung, ptrlOk),
        format: "pct",
      },
      {
        label: "% Đổi kho overall",
        value: dkOverall,
        unit: "%",
        status: statusFromValue(KPI.doiKhoOverall, dkOverall),
        format: "pct",
      },
      {
        label: "% Đổi kho mới",
        value: dkMoi,
        unit: "%",
        status: statusFromValue(KPI.doiKhoMoi, dkMoi),
        format: "pct",
      },
    ],
    status: worstStatus(
      statusFromValue(KPI.pctPhanTuyenDung, ptrlOk),
      statusFromValue(KPI.doiKhoOverall, dkOverall),
      statusFromValue(KPI.doiKhoMoi, dkMoi),
    ),
  };

  // Transport
  const ovt = computeOntimeVanTai(trips);
  const fillKg = computeFillRateKg(trips);
  const empty = computeEmptyMileage(trips);
  const transport: ModuleHealth = {
    key: "transport",
    name: "Transport (Vận tải)",
    subMetrics: [
      {
        label: "Ontime vận tải",
        value: ovt,
        unit: "%",
        status: statusFromValue(KPI.ontimeVanTai, ovt),
        format: "pct",
      },
      {
        label: "Fill rate kg",
        value: fillKg,
        unit: "%",
        status: statusFromValue(KPI.fillRateKg, fillKg),
        format: "pct",
      },
      {
        label: "% Empty Mileage",
        value: empty,
        unit: "%",
        status: statusFromValue(KPI.pctEmptyMileage, empty),
        format: "pct",
      },
    ],
    status: worstStatus(
      statusFromValue(KPI.ontimeVanTai, ovt),
      statusFromValue(KPI.fillRateKg, fillKg),
      statusFromValue(KPI.pctEmptyMileage, empty),
    ),
  };

  return [firstMile, middleMile, lastMile, routing, transport];
}

// 14 vùng GHN theo spec — sort theo volume share ước lượng
// Hệ số cost theo vùng (vùng xa cost cao hơn) — vì trips không gắn region,
// dùng factor này để tạo variance giữa các vùng trong scorecard/heatmap.
const REGION_COST_FACTOR: Record<RegionCode, number> = {
  HNO: 0.92,
  HCM: 0.93,
  DSH: 0.96,
  DNB: 0.97,
  DCL: 1.02,
  BTB: 1.04,
  DBB: 1.03,
  TTB: 1.05,
  NTB: 1.06,
  TNG: 1.12,
  TNB: 1.08,
  XBG: 1.0,
  TBB: 1.15,
  TNT: 1.01,
};

function regionCostPerKg(region: RegionCode, baseCpk: number): number {
  return Math.round(baseCpk * (REGION_COST_FACTOR[region] ?? 1));
}

const HEATMAP_REGIONS: { code: RegionCode; name: string }[] = [
  { code: "HCM", name: "Hồ Chí Minh" },
  { code: "HNO", name: "Hà Nội" },
  { code: "DSH", name: "ĐB Sông Hồng" },
  { code: "DNB", name: "Đông Nam Bộ" },
  { code: "DCL", name: "ĐB Cửu Long" },
  { code: "BTB", name: "Bắc Trung Bộ" },
  { code: "DBB", name: "Đông Bắc Bộ" },
  { code: "TTB", name: "Trung Trung Bộ" },
  { code: "NTB", name: "Nam Trung Bộ" },
  { code: "TNG", name: "Tây Nguyên" },
  { code: "TNB", name: "Tây Nam Bộ" },
  { code: "XBG", name: "Xứ Bắc Giang" },
  { code: "TBB", name: "Tây Bắc Bộ" },
  { code: "TNT", name: "Tây Nam Thủ đô" },
];

export function getOverviewRegionHeatmap(filter: FilterState): HeatmapData {
  const regions = HEATMAP_REGIONS;
  const cols = [
    "Ontime Network",
    "Cost/kg",
    "% Giao thành công",
    "Tỷ lệ đổi kho",
  ];

  const cells: { row: string; col: string; value: number; status: Status }[] = [];

  for (const r of regions) {
    const subFilter: FilterState = { ...filter, regionCode: r.code };
    const orders = filterOrders(subFilter);
    const orderIds = new Set(orders.map((o) => o.orderId));
    const trips = filterTrips(subFilter);

    const ontime = computeOntimeNetwork(orders);
    const cpk = regionCostPerKg(r.code, computeCostPerKg(trips));
    const tc = computePctTc(orderIds);
    const dk = computeDoiKhoOverall(orders);

    cells.push({
      row: r.name,
      col: "Ontime Network",
      value: ontime,
      status: statusFromValue(KPI.ontimeNetwork, ontime),
    });
    cells.push({
      row: r.name,
      col: "Cost/kg",
      value: cpk,
      status: statusFromValue(KPI.costPerKgNetwork, cpk),
    });
    cells.push({
      row: r.name,
      col: "% Giao thành công",
      value: tc,
      status: statusFromValue(KPI.pctTC, tc),
    });
    cells.push({
      row: r.name,
      col: "Tỷ lệ đổi kho",
      value: dk,
      status: statusFromValue(KPI.doiKhoOverall, dk),
    });
  }

  return { rows: regions.map((r) => r.name), cols, cells };
}

export function getOverviewAlerts(filter: FilterState): AlertItem[] {
  const orders = filterOrders(filter);
  const orderIds = new Set(orders.map((o) => o.orderId));
  const trips = filterTrips(filter);

  const alerts: AlertItem[] = [];

  // 1) Đơn lost
  const lost = orders.filter((o) => o.finalStatus === "lost").length;
  if (lost > 0) {
    alerts.push({
      id: "lost-orders",
      severity: lost > 50 ? "critical" : "warning",
      title: `đơn đang ở trạng thái thất lạc / hư hỏng — cần kiểm tra ngay`,
      count: lost,
    });
  }

  // 2) Đơn in_progress quá lâu (created cách ít nhất 3 ngày trước to)
  const stuckThreshold = 3 * 24 * 3600 * 1000;
  const toMs = new Date(filter.to + "T23:59:00").getTime();
  const stuck = orders.filter(
    (o) =>
      o.finalStatus === "in_progress" &&
      toMs - new Date(o.createdTs).getTime() > stuckThreshold,
  );
  if (stuck.length > 0) {
    alerts.push({
      id: "stuck-orders",
      severity: stuck.length > 100 ? "critical" : "warning",
      title: `đơn ở trạng thái Transporting/Storing nhưng đã quá 3 ngày — chưa cập nhật status`,
      count: stuck.length,
    });
  }

  // 3) Đổi kho overall cao
  const dk = computeDoiKhoOverall(orders);
  if (dk > KPI.doiKhoOverall.thresholds[1]) {
    alerts.push({
      id: "high-doi-kho",
      severity: "warning",
      title: `Tỷ lệ đổi kho overall đang ở ${dk.toFixed(1)}% — vượt ngưỡng cảnh báo ${KPI.doiKhoOverall.thresholds[1]}%`,
    });
  }

  // 4) Trips fill rate kg thấp
  const fillKg = computeFillRateKg(trips);
  if (fillKg < KPI.fillRateKg.thresholds[1]) {
    alerts.push({
      id: "low-fill",
      severity: "warning",
      title: `Fill rate kg trung bình ${fillKg.toFixed(1)}% — dưới ngưỡng ${KPI.fillRateKg.thresholds[1]}%`,
    });
  }

  // 5) %GTC thấp
  const tc = computePctTc(orderIds);
  if (tc < KPI.pctTC.thresholds[1]) {
    alerts.push({
      id: "low-tc",
      severity: "critical",
      title: `%GTC đang ở ${tc.toFixed(1)}% — dưới ngưỡng ${KPI.pctTC.thresholds[1]}%`,
    });
  }

  return alerts;
}

export type PulseGaugeData = {
  label: string;
  value: number;
  target: number;
  status: Status;
  unit: string;
};

export function getOverviewPulseGauges(filter: FilterState): PulseGaugeData[] {
  const trips = filterTrips(filter);
  const orders = filterOrders(filter);
  const orderIds = new Set(orders.map((o) => o.orderId));
  const pickups = filterPickups(filter, orderIds);

  const fillKg = computeFillRateKg(trips);
  const fillOrder = computeFillRateOrder(trips);
  const ontime = computeOntimeNetwork(orders);
  const ovt = computeOntimeVanTai(trips);
  const tc = computePctTc(orderIds);
  const ltc = computePctLtc(pickups);
  const dk = computeDoiKhoOverall(orders);
  const fd = computeFailedDeliveryRate(orderIds);

  return [
    {
      label: "Fill rate kg",
      value: fillKg,
      target: KPI.fillRateKg.target,
      status: statusFromValue(KPI.fillRateKg, fillKg),
      unit: "%",
    },
    {
      label: "Fill rate đơn",
      value: fillOrder,
      target: KPI.fillRateOrder.target,
      status: statusFromValue(KPI.fillRateOrder, fillOrder),
      unit: "%",
    },
    {
      label: "Ontime Network",
      value: ontime,
      target: KPI.ontimeNetwork.target,
      status: statusFromValue(KPI.ontimeNetwork, ontime),
      unit: "%",
    },
    {
      label: "Ontime vận tải",
      value: ovt,
      target: KPI.ontimeVanTai.target,
      status: statusFromValue(KPI.ontimeVanTai, ovt),
      unit: "%",
    },
    {
      label: "% Giao thành công",
      value: tc,
      target: KPI.pctTC.target,
      status: statusFromValue(KPI.pctTC, tc),
      unit: "%",
    },
    {
      label: "% LTC pickup",
      value: ltc,
      target: KPI.pctLTC.target,
      status: statusFromValue(KPI.pctLTC, ltc),
      unit: "%",
    },
    {
      label: "% Đổi kho",
      value: dk,
      target: KPI.doiKhoOverall.target,
      status: statusFromValue(KPI.doiKhoOverall, dk),
      unit: "%",
    },
    {
      label: "FD (Fail Delivery)",
      value: fd,
      target: KPI.fdRate.target,
      status: statusFromValue(KPI.fdRate, fd),
      unit: "%",
    },
  ];
}

// =============================================================================
// PHASE 4 — More dimensions for Tổng Quan enrichment
// =============================================================================

export type ChannelCompareRow = {
  channel: string;
  channelLabel: string;
  orders: number;
  share: number;
  ontime: number;
  pctTC: number;
  doiKho: number;
  fd: number;
};

export function getChannelComparison(filter: FilterState): ChannelCompareRow[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  const channels: { code: string; label: string }[] = [
    { code: "tts", label: "TTS (TikTok)" },
    { code: "spe", label: "SPE (Shopee)" },
    { code: "sme", label: "SME" },
    { code: "ka", label: "KA" },
    { code: "b2b", label: "B2B" },
    { code: "cb", label: "Cross-border" },
  ];
  return channels.map((c) => {
    const chOrders = orders.filter((o) => o.channel === c.code);
    const ids = new Set(chOrders.map((o) => o.orderId));
    return {
      channel: c.code,
      channelLabel: c.label,
      orders: chOrders.length,
      share: round1(pct(chOrders.length, total)),
      ontime: computeOntimeNetwork(chOrders),
      pctTC: computePctTc(ids),
      doiKho: computeDoiKhoOverall(chOrders),
      fd: computeFailedDeliveryRate(ids),
    };
  });
}

export type LoaiHangCompareRow = {
  key: string;
  label: string;
  orders: number;
  share: number;
  ontime: number;
  costPerKg: number;
  doiKho: number;
};

export function getLoaiHangComparison(filter: FilterState): LoaiHangCompareRow[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  const items: { key: "tieu-chuan" | "cong-kenh" | "nang"; label: string }[] = [
    { key: "tieu-chuan", label: "Tiêu chuẩn" },
    { key: "cong-kenh", label: "Cồng kềnh" },
    { key: "nang", label: "Nặng" },
  ];
  return items.map((it) => {
    const sub = orders.filter((o) => o.loaiHang === it.key);
    // Estimate cost/kg per loại hàng từ tổng weight + tổng cost trip
    const allTrips = filterTrips(filter);
    const subWeight = sub.reduce((a, o) => a + o.weightKg, 0);
    const tripCost = allTrips.reduce((a, b) => a + b.cost, 0);
    const tripWeight = allTrips.reduce((a, b) => a + b.weight, 0);
    const cpk = tripWeight > 0 ? Math.round(tripCost / tripWeight) : 0;
    return {
      key: it.key,
      label: it.label,
      orders: sub.length,
      share: round1(pct(sub.length, total)),
      ontime: computeOntimeNetwork(sub),
      costPerKg: cpk + (it.key === "nang" ? 400 : it.key === "cong-kenh" ? 200 : 0), // hàng nặng đắt hơn
      doiKho: computeDoiKhoOverall(sub),
    };
  });
}

export type SlaCompareRow = {
  slaDays: number;
  orders: number;
  share: number;
  ontime: number;
  ltAvgH: number;
};

export function getSlaComparison(filter: FilterState): SlaCompareRow[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  return [1, 2, 3].map((sla) => {
    const sub = orders.filter((o) => o.slaDays === sla);
    const finished = sub.filter((o) => o.deliveredTs);
    const ltAvg =
      finished.length > 0
        ? finished.reduce(
            (a, o) =>
              a +
              (new Date(o.deliveredTs!).getTime() -
                new Date(o.createdTs).getTime()) /
                3600000,
            0,
          ) / finished.length
        : 0;
    return {
      slaDays: sla,
      orders: sub.length,
      share: round1(pct(sub.length, total)),
      ontime: computeOntimeNetwork(sub),
      ltAvgH: round1(ltAvg),
    };
  });
}

export type DailyTrendPoint = {
  date: string;
  orders: number;
  ontime: number;
  pctTC: number;
  doiKho: number;
};

export function getDailyTrend(filter: FilterState, days = 14): DailyTrendPoint[] {
  const out: DailyTrendPoint[] = [];
  for (const day of lastNDays(days, filter.to)) {
    const sub = filterOrders({ ...filter, from: day, to: day });
    const ids = new Set(sub.map((o) => o.orderId));
    out.push({
      date: day,
      orders: sub.length,
      ontime: computeOntimeNetwork(sub),
      pctTC: computePctTc(ids),
      doiKho: computeDoiKhoOverall(sub),
    });
  }
  return out;
}


// =============================================================================
// PHASE 3 — /journey (Hành Trình Đơn Hàng)
// =============================================================================

export type StatusGroupKey =
  | "tao"         // Tạo đơn
  | "lay"         // Lấy hàng
  | "ktc-di"      // KTC đi
  | "giao"        // Giao hàng
  | "ktc-ve"      // KTC về
  | "tra";        // Trả hàng

export type StatusGroupRow = {
  groupKey: StatusGroupKey;
  groupLabel: string;
  total: number;
  successRate: number;
  avgLeadtimeH: number;
  failCount: number;
};

export function getJourneyStatusGroups(filter: FilterState): StatusGroupRow[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  const pickup = orders.filter((o) => o.pickedTs);
  const delivered = orders.filter((o) => o.finalStatus === "delivered");
  const returned = orders.filter((o) => o.finalStatus === "returned_success");
  const inProgress = orders.filter((o) => o.finalStatus === "in_progress");
  const lostExc = orders.filter((o) => o.finalStatus === "lost");

  const avgPickLT =
    pickup.length === 0
      ? 0
      : pickup.reduce(
          (a, o) =>
            a +
            (new Date(o.pickedTs!).getTime() - new Date(o.createdTs).getTime()) /
              3600000,
          0,
        ) / pickup.length;

  const avgE2eLT =
    delivered.length === 0
      ? 0
      : delivered.reduce(
          (a, o) =>
            a +
            (new Date(o.deliveredTs!).getTime() -
              new Date(o.createdTs).getTime()) /
              3600000,
          0,
        ) / delivered.length;

  return [
    {
      groupKey: "tao",
      groupLabel: "1. Tạo đơn",
      total,
      successRate: round1(pct(total - orders.filter((o) => o.currentState === "CANCEL").length, total)),
      avgLeadtimeH: 0,
      failCount: orders.filter((o) => o.currentState === "CANCEL").length,
    },
    {
      groupKey: "lay",
      groupLabel: "2. Lấy hàng",
      total: pickup.length,
      successRate: round1(pct(pickup.length, total)),
      avgLeadtimeH: round1(avgPickLT),
      failCount: total - pickup.length,
    },
    {
      groupKey: "ktc-di",
      groupLabel: "3. KTC đi",
      total: pickup.length,
      successRate: round1(pct(pickup.filter((o) => o.deliveredTs || o.finalStatus !== "in_progress").length, pickup.length)),
      avgLeadtimeH: round1(avgE2eLT * 0.4),
      failCount: 0,
    },
    {
      groupKey: "giao",
      groupLabel: "4. Giao hàng",
      total: delivered.length + returned.length + inProgress.length,
      successRate: round1(pct(delivered.length, delivered.length + returned.length + inProgress.length || 1)),
      avgLeadtimeH: round1(avgE2eLT * 0.5),
      failCount: returned.length + lostExc.length,
    },
    {
      groupKey: "ktc-ve",
      groupLabel: "5. KTC về",
      total: returned.length,
      successRate: round1(pct(returned.length, returned.length || 1) * 0.95),
      avgLeadtimeH: round1(avgE2eLT * 0.3),
      failCount: lostExc.length,
    },
    {
      groupKey: "tra",
      groupLabel: "6. Trả hàng",
      total: returned.length,
      successRate: 92,
      avgLeadtimeH: round1(avgE2eLT * 0.25),
      failCount: lostExc.length,
    },
  ];
}

export type FunnelNode = {
  key: string;
  label: string;
  count: number;
  isTerminal?: boolean;
  isFail?: boolean;
};

/** Funnel theo 5 mốc chính + 4 terminal. */
export function getJourneyFunnel(filter: FilterState): FunnelNode[] {
  const orders = filterOrders(filter);
  const total = orders.length;
  const picked = orders.filter((o) => o.pickedTs).length;
  const atKtcOut = Math.round(picked * 0.985);
  const atBcGiao = Math.round(atKtcOut * 0.97);
  const delivered = orders.filter((o) => o.finalStatus === "delivered").length;
  const returned = orders.filter((o) => o.finalStatus === "returned_success").length;
  const lost = orders.filter((o) => o.finalStatus === "lost").length;
  const cancelled = orders.filter((o) => o.currentState === "CANCEL").length;

  return [
    { key: "created", label: "Tạo đơn", count: total },
    { key: "picked", label: "Đã lấy", count: picked },
    { key: "at_ktc", label: "Nhập KTC", count: atKtcOut },
    { key: "at_bc_giao", label: "Tại BC giao", count: atBcGiao },
    { key: "delivered", label: "✓ Giao thành công", count: delivered, isTerminal: true },
    { key: "returned", label: "↩ Hoàn người gửi", count: returned, isTerminal: true },
    { key: "cancelled", label: "✗ Huỷ", count: cancelled, isTerminal: true, isFail: true },
    { key: "lost", label: "✗ Thất lạc", count: lost, isTerminal: true, isFail: true },
  ];
}

export type PercentileRow = {
  metric: string;
  p50: number;
  p90: number;
  p99: number;
  unit: string;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(sorted.length - 1, idx)];
}

export function getJourneyPercentiles(filter: FilterState): PercentileRow[] {
  const orders = filterOrders(filter);
  const delivered = orders.filter((o) => o.deliveredTs);

  // Time1: scan đơn đầu - checkin ~ approximated by 5-30 phút random
  const time1Arr = orders.map((o) => {
    const seed = o.orderId.charCodeAt(o.orderId.length - 1);
    return 10 + (seed % 35);
  });

  // Time2: kết thúc phiên - scan đầu ~ 10-50 phút
  const time2Arr = orders.map((o) => {
    const seed = o.orderId.charCodeAt(o.orderId.length - 2);
    return 15 + (seed % 45);
  });

  // Lead time E2E (h)
  const leadE2e = delivered.map(
    (o) => (new Date(o.deliveredTs!).getTime() - new Date(o.createdTs).getTime()) / 3600000,
  );

  const t1 = time1Arr.sort((a, b) => a - b);
  const t2 = time2Arr.sort((a, b) => a - b);
  const e2e = leadE2e.sort((a, b) => a - b);

  return [
    {
      metric: "Time 1 (scan đơn đầu)",
      p50: percentile(t1, 0.5),
      p90: percentile(t1, 0.9),
      p99: percentile(t1, 0.99),
      unit: "phút",
    },
    {
      metric: "Time 2 (kết thúc phiên)",
      p50: percentile(t2, 0.5),
      p90: percentile(t2, 0.9),
      p99: percentile(t2, 0.99),
      unit: "phút",
    },
    {
      metric: "Lead time E2E",
      p50: round1(percentile(e2e, 0.5)),
      p90: round1(percentile(e2e, 0.9)),
      p99: round1(percentile(e2e, 0.99)),
      unit: "h",
    },
  ];
}

/** 6 terminal states + cancelled + in_progress = 8 outcomes per spec. */
export type FinalStatusMixRow = {
  status: FinalStatus;
  label: string;
  icon: string;
  count: number;
  share: number;
  color: string;
  isTerminal: boolean;
};

export function getJourneyFinalStatusMix(filter: FilterState): FinalStatusMixRow[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  const cfg: { status: FinalStatus; label: string; icon: string; color: string; isTerminal: boolean }[] = [
    { status: "delivered", label: "Giao thành công", icon: "✓", color: "#10b981", isTerminal: true },
    { status: "delivery_failed", label: "Giao thất bại", icon: "✗", color: "#dc2626", isTerminal: true },
    { status: "returned_success", label: "Trả thành công", icon: "↩", color: "#f59e0b", isTerminal: true },
    { status: "returned_failed", label: "Trả thất bại", icon: "↩✗", color: "#b91c1c", isTerminal: true },
    { status: "exception", label: "Exception", icon: "⚠", color: "#a855f7", isTerminal: true },
    { status: "lost", label: "Thất lạc", icon: "✗", color: "#ef4444", isTerminal: true },
    { status: "cancelled", label: "Huỷ", icon: "✗", color: "#6b7280", isTerminal: true },
    { status: "in_progress", label: "Đang xử lý", icon: "⋯", color: "#9ca3af", isTerminal: false },
  ];
  return cfg.map((c) => {
    const count = orders.filter((o) => o.finalStatus === c.status).length;
    return {
      ...c,
      count,
      share: round1(pct(count, total)),
    };
  });
}

export type JourneyOrderRow = {
  mvd: string;
  createdAt: string;
  province: string;
  channel: string;
  loaiHang: string;
  slaDays: number;
  currentState: string;
  finalStatus: string;
  leadtimeH: number;
};

export function getJourneyTopOrders(filter: FilterState, limit = 30): JourneyOrderRow[] {
  const orders = filterOrders(filter)
    .slice(0, 5000) // tránh O(n) lớn
    .filter((o) => o.deliveredTs || o.finalStatus !== "in_progress");
  return orders.slice(0, limit).map((o) => ({
    mvd: o.orderId,
    createdAt: o.createdTs,
    province: o.provinceCode,
    channel: o.channel,
    loaiHang: o.loaiHang,
    slaDays: o.slaDays,
    currentState: o.currentState,
    finalStatus: o.finalStatus,
    leadtimeH: o.deliveredTs
      ? round1(
          (new Date(o.deliveredTs).getTime() - new Date(o.createdTs).getTime()) /
            3600000,
        )
      : 0,
  }));
}

// =============================================================================
// PHASE 4a — /stages (5 chặng vận hành)
// =============================================================================

export type StageKey = "fm" | "ktc-fw" | "lm" | "ktc-ret" | "return";

export type StageMetricCard = {
  stageKey: StageKey;
  stageLabel: string;
  throughput: number;
  ltMedianH: number;
  successRate: number;
  status: Status;
  activeNV: number;
};

export function getStageOverview(filter: FilterState): StageMetricCard[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  const picked = orders.filter((o) => o.pickedTs);
  const delivered = orders.filter((o) => o.finalStatus === "delivered");
  const returned = orders.filter((o) => o.finalStatus === "returned_success");

  const ltPick =
    picked.length > 0
      ? round1(
          picked.reduce(
            (a, o) =>
              a +
              (new Date(o.pickedTs!).getTime() - new Date(o.createdTs).getTime()) /
                3600000,
            0,
          ) / picked.length,
        )
      : 0;
  const ltE2e =
    delivered.length > 0
      ? round1(
          delivered.reduce(
            (a, o) =>
              a +
              (new Date(o.deliveredTs!).getTime() -
                new Date(o.createdTs).getTime()) /
                3600000,
            0,
          ) / delivered.length,
        )
      : 0;

  return [
    {
      stageKey: "fm",
      stageLabel: "First-mile (Lấy hàng)",
      throughput: picked.length,
      ltMedianH: ltPick,
      successRate: round1(pct(picked.length, total)),
      status:
        picked.length / total >= 0.95 ? "green" : picked.length / total >= 0.88 ? "amber" : "red",
      activeNV: 480 + Math.floor(picked.length / 100),
    },
    {
      stageKey: "ktc-fw",
      stageLabel: "KTC đi (Forward)",
      throughput: Math.round(picked.length * 0.985),
      ltMedianH: round1(ltE2e * 0.45),
      successRate: 97.5,
      status: "green",
      activeNV: 260,
    },
    {
      stageKey: "lm",
      stageLabel: "Last-mile (Giao)",
      throughput: delivered.length + returned.length,
      ltMedianH: round1(ltE2e * 0.4),
      successRate: round1(pct(delivered.length, delivered.length + returned.length || 1)),
      status:
        delivered.length / (delivered.length + returned.length || 1) >= 0.9
          ? "green"
          : "amber",
      activeNV: 1450,
    },
    {
      stageKey: "ktc-ret",
      stageLabel: "KTC về (Return)",
      throughput: returned.length,
      ltMedianH: round1(ltE2e * 0.3),
      successRate: 93,
      status: "green",
      activeNV: 95,
    },
    {
      stageKey: "return",
      stageLabel: "Trả hàng",
      throughput: Math.round(returned.length * 0.92),
      ltMedianH: round1(ltE2e * 0.25),
      successRate: 88,
      status: returned.length > total * 0.1 ? "amber" : "green",
      activeNV: 320,
    },
  ];
}

// (getStageBreakdown đã bỏ — trang /stages gỡ, breakdown first-mile không dùng)

// =============================================================================
// PHASE 4b — /routing extras
// =============================================================================

export type ChannelLayerFlow = {
  channel: string;
  channelLabel: string;
  ordersTotal: number;
  changedWh: number;
  newAddrChangedWh: number;
  // 3 tỷ lệ đổi kho phân biệt mẫu số
  doiKhoOverall: number;
  doiKhoNewAddr: number;
  doiKhoOldAddr: number;
};

export function getRoutingChannelFlow(filter: FilterState): ChannelLayerFlow[] {
  const orders = filterOrders(filter);
  const channels: { code: string; label: string }[] = [
    { code: "tts", label: "TTS (TikTok)" },
    { code: "spe", label: "SPE (Shopee)" },
    { code: "sme", label: "SME" },
    { code: "ka", label: "KA" },
    { code: "b2b", label: "B2B" },
    { code: "cb", label: "Cross-border" },
  ];

  return channels.map((c) => {
    const channelOrders = orders.filter((o) => o.channel === c.code);
    const newAddr = channelOrders.filter((o) => o.phuongIsNew);
    const oldAddr = channelOrders.filter((o) => !o.phuongIsNew);
    return {
      channel: c.code,
      channelLabel: c.label,
      ordersTotal: channelOrders.length,
      changedWh: channelOrders.filter((o) => o.isChangedWarehouse).length,
      newAddrChangedWh: newAddr.filter((o) => o.isChangedWarehouse).length,
      doiKhoOverall: computeDoiKhoOverall(channelOrders),
      doiKhoNewAddr:
        newAddr.length > 0
          ? round1(pct(newAddr.filter((o) => o.isChangedWarehouse).length, newAddr.length))
          : 0,
      doiKhoOldAddr:
        oldAddr.length > 0
          ? round1(pct(oldAddr.filter((o) => o.isChangedWarehouse).length, oldAddr.length))
          : 0,
    };
  });
}

// --- Routing: so sánh 14 vùng -------------------------------------------

export type RoutingRegionRow = {
  regionCode: RegionCode;
  regionName: string;
  orders: number;
  doiKhoOverall: number;
  doiKhoNewAddr: number;
  phanTuyenDung: number;
  status: Status;
};

export function getRoutingRegionComparison(filter: FilterState): RoutingRegionRow[] {
  return HEATMAP_REGIONS.map((r) => {
    const sub = filterOrders({ ...filter, regionCode: r.code });
    const newAddr = sub.filter((o) => o.phuongIsNew);
    const dkOverall = computeDoiKhoOverall(sub);
    const dkNew =
      newAddr.length > 0
        ? round1(pct(newAddr.filter((o) => o.isChangedWarehouse).length, newAddr.length))
        : 0;
    // % phân tuyến đúng lần đầu ~ 100 - đổi kho (proxy)
    const ptd = round1(100 - dkOverall);
    return {
      regionCode: r.code,
      regionName: r.name,
      orders: sub.length,
      doiKhoOverall: dkOverall,
      doiKhoNewAddr: dkNew,
      phanTuyenDung: ptd,
      status: statusFromValue(KPI.pctPhanTuyenDung, ptd),
    };
  }).sort((a, b) => b.orders - a.orders);
}

// --- Routing: top BC đổi kho + lý do ------------------------------------

export type TopRevertBcRow = {
  bcCode: string;
  bcName: string;
  region: RegionCode;
  province: string;
  totalOrders: number;
  revertCount: number;
  revertRate: number;
  topReason: string;
  status: Status;
};

const REVERT_REASON_POOL = [
  "BC nhận đóng / quá tải",
  "Sai routing rule",
  "Sai mapping địa chỉ",
  "Service không hỗ trợ vùng",
  "Khách đổi địa chỉ giao",
];

export function getTopRevertBcs(filter: FilterState, limit = 20): TopRevertBcRow[] {
  const orders = filterOrders(filter);
  const bcMap = new Map(getBcs().map((b) => [b.code, b]));

  const agg = new Map<string, { total: number; revert: number }>();
  for (const o of orders) {
    let cur = agg.get(o.bcGiaoCode);
    if (!cur) {
      cur = { total: 0, revert: 0 };
      agg.set(o.bcGiaoCode, cur);
    }
    cur.total += 1;
    if (o.isChangedWarehouse) cur.revert += 1;
  }

  const rows: TopRevertBcRow[] = [];
  for (const [code, a] of agg.entries()) {
    if (a.revert === 0) continue;
    const bc = bcMap.get(code);
    const rate = round1(pct(a.revert, a.total));
    // Lý do top dựa trên hash của code để deterministic
    const reasonIdx = code.charCodeAt(code.length - 1) % REVERT_REASON_POOL.length;
    rows.push({
      bcCode: code,
      bcName: bc?.name ?? code,
      region: (bc?.regionCode ?? "HNO") as RegionCode,
      province: bc?.provinceCode ?? "—",
      totalOrders: a.total,
      revertCount: a.revert,
      revertRate: rate,
      topReason: REVERT_REASON_POOL[reasonIdx],
      status: rate <= 2.3 ? "green" : rate <= 4 ? "amber" : "red",
    });
  }
  return rows.sort((a, b) => b.revertCount - a.revertCount).slice(0, limit);
}

// --- Routing: KPI tổng hợp cho header -----------------------------------

export type RoutingHeaderKpis = {
  phanTuyenDung: KpiValue;
  doiKhoOverall: KpiValue;
  doiKhoNewAddr: KpiValue;
  totalRevert: number;
  costImpact: number;
};

export function getRoutingHeaderKpis(filter: FilterState): RoutingHeaderKpis {
  const orders = filterOrders(filter);
  const newAddr = orders.filter((o) => o.phuongIsNew);
  const dkOverall = computeDoiKhoOverall(orders);
  const dkNew =
    newAddr.length > 0
      ? round1(pct(newAddr.filter((o) => o.isChangedWarehouse).length, newAddr.length))
      : 0;
  const ptd = round1(100 - dkOverall);
  const revertCount = orders.filter((o) => o.isChangedWarehouse).length;

  const sparkPtd = sparkline7Days(filter, (f) => {
    const sub = filterOrders(f);
    return round1(100 - computeDoiKhoOverall(sub));
  });
  const sparkDk = sparkline7Days(filter, (f) => computeDoiKhoOverall(filterOrders(f)));
  const sparkDkNew = sparkline7Days(filter, (f) => {
    const na = filterOrders(f).filter((o) => o.phuongIsNew);
    return na.length > 0
      ? round1(pct(na.filter((o) => o.isChangedWarehouse).length, na.length))
      : 0;
  });

  return {
    phanTuyenDung: buildKpi("pctPhanTuyenDung", ptd, sparkPtd),
    doiKhoOverall: buildKpi("doiKhoOverall", dkOverall, sparkDk),
    doiKhoNewAddr: buildKpi("doiKhoMoi", dkNew, sparkDkNew),
    totalRevert: revertCount,
    costImpact: revertCount * 10_000,
  };
}

export type RevertReasonRow = {
  key: string;
  label: string;
  share: number;
  count: number;
  color: string;
};

export function getRevertReasons(filter: FilterState): RevertReasonRow[] {
  const orders = filterOrders(filter);
  const reverted = orders.filter((o) => o.isChangedWarehouse);
  const total = reverted.length || 1;
  // Mock split — 66% vận hành, còn lại GAP
  return [
    {
      key: "ops-bc-closed",
      label: "BC nhận đóng / quá tải",
      share: round1(pct(Math.round(total * 0.28), total)),
      count: Math.round(total * 0.28),
      color: "#dc2626",
    },
    {
      key: "ops-routing-rule",
      label: "Sai routing rule",
      share: round1(pct(Math.round(total * 0.22), total)),
      count: Math.round(total * 0.22),
      color: "#f97316",
    },
    {
      key: "ops-address-error",
      label: "Sai mapping địa chỉ",
      share: round1(pct(Math.round(total * 0.16), total)),
      count: Math.round(total * 0.16),
      color: "#f59e0b",
    },
    {
      key: "service-unavail",
      label: "Service không hỗ trợ vùng",
      share: round1(pct(Math.round(total * 0.08), total)),
      count: Math.round(total * 0.08),
      color: "#84B26A",
    },
    {
      key: "other-gap",
      label: "Khác [GAP công thức]",
      share: round1(pct(Math.round(total * 0.26), total)),
      count: Math.round(total * 0.26),
      color: "#6b7280",
    },
  ];
}

export type DoiKhoCompare = {
  newAddress: number;
  oldAddress: number;
  overall: number;
  hnNewAddress: number;
  hcmNewAddress: number;
};

export function getDoiKhoCompare(filter: FilterState): DoiKhoCompare {
  const orders = filterOrders(filter);
  const newAddr = orders.filter((o) => o.phuongIsNew);
  const oldAddr = orders.filter((o) => !o.phuongIsNew);
  const hnNew = orders.filter((o) => o.phuongIsNew && o.provinceCode === "HNI");
  const hcmNew = orders.filter((o) => o.phuongIsNew && o.provinceCode === "HCM");

  return {
    newAddress: round1(pct(newAddr.filter((o) => o.isChangedWarehouse).length, newAddr.length)),
    oldAddress: round1(pct(oldAddr.filter((o) => o.isChangedWarehouse).length, oldAddr.length)),
    overall: round1(pct(orders.filter((o) => o.isChangedWarehouse).length, orders.length || 1)),
    hnNewAddress: round1(pct(hnNew.filter((o) => o.isChangedWarehouse).length, hnNew.length || 1)),
    hcmNewAddress: round1(pct(hcmNew.filter((o) => o.isChangedWarehouse).length, hcmNew.length || 1)),
  };
}

/**
 * Đổi kho breakdown: 1 overall + 4 segment (HCM/HN × phường mới/cũ).
 * Mỗi segment = tỷ lệ đổi kho TRONG segment đó (drill từ overall).
 */
export type DoiKhoBreakdown = {
  key: string;
  label: string;
  rate: number;       // % đổi kho trong segment
  count: number;      // số đơn đổi kho
  segmentTotal: number; // tổng đơn segment
  status: Status;
};

export function getDoiKhoBreakdown(filter: FilterState): DoiKhoBreakdown[] {
  const orders = filterOrders(filter);
  const seg = (
    key: string,
    label: string,
    pool: typeof orders,
    green: number,
    amber: number,
  ): DoiKhoBreakdown => {
    const count = pool.filter((o) => o.isChangedWarehouse).length;
    const rate = pool.length > 0 ? round1(pct(count, pool.length)) : 0;
    return {
      key,
      label,
      rate,
      count,
      segmentTotal: pool.length,
      status: rate <= green ? "green" : rate <= amber ? "amber" : "red",
    };
  };

  const hcm = orders.filter((o) => o.provinceCode === "HCM");
  const hn = orders.filter((o) => o.provinceCode === "HNI");

  return [
    seg("overall", "Overall (toàn bộ)", orders, 1.5, 2.3),
    seg("hcm-new", "HCM · phường mới", hcm.filter((o) => o.phuongIsNew), 10, 14),
    seg("hcm-old", "HCM · phường cũ", hcm.filter((o) => !o.phuongIsNew), 2, 4),
    seg("hn-new", "HN · phường mới", hn.filter((o) => o.phuongIsNew), 10, 17),
    seg("hn-old", "HN · phường cũ", hn.filter((o) => !o.phuongIsNew), 2, 4),
  ];
}

// =============================================================================
// PHASE 5a — /network scorecard
// =============================================================================

export type RegionScorecardRow = {
  regionCode: RegionCode;
  regionName: string;
  totalOrders: number;
  ontimeNetwork: number;
  costPerKg: number;
  pctTC: number;
  hangVeBc4Ca: number;
  doiKho: number;
  status: Status;
};

export function getRegionScorecard(filter: FilterState): RegionScorecardRow[] {
  const regions = HEATMAP_REGIONS;
  return regions.map((r) => {
    const sub: FilterState = { ...filter, regionCode: r.code };
    const orders = filterOrders(sub);
    const orderIds = new Set(orders.map((o) => o.orderId));
    const trips = filterTrips(sub);
    const ontime = computeOntimeNetwork(orders);
    const cpk = regionCostPerKg(r.code, computeCostPerKg(trips));
    const tc = computePctTc(orderIds);
    const h4 = computeHangVeBc4Ca(orders);
    const dk = computeDoiKhoOverall(orders);
    const stat = worstStatus(
      statusFromValue(KPI.ontimeNetwork, ontime),
      statusFromValue(KPI.pctTC, tc),
      statusFromValue(KPI.hangVeBc4Ca, h4),
    );
    return {
      regionCode: r.code,
      regionName: r.name,
      totalOrders: orders.length,
      ontimeNetwork: ontime,
      costPerKg: cpk,
      pctTC: tc,
      hangVeBc4Ca: h4,
      doiKho: dk,
      status: stat,
    };
  });
}

export type KtcScorecardRow = {
  ktcCode: string;
  ktcName: string;
  region: RegionCode;
  ordersIn: number;
  ordersOut: number;
  ltAvgH: number;
  fillRateKg: number;
  status: Status;
};

export function getKtcScorecard(filter: FilterState): KtcScorecardRow[] {
  const orders = filterOrders(filter);
  const trips = filterTrips(filter);

  const ordersByKtc = new Map<string, FactOrder[]>();
  for (const o of orders) {
    if (!ordersByKtc.has(o.ktcCode)) ordersByKtc.set(o.ktcCode, []);
    ordersByKtc.get(o.ktcCode)!.push(o);
  }

  const tripsByKtc = new Map<string, FactTrip[]>();
  for (const t of trips) {
    if (t.ktcCode) {
      if (!tripsByKtc.has(t.ktcCode)) tripsByKtc.set(t.ktcCode, []);
      tripsByKtc.get(t.ktcCode)!.push(t);
    }
  }

  const rows: KtcScorecardRow[] = [];
  for (const [code, os] of ordersByKtc.entries()) {
    const ts = tripsByKtc.get(code) ?? [];
    const region = (os[0]?.regionCode ?? "HNO") as RegionCode;
    const fillKg =
      ts.length > 0 ? round1((ts.reduce((a, b) => a + b.fillRateKg, 0) / ts.length) * 100) : 0;
    const finishedOrders = os.filter((o) => o.deliveredTs);
    const ltAvg =
      finishedOrders.length > 0
        ? round1(
            finishedOrders.reduce(
              (a, o) =>
                a +
                (new Date(o.deliveredTs!).getTime() -
                  new Date(o.createdTs).getTime()) /
                  3600000,
              0,
            ) / finishedOrders.length,
          )
        : 0;
    rows.push({
      ktcCode: code,
      ktcName: code.replace(/-/g, " "),
      region,
      ordersIn: os.length,
      ordersOut: Math.round(os.length * 0.97),
      ltAvgH: ltAvg,
      fillRateKg: fillKg,
      status:
        fillKg >= 75 && ltAvg < 48 ? "green" : fillKg >= 60 && ltAvg < 60 ? "amber" : "red",
    });
  }
  return rows.sort((a, b) => b.ordersIn - a.ordersIn);
}

// =============================================================================
// PHASE 5b — /transport
// =============================================================================

export type TransportKpis = {
  ontimeTrip: number;
  fillRateKg: number;
  fillRateOrder: number;
  emptyMileage: number;
  avgCostPerKm: number;
  totalTrips: number;
  totalParcels: number;
  // Bổ sung theo spec
  opr: number;          // Order Performance Rate 90-97%
  odr: number;          // On-time Delivery Rate 90-97%
  ontimeLayHang: number; // đơn lấy đúng cutoff 49%→85%+
  fdRate: number;       // FD 4-10%
  aov: number;          // Average Order Value 18-35k đ
  leadtimeGanH: number; // ~1.5h
  leadtimeLtcH: number; // ~4h
};

export function getTransportKpis(filter: FilterState): TransportKpis {
  const trips = filterTrips(filter);
  const totalKm = trips.reduce((a, b) => a + b.totalKm, 0);
  const totalCost = trips.reduce((a, b) => a + b.cost, 0);

  const orders = filterOrders(filter);
  const orderIds = new Set(orders.map((o) => o.orderId));
  const pickups = filterPickups(filter, orderIds);

  // OPR ~ on-time arrival of trips, scaled to 90-97 range
  const ontimeTrip = computeOntimeVanTai(trips);
  const opr = round1(Math.min(97, Math.max(90, ontimeTrip)));
  // ODR ~ ontime delivery of orders
  const odr = round1(
    Math.min(97, Math.max(90, computeOntimeNetwork(orders) + 2)),
  );
  // Ontime lấy hàng = % pickup đúng cutoff
  const ontimeLayHang = computePctLtc(pickups);
  // FD rate
  const fdRate = computeFailedDeliveryRate(orderIds);
  // AOV — tổng cước phí / số đơn (mock: cước ~18-35k tỉ lệ weight)
  const totalCuoc = orders.reduce(
    (a, o) => a + (18_000 + Math.min(17_000, o.weightKg * 800)),
    0,
  );
  const aov = orders.length > 0 ? Math.round(totalCuoc / orders.length) : 0;
  // Leadtime gán + LTC từ pickups
  const leadtimeGanH =
    pickups.length > 0
      ? round1(
          pickups.reduce((a, p) => a + p.leadtimeAssignSec, 0) /
            pickups.length /
            3600,
        )
      : 0;
  const leadtimeLtcH =
    pickups.length > 0
      ? round1(
          pickups.reduce((a, p) => a + p.leadtimeLtcSec, 0) /
            pickups.length /
            3600,
        )
      : 0;

  return {
    ontimeTrip,
    fillRateKg: computeFillRateKg(trips),
    fillRateOrder: computeFillRateOrder(trips),
    emptyMileage: computeEmptyMileage(trips),
    avgCostPerKm: totalKm > 0 ? Math.round(totalCost / totalKm) : 0,
    totalTrips: trips.length,
    totalParcels: trips.reduce((a, b) => a + b.parcels, 0),
    opr,
    odr,
    ontimeLayHang,
    fdRate,
    aov,
    leadtimeGanH,
    leadtimeLtcH,
  };
}

export type TransportTripRow = {
  tripId: string;
  type: string;
  origin: string;
  dest: string;
  planDepart: string;
  fillRateKg: number;
  parcels: number;
  cost: number;
  vehicle: string;
  carrier: string;
  status: Status;
};

export function getTransportTrips(filter: FilterState, limit = 50): TransportTripRow[] {
  const trips = filterTrips(filter)
    .slice(0, 5000)
    .sort((a, b) => b.planDepart.localeCompare(a.planDepart))
    .slice(0, limit);

  return trips.map((t) => {
    const planMs = new Date(t.planArrive).getTime();
    const actMs = new Date(t.actualArrive).getTime();
    const late = (actMs - planMs) / 60000;
    return {
      tripId: t.tripId,
      type: t.type.toUpperCase(),
      origin: t.originCode,
      dest: t.destCode,
      planDepart: t.planDepart,
      fillRateKg: round1(t.fillRateKg * 100),
      parcels: t.parcels,
      cost: t.cost,
      vehicle: t.vehicleType,
      carrier: t.carrier,
      status: late <= 15 ? "green" : late <= 60 ? "amber" : "red",
    };
  });
}

export type TransportCarrierRow = {
  carrier: string;
  trips: number;
  ontime: number;
  fillRateKg: number;
  avgCost: number;
  status: Status;
};

export function getTransportByCarrier(filter: FilterState): TransportCarrierRow[] {
  const trips = filterTrips(filter);
  const carriers = ["internal", "tpl-a", "tpl-b", "tpl-c"];
  return carriers.map((c) => {
    const ts = trips.filter((t) => t.carrier === c);
    const ontime = computeOntimeVanTai(ts);
    const fk = computeFillRateKg(ts);
    return {
      carrier: c === "internal" ? "Nội bộ" : c.toUpperCase(),
      trips: ts.length,
      ontime,
      fillRateKg: fk,
      avgCost: ts.length > 0 ? Math.round(ts.reduce((a, b) => a + b.cost, 0) / ts.length) : 0,
      status: statusFromValue(KPI.ontimeVanTai, ontime),
    };
  });
}

export type TransportRouteTypeRow = {
  type: string;
  trips: number;
  fillRateKg: number;
  avgKm: number;
  emptyPct: number;
};

export function getTransportByRouteType(filter: FilterState): TransportRouteTypeRow[] {
  const trips = filterTrips(filter);
  const types = [
    { key: "fm", label: "FM (BC → KTC)" },
    { key: "lh", label: "LH (KTC ↔ KTC)" },
    { key: "lm", label: "LM (KTC → BC)" },
    { key: "rt", label: "RT (Return)" },
  ];
  return types.map((t) => {
    const ts = trips.filter((x) => x.type === t.key);
    return {
      type: t.label,
      trips: ts.length,
      fillRateKg: computeFillRateKg(ts),
      avgKm:
        ts.length > 0 ? Math.round(ts.reduce((a, b) => a + b.totalKm, 0) / ts.length) : 0,
      emptyPct: computeEmptyMileage(ts),
    };
  });
}


// =============================================================================
// PHASE 6 — Transport: bảng sức khoẻ tuyến (lane = nhiều trip)
// =============================================================================

export type LaneHealthRow = {
  laneCode: string;       // origin→dest
  origin: string;
  dest: string;
  trips: number;
  ontime: number;
  fillRateKg: number;
  emptyPct: number;
  avgCost: number;
  totalParcels: number;
  status: Status;
};

export function getLaneHealth(filter: FilterState, limit = 30): LaneHealthRow[] {
  const trips = filterTrips(filter);
  const map = new Map<string, FactTrip[]>();
  for (const t of trips) {
    const key = `${t.originCode}->${t.destCode}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  const rows: LaneHealthRow[] = [];
  for (const [key, ts] of map.entries()) {
    if (ts.length < 2) continue; // chỉ tuyến có ≥2 trip mới gọi là "lane"
    const [origin, dest] = key.split("->");
    const ontime = computeOntimeVanTai(ts);
    const fillKg = computeFillRateKg(ts);
    const empty = computeEmptyMileage(ts);
    const status = worstStatus(
      statusFromValue(KPI.ontimeVanTai, ontime),
      statusFromValue(KPI.fillRateKg, fillKg),
      statusFromValue(KPI.pctEmptyMileage, empty),
    );
    rows.push({
      laneCode: key,
      origin,
      dest,
      trips: ts.length,
      ontime,
      fillRateKg: fillKg,
      emptyPct: empty,
      avgCost: Math.round(ts.reduce((a, b) => a + b.cost, 0) / ts.length),
      totalParcels: ts.reduce((a, b) => a + b.parcels, 0),
      status,
    });
  }
  return rows.sort((a, b) => b.trips - a.trips).slice(0, limit);
}

/** Danh sách mã tuyến cho filter dropdown. */
export function getLaneCodesForFilter(filter: FilterState): { value: string; label: string }[] {
  return getLaneHealth(filter, 60).map((l) => ({
    value: l.laneCode,
    label: `${l.origin} → ${l.dest} (${l.trips} trip)`,
  }));
}

// =============================================================================
// PHASE 6 — Network: BC state count + drill-down + sub-metrics
// =============================================================================

export type RegionBcStateRow = {
  regionCode: RegionCode;
  regionName: string;
  totalBc: number;
  stable: number;       // ổn định
  overload: number;     // quá tải (đơn pending sort cao)
  slaBreach: number;    // vượt SLA
  costBreach: number;   // vượt cost target
};

/** Đếm BC theo trạng thái trong từng vùng. Deterministic theo BC code hash. */
export function getRegionBcStates(filter: FilterState): RegionBcStateRow[] {
  const bcs = getBcs();
  return HEATMAP_REGIONS.map((r) => {
    const regionBcs = bcs.filter((b) => b.regionCode === r.code);
    let stable = 0,
      overload = 0,
      slaBreach = 0,
      costBreach = 0;
    for (const b of regionBcs) {
      // Hash code → phân loại deterministic
      const h = b.code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const r1 = (h % 100) / 100;
      if (r1 < 0.7) stable += 1;
      else if (r1 < 0.82) overload += 1;
      else if (r1 < 0.92) slaBreach += 1;
      else costBreach += 1;
    }
    return {
      regionCode: r.code,
      regionName: r.name,
      totalBc: regionBcs.length,
      stable,
      overload,
      slaBreach,
      costBreach,
    };
  }).sort((a, b) => b.totalBc - a.totalBc);
}

export type BcDrillRow = {
  bcCode: string;
  bcName: string;
  province: string;
  ordersHandled: number;
  pendingSort: number;
  tatHours: number;
  costPerKg: number;
  state: "stable" | "overload" | "slaBreach" | "costBreach";
  status: Status;
};

const BC_STATE_LABEL: Record<BcDrillRow["state"], string> = {
  stable: "Ổn định",
  overload: "Quá tải",
  slaBreach: "Vượt SLA",
  costBreach: "Vượt cost",
};

export function bcStateLabel(s: BcDrillRow["state"]): string {
  return BC_STATE_LABEL[s];
}

/** Drill xuống danh sách BC trong 1 vùng. */
export function getBcDrillByRegion(
  filter: FilterState,
  regionCode: RegionCode,
  limit = 50,
): BcDrillRow[] {
  const bcs = getBcs().filter((b) => b.regionCode === regionCode);
  const orders = filterOrders({ ...filter, regionCode });
  // Count orders by BC giao
  const orderCount = new Map<string, number>();
  for (const o of orders) {
    orderCount.set(o.bcGiaoCode, (orderCount.get(o.bcGiaoCode) ?? 0) + 1);
  }

  const rows: BcDrillRow[] = bcs.map((b) => {
    const h = b.code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const r1 = (h % 100) / 100;
    const state: BcDrillRow["state"] =
      r1 < 0.7 ? "stable" : r1 < 0.82 ? "overload" : r1 < 0.92 ? "slaBreach" : "costBreach";
    const ordersHandled = orderCount.get(b.code) ?? 0;
    const pendingSort = Math.round(ordersHandled * (state === "overload" ? 0.25 : 0.08));
    const tatHours = round1(
      4 + (state === "slaBreach" ? 5 : state === "overload" ? 3 : 0) + (h % 10) / 10,
    );
    const costPerKg = Math.round(
      1850 + (state === "costBreach" ? 400 : 0) + (h % 200),
    );
    const status: Status =
      state === "stable" ? "green" : state === "overload" || state === "slaBreach" ? "amber" : "red";
    return {
      bcCode: b.code,
      bcName: b.name,
      province: b.provinceCode,
      ordersHandled,
      pendingSort,
      tatHours,
      costPerKg,
      state,
      status,
    };
  });
  return rows
    .sort((a, b) => b.ordersHandled - a.ordersHandled)
    .slice(0, limit);
}

// --- Network sub-metrics (tự suy công thức + mock visualize) -------------

export type NetworkSubMetric = {
  key: string;
  label: string;
  formula: string;
  value: number;
  unit: string;
  target: number;
  status: Status;
  trend: number[]; // 7-day sparkline
};

export function getNetworkSubMetrics(filter: FilterState): NetworkSubMetric[] {
  // Deterministic mock dựa trên filter
  const seed = `${filter.from}:${filter.to}:${filter.regionCode ?? ""}`;
  const h = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = (base: number, range: number, salt: number) =>
    round1(base + (((h + salt) % 100) / 100 - 0.5) * 2 * range);
  const spark = (base: number, range: number, salt: number) =>
    Array.from({ length: 7 }, (_, i) =>
      round1(base + (((h + salt + i * 7) % 100) / 100 - 0.5) * 2 * range),
    );

  const xuatKienOntime = jitter(94, 4, 1);
  const choNhapKtc = jitter(38, 12, 2);   // phút
  const tgSorting = jitter(52, 15, 3);    // phút
  const saiLechKlkt = jitter(1.8, 0.8, 4); // %
  const soLanQuaKtc = jitter(1.6, 0.4, 5); // lần

  return [
    {
      key: "xuat-kien-ontime",
      label: "% Xuất kiện ontime tại BC lấy",
      formula: "# kiện xuất đúng cutoff / # kiện cần xuất",
      value: xuatKienOntime,
      unit: "%",
      target: 95,
      status: xuatKienOntime >= 95 ? "green" : xuatKienOntime >= 90 ? "amber" : "red",
      trend: spark(94, 3, 1),
    },
    {
      key: "cho-nhap-ktc",
      label: "Thời gian chờ nhập KTC",
      formula: "AVG(received_at_ktc − arrive_at_ktc)",
      value: choNhapKtc,
      unit: "phút",
      target: 30,
      status: choNhapKtc <= 30 ? "green" : choNhapKtc <= 45 ? "amber" : "red",
      trend: spark(38, 8, 2),
    },
    {
      key: "tg-sorting",
      label: "Thời gian sorting tại KTC",
      formula: "AVG(packed_at_sorting − unpacked_at_sorting)",
      value: tgSorting,
      unit: "phút",
      target: 45,
      status: tgSorting <= 45 ? "green" : tgSorting <= 60 ? "amber" : "red",
      trend: spark(52, 10, 3),
    },
    {
      key: "sai-lech-klkt",
      label: "Tỷ lệ sai lệch KL kê khai (KLKT)",
      formula: "# đơn lệch KL > 10% / tổng đơn cân",
      value: saiLechKlkt,
      unit: "%",
      target: 1.5,
      status: saiLechKlkt <= 1.5 ? "green" : saiLechKlkt <= 3 ? "amber" : "red",
      trend: spark(1.8, 0.5, 4),
    },
    {
      key: "so-lan-qua-ktc",
      label: "TB số lần hàng đi qua KTC",
      formula: "SUM(hop count) / tổng đơn",
      value: soLanQuaKtc,
      unit: "lần",
      target: 1.5,
      status: soLanQuaKtc <= 1.5 ? "green" : soLanQuaKtc <= 2 ? "amber" : "red",
      trend: spark(1.6, 0.3, 5),
    },
  ];
}


// =============================================================================
// PHASE 6 — Alerts cho từng page (fact-based)
// =============================================================================

export function getRoutingAlerts(filter: FilterState): AlertItem[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  const out: AlertItem[] = [];

  const dk = computeDoiKhoOverall(orders);
  if (dk > KPI.doiKhoOverall.thresholds[1]) {
    out.push({
      id: "rt-doikho-high",
      severity: "warning",
      title: `Tỷ lệ đổi kho overall ${dk.toFixed(1)}% — vượt ngưỡng ${KPI.doiKhoOverall.thresholds[1]}%`,
    });
  }

  const newAddr = orders.filter((o) => o.phuongIsNew);
  const dkNew =
    newAddr.length > 0
      ? round1(pct(newAddr.filter((o) => o.isChangedWarehouse).length, newAddr.length))
      : 0;
  if (dkNew > 10) {
    out.push({
      id: "rt-doikho-new",
      severity: "warning",
      title: `Đổi kho địa chỉ MỚI ${dkNew.toFixed(1)}% — cần ưu tiên xây rule cho phường mới`,
    });
  }

  const revert = orders.filter((o) => o.isChangedWarehouse).length;
  out.push({
    id: "rt-cost-impact",
    severity: "info",
    title: `chi phí phát sinh do đổi kho (~10k đ/đơn) — kỳ này ${formatVNDShort(revert * 10000)}`,
    count: revert,
  });

  return out;
}

export function getNetworkAlerts(filter: FilterState): AlertItem[] {
  const out: AlertItem[] = [];
  const bcStates = getRegionBcStates(filter);
  const totalOverload = bcStates.reduce((a, b) => a + b.overload, 0);
  const totalSla = bcStates.reduce((a, b) => a + b.slaBreach, 0);
  const totalCost = bcStates.reduce((a, b) => a + b.costBreach, 0);

  if (totalOverload > 0)
    out.push({
      id: "nw-overload",
      severity: totalOverload > 80 ? "critical" : "warning",
      title: "BC đang quá tải (đơn chờ sort cao) — cần điều phối nhân lực",
      count: totalOverload,
    });
  if (totalSla > 0)
    out.push({
      id: "nw-sla",
      severity: "warning",
      title: "BC vượt SLA — TAT cao hơn ngưỡng",
      count: totalSla,
    });
  if (totalCost > 0)
    out.push({
      id: "nw-cost",
      severity: "warning",
      title: "BC vượt cost target — chi phí/kg cao",
      count: totalCost,
    });

  // KTC fill rate thấp
  const trips = filterTrips(filter);
  const fillKg = computeFillRateKg(trips);
  if (fillKg < KPI.fillRateKg.thresholds[1]) {
    out.push({
      id: "nw-fill",
      severity: "warning",
      title: `Fill rate kg trung bình ${fillKg.toFixed(1)}% — dưới ngưỡng ${KPI.fillRateKg.thresholds[1]}%`,
    });
  }
  return out;
}

export function getTransportAlerts(filter: FilterState): AlertItem[] {
  const out: AlertItem[] = [];
  const trips = filterTrips(filter);
  const ovt = computeOntimeVanTai(trips);
  const empty = computeEmptyMileage(trips);
  const fillKg = computeFillRateKg(trips);

  if (ovt < KPI.ontimeVanTai.thresholds[1])
    out.push({
      id: "tp-ontime",
      severity: "warning",
      title: `Ontime vận tải ${ovt.toFixed(1)}% — dưới ngưỡng ${KPI.ontimeVanTai.thresholds[1]}%`,
    });
  if (empty > KPI.pctEmptyMileage.thresholds[1])
    out.push({
      id: "tp-empty",
      severity: "warning",
      title: `% Empty mileage ${empty.toFixed(1)}% — vượt ngưỡng ${KPI.pctEmptyMileage.thresholds[1]}% (chuyến rỗng chiều về)`,
    });
  // Lane fill rate thấp
  const lanes = getLaneHealth(filter, 60);
  const lowFill = lanes.filter((l) => l.fillRateKg < 50).length;
  if (lowFill > 0)
    out.push({
      id: "tp-lowfill",
      severity: "info",
      title: "tuyến có fill rate < 50% — cân nhắc gộp chuyến",
      count: lowFill,
    });
  return out;
}

export function getJourneyAlerts(filter: FilterState): AlertItem[] {
  const orders = filterOrders(filter);
  const out: AlertItem[] = [];

  const lost = orders.filter((o) => o.finalStatus === "lost").length;
  if (lost > 0)
    out.push({
      id: "jn-lost",
      severity: lost > 50 ? "critical" : "warning",
      title: "đơn thất lạc — cần investigate ngay",
      count: lost,
    });

  const exc = orders.filter((o) => o.finalStatus === "exception").length;
  if (exc > 0)
    out.push({
      id: "jn-exc",
      severity: "warning",
      title: "đơn exception / hư hỏng",
      count: exc,
    });

  const toMs = new Date(filter.to + "T23:59:00").getTime();
  const stuck = orders.filter(
    (o) =>
      o.finalStatus === "in_progress" &&
      toMs - new Date(o.createdTs).getTime() > 3 * 24 * 3600 * 1000,
  ).length;
  if (stuck > 0)
    out.push({
      id: "jn-stuck",
      severity: stuck > 100 ? "critical" : "warning",
      title: "đơn đang xử lý quá 3 ngày — chưa cập nhật trạng thái cuối",
      count: stuck,
    });

  return out;
}

function formatVNDShort(n: number): string {
  if (n >= 1_000_000_000) return `${round1(n / 1_000_000_000)} tỷ`;
  if (n >= 1_000_000) return `${round1(n / 1_000_000)} tr`;
  return `${Math.round(n / 1000)}k`;
}


// =============================================================================
// PHASE 7 — Network sub-metrics dạng BẢNG theo vùng (drill xuống BC)
// =============================================================================

export type NetworkSubMetricRegionRow = {
  regionCode: RegionCode;
  regionName: string;
  totalBc: number;
  xuatKienOntime: number;  // %
  choNhapKtc: number;      // phút
  tgSorting: number;       // phút
  saiLechKlkt: number;     // %
  soLanQuaKtc: number;     // lần
  status: Status;
};

export function getNetworkSubMetricsByRegion(
  filter: FilterState,
): NetworkSubMetricRegionRow[] {
  const bcs = getBcs();
  return HEATMAP_REGIONS.map((r) => {
    const regionBcs = bcs.filter((b) => b.regionCode === r.code);
    // Deterministic theo region code + penalty
    const h = r.code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const factor = REGION_COST_FACTOR[r.code] ?? 1; // vùng xa kém hơn
    const jit = (base: number, range: number, salt: number) =>
      round1(base + (((h + salt) % 100) / 100 - 0.5) * 2 * range);

    const xuatKienOntime = round1(jit(95, 2, 1) / factor);
    const choNhapKtc = round1(jit(34, 8, 2) * factor);
    const tgSorting = round1(jit(48, 10, 3) * factor);
    const saiLechKlkt = round1(jit(1.5, 0.6, 4) * factor);
    const soLanQuaKtc = round1(jit(1.5, 0.3, 5) * factor);

    const status = worstStatus(
      xuatKienOntime >= 95 ? "green" : xuatKienOntime >= 90 ? "amber" : "red",
      choNhapKtc <= 30 ? "green" : choNhapKtc <= 45 ? "amber" : "red",
      tgSorting <= 45 ? "green" : tgSorting <= 60 ? "amber" : "red",
    );

    return {
      regionCode: r.code,
      regionName: r.name,
      totalBc: regionBcs.length,
      xuatKienOntime,
      choNhapKtc,
      tgSorting,
      saiLechKlkt,
      soLanQuaKtc,
      status,
    };
  }).sort((a, b) => b.totalBc - a.totalBc);
}

/** Sub-metrics chi tiết của từng BC trong 1 vùng (drill). */
export type BcSubMetricRow = {
  bcCode: string;
  bcName: string;
  province: string;
  xuatKienOntime: number;
  choNhapKtc: number;
  tgSorting: number;
  saiLechKlkt: number;
  status: Status;
};

export function getBcSubMetricsByRegion(
  filter: FilterState,
  regionCode: RegionCode,
  limit = 50,
): BcSubMetricRow[] {
  const bcs = getBcs().filter((b) => b.regionCode === regionCode);
  const orders = filterOrders({ ...filter, regionCode });
  const orderCount = new Map<string, number>();
  for (const o of orders)
    orderCount.set(o.bcGiaoCode, (orderCount.get(o.bcGiaoCode) ?? 0) + 1);

  return bcs
    .map((b) => {
      const h = b.code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const j = (base: number, range: number, salt: number) =>
        round1(base + (((h + salt) % 100) / 100 - 0.5) * 2 * range);
      const xuatKienOntime = j(94, 5, 1);
      const choNhapKtc = j(36, 14, 2);
      const tgSorting = j(50, 16, 3);
      const saiLechKlkt = j(1.7, 1, 4);
      const status = worstStatus(
        xuatKienOntime >= 95 ? "green" : xuatKienOntime >= 90 ? "amber" : "red",
        choNhapKtc <= 30 ? "green" : choNhapKtc <= 45 ? "amber" : "red",
        tgSorting <= 45 ? "green" : tgSorting <= 60 ? "amber" : "red",
      );
      return {
        bcCode: b.code,
        bcName: b.name,
        province: b.provinceCode,
        ordersHandled: orderCount.get(b.code) ?? 0,
        xuatKienOntime,
        choNhapKtc,
        tgSorting,
        saiLechKlkt,
        status,
      };
    })
    .sort((a, b) => b.ordersHandled - a.ordersHandled)
    .slice(0, limit)
    .map(({ ordersHandled, ...rest }) => {
      void ordersHandled;
      return rest;
    });
}

// =============================================================================
// PHASE 7 — Network graph (KTC nodes + lane edges)
// =============================================================================

export type NetworkGraphNode = {
  code: string;
  name: string;
  region: RegionCode;
  throughput: number;
  status: Status;
};

export type NetworkGraphEdge = {
  from: string;
  to: string;
  trips: number;
  ontime: number;
  status: Status;
};

export function getNetworkGraph(filter: FilterState): {
  nodes: NetworkGraphNode[];
  edges: NetworkGraphEdge[];
} {
  const trips = filterTrips(filter);
  const ktcs = getKtcs();

  // Throughput mỗi KTC = số trip đi qua (origin hoặc dest là KTC đó)
  const tp = new Map<string, number>();
  for (const t of trips) {
    if (t.ktcCode) tp.set(t.ktcCode, (tp.get(t.ktcCode) ?? 0) + t.parcels);
  }

  const nodes: NetworkGraphNode[] = ktcs.map((k) => {
    const throughput = tp.get(k.code) ?? 0;
    return {
      code: k.code,
      name: k.name,
      region: k.regionCode,
      throughput,
      status: "green",
    };
  });

  // Edges = lanes (LH trips between KTCs)
  const edgeMap = new Map<string, { trips: number; ontimeCount: number }>();
  for (const t of trips) {
    if (t.type !== "lh") continue;
    const key = `${t.originCode}|${t.destCode}`;
    let cur = edgeMap.get(key);
    if (!cur) {
      cur = { trips: 0, ontimeCount: 0 };
      edgeMap.set(key, cur);
    }
    cur.trips += 1;
    const late =
      (new Date(t.actualArrive).getTime() - new Date(t.planArrive).getTime()) /
      60000;
    if (late <= 15) cur.ontimeCount += 1;
  }

  const ktcCodes = new Set(ktcs.map((k) => k.code));
  const edges: NetworkGraphEdge[] = [];
  for (const [key, e] of edgeMap.entries()) {
    const [from, to] = key.split("|");
    if (!ktcCodes.has(from) || !ktcCodes.has(to)) continue;
    const ontime = round1(pct(e.ontimeCount, e.trips));
    edges.push({
      from,
      to,
      trips: e.trips,
      ontime,
      status: ontime >= 95 ? "green" : ontime >= 90 ? "amber" : "red",
    });
  }

  return { nodes, edges: edges.sort((a, b) => b.trips - a.trips).slice(0, 40) };
}


// =============================================================================
// PHASE 7 — Weekly KPI report (tuần này vs tuần trước)
// =============================================================================

export type WeeklyKpiRow = {
  key: string;
  label: string;
  unit: "%" | "VND" | "đơn";
  thisWeek: number;
  lastWeek: number;
  delta: number;        // thisWeek - lastWeek
  target: number;
  status: Status;
  higherBetter: boolean;
};

function shiftRange(from: string, to: string, days: number): { from: string; to: string } {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T00:00:00");
  f.setDate(f.getDate() - days);
  t.setDate(t.getDate() - days);
  return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) };
}

export function getWeeklyKpiReport(filter: FilterState): WeeklyKpiRow[] {
  // This week = last 7 days ending filter.to; last week = 7 days before that.
  const thisW: FilterState = { ...filter, from: lastNDays(7, filter.to)[0], to: filter.to };
  const prev = shiftRange(thisW.from, thisW.to, 7);
  const lastW: FilterState = { ...filter, from: prev.from, to: prev.to };

  const oThis = filterOrders(thisW);
  const oLast = filterOrders(lastW);
  const tThis = filterTrips(thisW);
  const tLast = filterTrips(lastW);
  const idThis = new Set(oThis.map((o) => o.orderId));
  const idLast = new Set(oLast.map((o) => o.orderId));

  const mk = (
    key: string,
    label: string,
    unit: WeeklyKpiRow["unit"],
    tw: number,
    lw: number,
    target: number,
    green: number,
    amber: number,
    higherBetter: boolean,
  ): WeeklyKpiRow => ({
    key,
    label,
    unit,
    thisWeek: tw,
    lastWeek: lw,
    delta: round1(tw - lw),
    target,
    higherBetter,
    status: higherBetter
      ? tw >= green
        ? "green"
        : tw >= amber
          ? "amber"
          : "red"
      : tw <= green
        ? "green"
        : tw <= amber
          ? "amber"
          : "red",
  });

  return [
    mk("ontime", "Ontime Network", "%", computeOntimeNetwork(oThis), computeOntimeNetwork(oLast), 90, 90, 88, true),
    mk("tc", "% Giao thành công", "%", computePctTc(idThis), computePctTc(idLast), 92, 92, 88, true),
    mk("fd", "FD (Failed Delivery)", "%", computeFailedDeliveryRate(idThis), computeFailedDeliveryRate(idLast), 5, 5, 10, false),
    mk("hang4ca", "% Hàng về BC ≥4 ca", "%", computeHangVeBc4Ca(oThis), computeHangVeBc4Ca(oLast), 90, 90, 85, true),
    mk("doikho", "Tỷ lệ đổi kho", "%", computeDoiKhoOverall(oThis), computeDoiKhoOverall(oLast), 1.5, 1.5, 2.3, false),
    mk("costkg", "Cost / kg", "VND", computeCostPerKg(tThis), computeCostPerKg(tLast), 1853, 1970, 2057, false),
    mk("ontimeVT", "Ontime vận tải", "%", computeOntimeVanTai(tThis), computeOntimeVanTai(tLast), 95, 95, 93, true),
    mk("fillkg", "Fill rate kg", "%", computeFillRateKg(tThis), computeFillRateKg(tLast), 75, 75, 60, true),
    mk("empty", "% Empty mileage", "%", computeEmptyMileage(tThis), computeEmptyMileage(tLast), 20, 20, 30, false),
    mk("volume", "Sản lượng", "đơn", oThis.length, oLast.length, 0, 0, 0, true),
  ];
}


// =============================================================================
// PHASE 8 — Sankey data cho /journey (order flow)
// =============================================================================

export type SankeyData = {
  nodes: { name: string }[];
  links: { source: number; target: number; value: number }[];
};

/**
 * Sankey order flow:
 *   Tạo đơn → Đã lấy / Huỷ
 *   Đã lấy → Nhập KTC
 *   Nhập KTC → Tại BC giao
 *   Tại BC giao → GTC / Giao thất bại
 *   Giao thất bại → Trả TC / Trả thất bại / Thất lạc
 */
export function getJourneySankey(filter: FilterState): SankeyData {
  const orders = filterOrders(filter);
  const total = orders.length;
  const cancelled = orders.filter((o) => o.finalStatus === "cancelled").length;
  const picked = orders.filter((o) => o.pickedTs).length;
  const delivered = orders.filter((o) => o.finalStatus === "delivered").length;
  const gtb = orders.filter((o) => o.finalStatus === "delivery_failed").length;
  const retSucc = orders.filter((o) => o.finalStatus === "returned_success").length;
  const retFail = orders.filter((o) => o.finalStatus === "returned_failed").length;
  const lost = orders.filter((o) => o.finalStatus === "lost").length;
  const exception = orders.filter((o) => o.finalStatus === "exception").length;
  const inProgress = orders.filter((o) => o.finalStatus === "in_progress").length;

  // node index
  const N = {
    tao: 0,
    daLay: 1,
    huy: 2,
    nhapKtc: 3,
    bcGiao: 4,
    giaoTC: 5,
    giaoTB: 6,
    traTC: 7,
    traTB: 8,
    thatLac: 9,
    dangXuLy: 10,
  };
  const nodes = [
    { name: "Tạo đơn" },
    { name: "Đã lấy" },
    { name: "Huỷ" },
    { name: "Nhập KTC" },
    { name: "Tại BC giao" },
    { name: "Giao thành công" },
    { name: "Giao thất bại" },
    { name: "Trả thành công" },
    { name: "Trả thất bại" },
    { name: "Thất lạc / Exception" },
    { name: "Đang xử lý" },
  ];

  // flows
  const atKtc = Math.round(picked * 0.99);
  const atBcGiao = Math.round(atKtc * 0.98);

  const links = [
    { source: N.tao, target: N.daLay, value: Math.max(1, picked) },
    { source: N.tao, target: N.huy, value: Math.max(1, cancelled) },
    { source: N.daLay, target: N.nhapKtc, value: Math.max(1, atKtc) },
    { source: N.nhapKtc, target: N.bcGiao, value: Math.max(1, atBcGiao) },
    { source: N.bcGiao, target: N.giaoTC, value: Math.max(1, delivered) },
    {
      source: N.bcGiao,
      target: N.giaoTB,
      value: Math.max(1, gtb + retSucc + retFail),
    },
    { source: N.bcGiao, target: N.dangXuLy, value: Math.max(1, inProgress) },
    { source: N.giaoTB, target: N.traTC, value: Math.max(1, retSucc) },
    { source: N.giaoTB, target: N.traTB, value: Math.max(1, retFail) },
    {
      source: N.giaoTB,
      target: N.thatLac,
      value: Math.max(1, lost + exception),
    },
  ];

  void total;
  return { nodes, links };
}


// =============================================================================
// PHASE 8 — GPS map cho /transport (vị trí KTC + trip stop points)
// =============================================================================

// Toạ độ địa lý xấp xỉ (lat,lng) của các tỉnh có KTC. Dùng để vẽ map.
const PROVINCE_GEO: Record<string, { lat: number; lng: number }> = {
  HNI: { lat: 21.03, lng: 105.85 },
  HPG: { lat: 20.86, lng: 106.68 },
  QNH: { lat: 21.01, lng: 107.29 },
  BNH: { lat: 21.18, lng: 106.06 },
  HDG: { lat: 20.94, lng: 106.33 },
  NDH: { lat: 20.42, lng: 106.17 },
  TNG: { lat: 21.59, lng: 105.84 },
  HYE: { lat: 20.85, lng: 106.05 },
  BGI: { lat: 21.27, lng: 106.19 },
  VPC: { lat: 21.31, lng: 105.6 },
  PTO: { lat: 21.32, lng: 105.4 },
  LSN: { lat: 21.85, lng: 106.76 },
  THA: { lat: 19.81, lng: 105.78 },
  NAN: { lat: 18.67, lng: 105.69 },
  HTI: { lat: 18.34, lng: 105.9 },
  HUE: { lat: 16.46, lng: 107.59 },
  DNG: { lat: 16.05, lng: 108.2 },
  QNM: { lat: 15.57, lng: 108.47 },
  QBI: { lat: 17.47, lng: 106.6 },
  BDI: { lat: 13.78, lng: 109.22 },
  KHA: { lat: 12.24, lng: 109.19 },
  DLA: { lat: 12.71, lng: 108.24 },
  HCM: { lat: 10.82, lng: 106.63 },
  BDG: { lat: 11.0, lng: 106.65 },
  DNI: { lat: 10.95, lng: 106.82 },
  VTU: { lat: 10.41, lng: 107.14 },
  LAN: { lat: 10.6, lng: 106.65 },
  CTO: { lat: 10.04, lng: 105.78 },
  TGG: { lat: 10.36, lng: 106.36 },
  AGG: { lat: 10.52, lng: 105.13 },
  KGG: { lat: 10.01, lng: 105.08 },
  BTR: { lat: 10.24, lng: 106.38 },
  STG: { lat: 9.6, lng: 105.97 },
  TYI: { lat: 11.31, lng: 106.1 },
};

export type MapNode = {
  code: string;
  name: string;
  lat: number;
  lng: number;
  throughput: number;
};

export type MapStop = {
  code: string;
  lat: number;
  lng: number;
  order: number;     // thứ tự stop trong trip
  label: string;
};

export type MapTripRoute = {
  tripId: string;
  stops: MapStop[];
  status: Status;
};

function geoOf(code: string): { lat: number; lng: number } | null {
  // code dạng "HCM-KTC01" hoặc "BC-HCM-001" → tách province
  let prov: string | undefined;
  if (code.startsWith("BC-")) prov = code.split("-")[1];
  else prov = code.split("-")[0];
  return prov && PROVINCE_GEO[prov] ? PROVINCE_GEO[prov] : null;
}

/** Nodes (KTC) cho map + tối đa N trip route gần nhất với stop points. */
export function getTransportMap(
  filter: FilterState,
  maxRoutes = 12,
): { nodes: MapNode[]; routes: MapTripRoute[] } {
  const ktcs = getKtcs();
  const trips = filterTrips(filter);

  const tp = new Map<string, number>();
  for (const t of trips) {
    if (t.ktcCode) tp.set(t.ktcCode, (tp.get(t.ktcCode) ?? 0) + t.parcels);
  }

  const nodes: MapNode[] = ktcs
    .map((k) => {
      const g = geoOf(k.code);
      if (!g) return null;
      return {
        code: k.code,
        name: k.name,
        lat: g.lat,
        lng: g.lng,
        throughput: tp.get(k.code) ?? 0,
      };
    })
    .filter((n): n is MapNode => n !== null);

  // Routes: lấy LH trips (KTC↔KTC) để vẽ tuyến rõ ràng nhất
  const lhTrips = trips
    .filter((t) => t.type === "lh")
    .sort((a, b) => b.parcels - a.parcels)
    .slice(0, maxRoutes);

  const routes: MapTripRoute[] = lhTrips
    .map((t) => {
      const og = geoOf(t.originCode);
      const dg = geoOf(t.destCode);
      if (!og || !dg) return null;
      const late =
        (new Date(t.actualArrive).getTime() - new Date(t.planArrive).getTime()) /
        60000;
      return {
        tripId: t.tripId,
        status: (late <= 15 ? "green" : late <= 60 ? "amber" : "red") as Status,
        stops: [
          { code: t.originCode, lat: og.lat, lng: og.lng, order: 1, label: t.originCode },
          { code: t.destCode, lat: dg.lat, lng: dg.lng, order: 2, label: t.destCode },
        ],
      };
    })
    .filter((r): r is MapTripRoute => r !== null);

  return { nodes, routes };
}
