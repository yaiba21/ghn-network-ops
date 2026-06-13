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
} from "./mock-data";
import { KPI, statusFromValue } from "./kpi-config";
import type {
  AlertItem,
  FactOrder,
  FactPickup,
  FactTrip,
  FilterState,
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
  const bcLoaiMap = new Map(getBcs().map((b) => [b.code, b.loaiBc]));
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
    if (filter.loaiBc && filter.loaiBc !== "all") {
      const lbc = bcLoaiMap.get(o.bcGiaoCode);
      if (lbc !== filter.loaiBc) return false;
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

function computePctTc(orderIds: Set<string>): number {
  // %TC = GTC attempts / tổng attempts
  const deliveries = getFactDeliveries().filter((d) => orderIds.has(d.orderId));
  if (deliveries.length === 0) return 0;
  return round1(
    pct(deliveries.filter((d) => d.outcome === "gtc").length, deliveries.length),
  );
}

function computePctTb(orderIds: Set<string>): number {
  const deliveries = getFactDeliveries().filter((d) => orderIds.has(d.orderId));
  if (deliveries.length === 0) return 0;
  return round1(
    pct(deliveries.filter((d) => d.outcome === "gtb").length, deliveries.length),
  );
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
  return round1(pct(orders.filter((o) => o.finalStatus === "returned").length, orders.length));
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
  nddAchieve: KpiValue;
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
  const ndd = computeNddAchieve(orders);
  const ovt = computeOntimeVanTai(trips);
  const dk = computeDoiKhoOverall(orders);

  // Sparkline 7 ngày: compute từng metric cho từng ngày
  const sparkOntime = sparkline7Days(filter, (f) => computeOntimeNetwork(filterOrders(f)));
  const sparkCpk = sparkline7Days(filter, (f) => computeCostPerKg(filterTrips(f)));
  const sparkHang = sparkline7Days(filter, (f) => computeHangVeBc4Ca(filterOrders(f)));
  const sparkNdd = sparkline7Days(filter, (f) => computeNddAchieve(filterOrders(f)));
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
    nddAchieve: buildKpi("nddAchieve", ndd, sparkNdd, delta(sparkNdd)),
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
        label: "%TC",
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
  const cols = ["Ontime Network", "Cost/kg", "%TC"];

  const cells: { row: string; col: string; value: number; status: Status }[] = [];

  for (const r of regions) {
    const subFilter: FilterState = { ...filter, regionCode: r.code };
    const orders = filterOrders(subFilter);
    const orderIds = new Set(orders.map((o) => o.orderId));
    const trips = filterTrips(subFilter);

    const ontime = computeOntimeNetwork(orders);
    const cpk = computeCostPerKg(trips);
    const tc = computePctTc(orderIds);

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
      col: "%TC",
      value: tc,
      status: statusFromValue(KPI.pctTC, tc),
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

  // 5) %TC thấp
  const tc = computePctTc(orderIds);
  if (tc < KPI.pctTC.thresholds[1]) {
    alerts.push({
      id: "low-tc",
      severity: "critical",
      title: `%TC đang ở ${tc.toFixed(1)}% — dưới ngưỡng ${KPI.pctTC.thresholds[1]}%`,
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

  const fillKg = computeFillRateKg(trips);
  const fillOrder = computeFillRateOrder(trips);
  const ontime = computeOntimeNetwork(orders);
  const ovt = computeOntimeVanTai(trips);

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
  ];
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
  const returned = orders.filter((o) => o.finalStatus === "returned");
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
  const returned = orders.filter((o) => o.finalStatus === "returned").length;
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

export type FinalStatusMixRow = {
  status: "delivered" | "returned" | "in_progress" | "lost";
  label: string;
  count: number;
  share: number;
  color: string;
};

export function getJourneyFinalStatusMix(filter: FilterState): FinalStatusMixRow[] {
  const orders = filterOrders(filter);
  const total = orders.length || 1;
  const counts = {
    delivered: orders.filter((o) => o.finalStatus === "delivered").length,
    returned: orders.filter((o) => o.finalStatus === "returned").length,
    in_progress: orders.filter((o) => o.finalStatus === "in_progress").length,
    lost: orders.filter((o) => o.finalStatus === "lost").length,
  };
  return [
    {
      status: "delivered",
      label: "Giao thành công",
      count: counts.delivered,
      share: round1(pct(counts.delivered, total)),
      color: "#10b981",
    },
    {
      status: "returned",
      label: "Hoàn người gửi",
      count: counts.returned,
      share: round1(pct(counts.returned, total)),
      color: "#f59e0b",
    },
    {
      status: "in_progress",
      label: "Đang xử lý",
      count: counts.in_progress,
      share: round1(pct(counts.in_progress, total)),
      color: "#6b7280",
    },
    {
      status: "lost",
      label: "Thất lạc / hư hỏng",
      count: counts.lost,
      share: round1(pct(counts.lost, total)),
      color: "#ef4444",
    },
  ];
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
  const returned = orders.filter((o) => o.finalStatus === "returned");

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

export type StageBreakdownRow = {
  bcOrKtc: string;
  type: "BC" | "KTC";
  region: string;
  throughput: number;
  ltMedianH: number;
  successRate: number;
  status: Status;
};

export function getStageBreakdown(
  filter: FilterState,
  stageKey: StageKey,
): StageBreakdownRow[] {
  const orders = filterOrders(filter);
  const isFirstMile = stageKey === "fm";

  // Group by BC for FM/LM, by KTC for KTC stages
  const map = new Map<string, { count: number; success: number; ltSum: number; ltN: number }>();
  for (const o of orders) {
    const node = isFirstMile ? o.bcLayCode : stageKey === "lm" ? o.bcGiaoCode : o.ktcCode;
    if (!node) continue;
    let cur = map.get(node);
    if (!cur) {
      cur = { count: 0, success: 0, ltSum: 0, ltN: 0 };
      map.set(node, cur);
    }
    cur.count += 1;
    if (o.finalStatus === "delivered") cur.success += 1;
    if (o.deliveredTs) {
      cur.ltSum +=
        (new Date(o.deliveredTs).getTime() - new Date(o.createdTs).getTime()) /
        3600000;
      cur.ltN += 1;
    }
  }

  const rows: StageBreakdownRow[] = [];
  for (const [code, agg] of map.entries()) {
    const sr = round1(pct(agg.success, agg.count));
    rows.push({
      bcOrKtc: code,
      type: code.startsWith("BC-") ? "BC" : "KTC",
      region: code.split("-")[1] ?? "—",
      throughput: agg.count,
      ltMedianH: agg.ltN > 0 ? round1(agg.ltSum / agg.ltN) : 0,
      successRate: sr,
      status: sr >= 90 ? "green" : sr >= 85 ? "amber" : "red",
    });
  }
  return rows.sort((a, b) => b.throughput - a.throughput).slice(0, 50);
}

// =============================================================================
// PHASE 4b — /routing extras
// =============================================================================

export type ChannelLayerFlow = {
  channel: string;
  channelLabel: string;
  ordersTotal: number;
  changedWh: number;
  newAddrChangedWh: number;
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
    return {
      channel: c.code,
      channelLabel: c.label,
      ordersTotal: channelOrders.length,
      changedWh: channelOrders.filter((o) => o.isChangedWarehouse).length,
      newAddrChangedWh: channelOrders.filter(
        (o) => o.isChangedWarehouse && o.phuongIsNew,
      ).length,
    };
  });
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
    const cpk = computeCostPerKg(trips);
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
};

export function getTransportKpis(filter: FilterState): TransportKpis {
  const trips = filterTrips(filter);
  const totalKm = trips.reduce((a, b) => a + b.totalKm, 0);
  const totalCost = trips.reduce((a, b) => a + b.cost, 0);
  return {
    ontimeTrip: computeOntimeVanTai(trips),
    fillRateKg: computeFillRateKg(trips),
    fillRateOrder: computeFillRateOrder(trips),
    emptyMileage: computeEmptyMileage(trips),
    avgCostPerKm: totalKm > 0 ? Math.round(totalCost / totalKm) : 0,
    totalTrips: trips.length,
    totalParcels: trips.reduce((a, b) => a + b.parcels, 0),
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
