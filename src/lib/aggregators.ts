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

export function getOverviewRegionHeatmap(filter: FilterState): HeatmapData {
  const regions: { code: RegionCode; name: string }[] = [
    { code: "bac", name: "Miền Bắc" },
    { code: "trung", name: "Miền Trung" },
    { code: "nam", name: "Miền Nam" },
  ];
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
