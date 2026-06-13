// KPI thresholds + status logic. Single source of truth for green/amber/red
// across cards, tables, and heatmaps.

import type { KpiDirection, KpiUnit, Status } from "./types";

export type KpiSpec = {
  key: string;
  label: string;
  unit: KpiUnit;
  direction: KpiDirection;
  baseline: number;
  target: number;
  // For higher-better: [green-min, amber-min]. <amber-min → red.
  // For lower-better: [green-max, amber-max]. >amber-max → red.
  thresholds: [number, number];
};

export const KPI: Record<string, KpiSpec> = {
  otdMidMile: {
    key: "otdMidMile",
    label: "OTD middle-mile",
    unit: "%",
    direction: "higher-better",
    baseline: 93.83,
    target: 95,
    thresholds: [95, 92],
  },
  costPerParcel: {
    key: "costPerParcel",
    label: "Chi phí / đơn linehaul",
    unit: "VND",
    direction: "lower-better",
    baseline: 8500,
    target: 7905,
    thresholds: [7905, 8925], // target, target+5%
  },
  fillRate: {
    key: "fillRate",
    label: "Fill rate xe",
    unit: "%",
    direction: "higher-better",
    baseline: 72,
    target: 80,
    thresholds: [80, 70],
  },
  onTimeCutOff: {
    key: "onTimeCutOff",
    label: "% trip đúng COT",
    unit: "%",
    direction: "higher-better",
    baseline: 92.5,
    target: 95,
    thresholds: [95, 90],
  },
  routingAccuracy: {
    key: "routingAccuracy",
    label: "Routing accuracy",
    unit: "%",
    direction: "higher-better",
    baseline: 98.5,
    target: 99,
    thresholds: [99, 97],
  },
  misRouteRate: {
    key: "misRouteRate",
    label: "Tỷ lệ mis-route",
    unit: "%",
    direction: "lower-better",
    baseline: 1.5,
    target: 1,
    thresholds: [1, 2],
  },
  latencyP50: {
    key: "latencyP50",
    label: "Latency P50",
    unit: "ms",
    direction: "lower-better",
    baseline: 120,
    target: 100,
    thresholds: [100, 180],
  },
  latencyP95: {
    key: "latencyP95",
    label: "Latency P95",
    unit: "ms",
    direction: "lower-better",
    baseline: 250,
    target: 200,
    thresholds: [200, 400],
  },
  latencyP99: {
    key: "latencyP99",
    label: "Latency P99",
    unit: "ms",
    direction: "lower-better",
    baseline: 480,
    target: 400,
    thresholds: [400, 700],
  },
  hubAssignSuccess: {
    key: "hubAssignSuccess",
    label: "% gán hub/BC thành công",
    unit: "%",
    direction: "higher-better",
    baseline: 99,
    target: 99.5,
    thresholds: [99.5, 98],
  },
  reRouteRate: {
    key: "reRouteRate",
    label: "% đơn cần re-route",
    unit: "%",
    direction: "lower-better",
    baseline: 2,
    target: 1.5,
    thresholds: [1.5, 3],
  },
  fallbackRate: {
    key: "fallbackRate",
    label: "% rơi vào fallback rule",
    unit: "%",
    direction: "lower-better",
    baseline: 1,
    target: 0.5,
    thresholds: [0.5, 1.5],
  },
  addressErrorRate: {
    key: "addressErrorRate",
    label: "% đơn lỗi địa chỉ",
    unit: "%",
    direction: "lower-better",
    baseline: 1.2,
    target: 0.8,
    thresholds: [0.8, 1.5],
  },
  sortAccuracy: {
    key: "sortAccuracy",
    label: "Sort accuracy KTC",
    unit: "%",
    direction: "higher-better",
    baseline: 99.2,
    target: 99.5,
    thresholds: [99.5, 98.5],
  },
  overstayRate: {
    key: "overstayRate",
    label: "% đơn lưu qua đêm",
    unit: "%",
    direction: "lower-better",
    baseline: 3,
    target: 2,
    thresholds: [2, 5],
  },
  missortRate: {
    key: "missortRate",
    label: "% đơn missort tại KTC",
    unit: "%",
    direction: "lower-better",
    baseline: 0.8,
    target: 0.5,
    thresholds: [0.5, 1.5],
  },
  forecastMape: {
    key: "forecastMape",
    label: "Forecast MAPE",
    unit: "%",
    direction: "lower-better",
    baseline: 12,
    target: 10,
    thresholds: [10, 15],
  },
  emptyBackhaul: {
    key: "emptyBackhaul",
    label: "% chuyến rỗng chiều về",
    unit: "%",
    direction: "lower-better",
    baseline: 25,
    target: 20,
    thresholds: [20, 30],
  },
  onTimeDeparture: {
    key: "onTimeDeparture",
    label: "On-time departure",
    unit: "%",
    direction: "higher-better",
    baseline: 93,
    target: 95,
    thresholds: [95, 90],
  },
  onTimeArrival: {
    key: "onTimeArrival",
    label: "On-time arrival",
    unit: "%",
    direction: "higher-better",
    baseline: 91,
    target: 95,
    thresholds: [95, 88],
  },
  tatHub: {
    key: "tatHub",
    label: "TAT tại KTC",
    unit: "h",
    direction: "lower-better",
    baseline: 6,
    target: 4,
    thresholds: [4, 8],
  },
  costPerKg: {
    key: "costPerKg",
    label: "Chi phí / kg",
    unit: "VND",
    direction: "lower-better",
    baseline: 2400,
    target: 2200,
    thresholds: [2200, 2700],
  },
  costPerKm: {
    key: "costPerKm",
    label: "Chi phí / km",
    unit: "VND",
    direction: "lower-better",
    baseline: 18000,
    target: 16000,
    thresholds: [16000, 21000],
  },
  costPerOrder: {
    key: "costPerOrder",
    label: "Chi phí / đơn linehaul",
    unit: "VND",
    direction: "lower-better",
    baseline: 8500,
    target: 7905,
    thresholds: [7905, 8925],
  },
  // --- Journey: Stage 1 — Nhận hàng (Pickup) -----------------------------
  firstAttemptRate: {
    key: "firstAttemptRate",
    label: "% Giao TC lần 1",
    unit: "%",
    direction: "higher-better",
    baseline: 82,
    target: 85,
    thresholds: [85, 75],
  },
  returnRate: {
    key: "returnRate",
    label: "Tỷ lệ hoàn",
    unit: "%",
    direction: "lower-better",
    baseline: 7.5,
    target: 6,
    thresholds: [8, 12],
  },
  pickupSuccessRate: {
    key: "pickupSuccessRate",
    label: "Tỷ lệ nhận thành công",
    unit: "%",
    direction: "higher-better",
    baseline: 96.5,
    target: 98,
    thresholds: [98, 95],
  },
  pickupCancelRate: {
    key: "pickupCancelRate",
    label: "Tỷ lệ huỷ pickup",
    unit: "%",
    direction: "lower-better",
    baseline: 2.5,
    target: 2,
    thresholds: [2, 4],
  },
  pickupLateRate: {
    key: "pickupLateRate",
    label: "Tỷ lệ pickup trễ",
    unit: "%",
    direction: "lower-better",
    baseline: 4,
    target: 2.5,
    thresholds: [2.5, 5],
  },
  pickupTatMin: {
    key: "pickupTatMin",
    label: "TAT pickup trung bình",
    unit: "phút",
    direction: "lower-better",
    baseline: 45,
    target: 30,
    thresholds: [30, 60],
  },
  // --- Journey: Stage 2 — Bưu cục nhận xử lý -----------------------------
  bcNhanWrongCode: {
    key: "bcNhanWrongCode",
    label: "% Sai mã",
    unit: "%",
    direction: "lower-better",
    baseline: 0.8,
    target: 0.5,
    thresholds: [0.5, 1.5],
  },
  bcNhanWrongPackage: {
    key: "bcNhanWrongPackage",
    label: "% Sai kiện",
    unit: "%",
    direction: "lower-better",
    baseline: 0.5,
    target: 0.3,
    thresholds: [0.3, 1],
  },
  bcNhanMissingMvd: {
    key: "bcNhanMissingMvd",
    label: "% Không có MVĐ",
    unit: "%",
    direction: "lower-better",
    baseline: 0.3,
    target: 0.2,
    thresholds: [0.2, 0.5],
  },
  bcNhanTatMin: {
    key: "bcNhanTatMin",
    label: "TAT xử lý tại BC nhận",
    unit: "phút",
    direction: "lower-better",
    baseline: 22,
    target: 15,
    thresholds: [15, 30],
  },
  // --- Journey: Stage 4 — Bưu cục giao (last-mile) -----------------------
  gtcRate: {
    key: "gtcRate",
    label: "% Giao thành công (GTC)",
    unit: "%",
    direction: "higher-better",
    baseline: 92,
    target: 95,
    thresholds: [95, 90],
  },
  gt1pRate: {
    key: "gt1pRate",
    label: "% Giao 1 phần (GT1P)",
    unit: "%",
    direction: "lower-better",
    baseline: 3,
    target: 2,
    thresholds: [2, 5],
  },
  gtbRate: {
    key: "gtbRate",
    label: "% Giao thất bại (GTB)",
    unit: "%",
    direction: "lower-better",
    baseline: 4,
    target: 3,
    thresholds: [3, 6],
  },
  lostRate: {
    key: "lostRate",
    label: "% Thất lạc",
    unit: "%",
    direction: "lower-better",
    baseline: 0.3,
    target: 0.2,
    thresholds: [0.2, 0.5],
  },
  // --- Journey: Stage 5 — Bưu cục hoàn -----------------------------------
  returnSuccessRate: {
    key: "returnSuccessRate",
    label: "% Hoàn thành công",
    unit: "%",
    direction: "higher-better",
    baseline: 88,
    target: 92,
    thresholds: [92, 85],
  },
  returnFailRate: {
    key: "returnFailRate",
    label: "% Hoàn thất bại",
    unit: "%",
    direction: "lower-better",
    baseline: 8,
    target: 5,
    thresholds: [5, 10],
  },
  returnDays: {
    key: "returnDays",
    label: "Thời gian hoàn trung bình",
    unit: "ngày",
    direction: "lower-better",
    baseline: 4.5,
    target: 3,
    thresholds: [3, 6],
  },
  storedRate: {
    key: "storedRate",
    label: "% Hàng lưu kho",
    unit: "%",
    direction: "lower-better",
    baseline: 4,
    target: 3,
    thresholds: [3, 6],
  },
  // --- Routing along journey: Stage 3 (KTC sort routing) ----------------
  sortRoutingAccuracy: {
    key: "sortRoutingAccuracy",
    label: "Sort routing accuracy",
    unit: "%",
    direction: "higher-better",
    baseline: 99,
    target: 99.5,
    thresholds: [99.5, 98],
  },
  crossDockRate: {
    key: "crossDockRate",
    label: "% cross-dock (không qua đêm)",
    unit: "%",
    direction: "higher-better",
    baseline: 78,
    target: 85,
    thresholds: [85, 70],
  },
  // --- Routing along journey: Stage 4 (last-mile assignment) ------------
  tuyenAssignAccuracy: {
    key: "tuyenAssignAccuracy",
    label: "% đơn vào đúng tuyến",
    unit: "%",
    direction: "higher-better",
    baseline: 96,
    target: 98,
    thresholds: [98, 94],
  },
  ordersPerTuyen: {
    key: "ordersPerTuyen",
    label: "Đơn / tuyến / NVBC",
    unit: "đơn",
    direction: "higher-better",
    baseline: 28,
    target: 32,
    thresholds: [32, 22],
  },
  // --- Network legs: BC nhận → KTC (first leg) --------------------------
  firstLegOnTime: {
    key: "firstLegOnTime",
    label: "On-time chặng BC nhận → KTC",
    unit: "%",
    direction: "higher-better",
    baseline: 93,
    target: 95,
    thresholds: [95, 90],
  },
  firstLegFill: {
    key: "firstLegFill",
    label: "Fill rate chặng BC nhận → KTC",
    unit: "%",
    direction: "higher-better",
    baseline: 70,
    target: 78,
    thresholds: [78, 65],
  },
  firstLegLeadTime: {
    key: "firstLegLeadTime",
    label: "Lead time BC nhận → KTC",
    unit: "h",
    direction: "lower-better",
    baseline: 6,
    target: 4.5,
    thresholds: [4.5, 8],
  },
  // --- Network legs: KTC → BC giao (last leg) ---------------------------
  lastLegOnTime: {
    key: "lastLegOnTime",
    label: "On-time chặng KTC → BC giao",
    unit: "%",
    direction: "higher-better",
    baseline: 91,
    target: 94,
    thresholds: [94, 88],
  },
  lastLegFill: {
    key: "lastLegFill",
    label: "Fill rate chặng KTC → BC giao",
    unit: "%",
    direction: "higher-better",
    baseline: 72,
    target: 78,
    thresholds: [78, 65],
  },
  lastLegLeadTime: {
    key: "lastLegLeadTime",
    label: "Lead time KTC → BC giao",
    unit: "h",
    direction: "lower-better",
    baseline: 5,
    target: 3.5,
    thresholds: [3.5, 7],
  },

  // ====================================================================
  // PHASE 1 — KPI mới theo spec GHN
  // Range giá trị + công thức trong comment, dùng để verify mock data.
  // ====================================================================

  // ─── A. Tổng thể mạng (North Star) ────────────────────────────────
  ontimeNetwork: {
    // Công thức: đơn ontime theo SLA / tổng đơn. Range 67-91%.
    key: "ontimeNetwork",
    label: "Ontime Network",
    unit: "%",
    direction: "higher-better",
    baseline: 87.7,
    target: 90,
    thresholds: [90, 88],
  },
  costPerKgNetwork: {
    // Công thức: Total cost / Total weight convert. Range 1350-2150 đ/kg.
    key: "costPerKgNetwork",
    label: "Cost / kg",
    unit: "VND",
    direction: "lower-better",
    baseline: 2117,
    target: 1853,
    thresholds: [1970, 2057],
  },
  hangVeBc4Ca: {
    // Công thức: đơn nhập BC giao trước 9H D-1 / tổng. Range 64-90%.
    key: "hangVeBc4Ca",
    label: "% Hàng về BC ≥4 ca",
    unit: "%",
    direction: "higher-better",
    baseline: 84.52,
    target: 90,
    thresholds: [90, 85],
  },
  nddAchieve: {
    // Công thức: đơn On-time NDD / tổng đơn NDD.
    key: "nddAchieve",
    label: "NDD Achieve Rate",
    unit: "%",
    direction: "higher-better",
    baseline: 85,
    target: 87.7,
    thresholds: [87.7, 85],
  },
  pctTC: {
    // Công thức: GTC / tổng lượt giao. Range 88-96%.
    key: "pctTC",
    label: "%TC (Giao thành công)",
    unit: "%",
    direction: "higher-better",
    baseline: 91,
    target: 92,
    thresholds: [92, 88],
  },
  doiKhoOverall: {
    // Công thức: (new_wh != old_wh) / tổng đơn nhập BC giao. ~2.25%.
    key: "doiKhoOverall",
    label: "Tỷ lệ đổi kho overall",
    unit: "%",
    direction: "lower-better",
    baseline: 2.25,
    target: 1.5,
    thresholds: [1.5, 2.3],
  },

  // ─── B. First-mile / Pickup ────────────────────────────────────────
  pctDaGan: {
    // Công thức: đơn đã gán / tổng cần lấy. Range 72-91%.
    key: "pctDaGan",
    label: "% Đã gán / cần lấy",
    unit: "%",
    direction: "higher-better",
    baseline: 82,
    target: 90,
    thresholds: [90, 80],
  },
  pctKhongGan: {
    // Công thức: đơn shop không gán trong ngày / tổng. Range 4-25%.
    // Shop nhỏ ~25%, shop lớn ~5%.
    key: "pctKhongGan",
    label: "% Không gán",
    unit: "%",
    direction: "lower-better",
    baseline: 12,
    target: 10,
    thresholds: [10, 18],
  },
  pctLTC: {
    // Công thức: LTC (đúng cutoff) / tổng cần lấy. Range 85-95%.
    key: "pctLTC",
    label: "% LTC (đúng cutoff)",
    unit: "%",
    direction: "higher-better",
    baseline: 89,
    target: 92,
    thresholds: [92, 86],
  },
  ontimeLayHang: {
    // Đơn lấy đúng cutoff / tổng. Cũ 49% → mới 85%+.
    key: "ontimeLayHang",
    label: "Ontime lấy hàng (cutoff)",
    unit: "%",
    direction: "higher-better",
    baseline: 80,
    target: 85,
    thresholds: [85, 75],
  },
  leadtimeGanMin: {
    // Leadtime gán pickup ~1h30.
    key: "leadtimeGanMin",
    label: "Leadtime gán pickup",
    unit: "phút",
    direction: "lower-better",
    baseline: 90,
    target: 75,
    thresholds: [75, 120],
  },
  leadtimeLtcMin: {
    // Leadtime LTC ~4h.
    key: "leadtimeLtcMin",
    label: "Leadtime LTC",
    unit: "phút",
    direction: "lower-better",
    baseline: 240,
    target: 210,
    thresholds: [210, 270],
  },
  doiKhoMoi: {
    // Đổi kho theo địa chỉ MỚI / đơn địa chỉ mới. ~8.7% (HN 17%, HCM 14%).
    key: "doiKhoMoi",
    label: "% Đổi kho địa chỉ mới",
    unit: "%",
    direction: "lower-better",
    baseline: 8.7,
    target: 6,
    thresholds: [6, 10],
  },
  doiKhoCu: {
    // Đổi kho theo địa chỉ CŨ / đơn địa chỉ cũ. ~3%.
    key: "doiKhoCu",
    label: "% Đổi kho địa chỉ cũ",
    unit: "%",
    direction: "lower-better",
    baseline: 3,
    target: 2,
    thresholds: [2, 4],
  },

  // ─── C. Middle-mile / Linehaul + KTC ──────────────────────────────
  time1Min: {
    // Time1 = scan_đơn_đầu − checkin. P50 15' / P90 25' / P99 40'.
    key: "time1Min",
    label: "Time 1 (scan đơn đầu)",
    unit: "phút",
    direction: "lower-better",
    baseline: 18,
    target: 15,
    thresholds: [15, 25],
  },
  time2Min: {
    // Time2 = kết_thúc_phiên − scan_đơn_đầu. P50 20' / P90 30' / P99 45'.
    key: "time2Min",
    label: "Time 2 (kết thúc phiên)",
    unit: "phút",
    direction: "lower-better",
    baseline: 22,
    target: 20,
    thresholds: [20, 32],
  },
  leadTimeE2eP50: {
    // Lead time E2E P50 ~36h.
    key: "leadTimeE2eP50",
    label: "Lead time E2E P50",
    unit: "h",
    direction: "lower-better",
    baseline: 36,
    target: 32,
    thresholds: [32, 48],
  },
  leadTimeE2eP90: {
    key: "leadTimeE2eP90",
    label: "Lead time E2E P90",
    unit: "h",
    direction: "lower-better",
    baseline: 60,
    target: 48,
    thresholds: [48, 72],
  },
  leadTimeE2eP99: {
    key: "leadTimeE2eP99",
    label: "Lead time E2E P99",
    unit: "h",
    direction: "lower-better",
    baseline: 90,
    target: 72,
    thresholds: [72, 110],
  },
  fillRateKg: {
    // KL đơn rời điểm / KL chuẩn. TB ~55%, range 40-95%.
    key: "fillRateKg",
    label: "Fill rate (kg)",
    unit: "%",
    direction: "higher-better",
    baseline: 55,
    target: 75,
    thresholds: [75, 60],
  },
  fillRateOrder: {
    // Orders rời / standard. TB ~57%.
    key: "fillRateOrder",
    label: "Fill rate (đơn)",
    unit: "%",
    direction: "higher-better",
    baseline: 57,
    target: 70,
    thresholds: [70, 55],
  },
  ontimeVanTai: {
    // 1 − (điểm dừng sai ontime / tổng điểm dừng). 91-95%.
    key: "ontimeVanTai",
    label: "Ontime vận tải",
    unit: "%",
    direction: "higher-better",
    baseline: 93,
    target: 95,
    thresholds: [95, 93],
  },
  pctEmptyMileage: {
    // km rỗng / tổng km. 15-35%.
    key: "pctEmptyMileage",
    label: "% Empty Mileage",
    unit: "%",
    direction: "lower-better",
    baseline: 25,
    target: 20,
    thresholds: [20, 30],
  },
  saiSotDoiSoat: {
    // Sai sót đối soát NCC. ~4.5% → target <1%.
    key: "saiSotDoiSoat",
    label: "Sai sót đối soát NCC",
    unit: "%",
    direction: "lower-better",
    baseline: 4.5,
    target: 1,
    thresholds: [1, 4.5],
  },
  pctPhanTuyenDung: {
    // % phân tuyến đúng lần đầu. Range 96-99%.
    key: "pctPhanTuyenDung",
    label: "% phân tuyến đúng lần đầu",
    unit: "%",
    direction: "higher-better",
    baseline: 97.5,
    target: 98.5,
    thresholds: [98.5, 95],
  },

  // ─── D. Last-mile / Giao hàng ─────────────────────────────────────
  opr: {
    // Order Performance Rate. 90-97%.
    key: "opr",
    label: "OPR (Order Performance Rate)",
    unit: "%",
    direction: "higher-better",
    baseline: 94,
    target: 95,
    thresholds: [95, 92],
  },
  odr: {
    // On-time Delivery Rate. 90-97%.
    key: "odr",
    label: "ODR (On-time Delivery Rate)",
    unit: "%",
    direction: "higher-better",
    baseline: 93.83,
    target: 95,
    thresholds: [95, 92],
  },
  pctFD: {
    // FD / tổng đơn hoàn tất. 4-10%.
    key: "pctFD",
    label: "%FD (First Delivery success)",
    unit: "%",
    direction: "higher-better",
    baseline: 7,
    target: 8,
    thresholds: [8, 5],
  },
  aov: {
    // Average Order Value = tổng cước / tổng đơn. 18-35k đ.
    key: "aov",
    label: "AOV (đ/đơn)",
    unit: "VND",
    direction: "higher-better",
    baseline: 25_000,
    target: 28_000,
    thresholds: [28_000, 20_000],
  },
  pctReturn: {
    // % đơn hoàn / tổng. ~8% theo final_status mix.
    key: "pctReturn",
    label: "% Return rate",
    unit: "%",
    direction: "lower-better",
    baseline: 8,
    target: 6,
    thresholds: [6, 10],
  },
  pctLost: {
    // % thất lạc + hư hỏng. ~1%.
    key: "pctLost",
    label: "% Thất lạc / hư hỏng",
    unit: "%",
    direction: "lower-better",
    baseline: 1,
    target: 0.5,
    thresholds: [0.5, 1.5],
  },
};

export function statusFromValue(spec: KpiSpec, value: number): Status {
  const [a, b] = spec.thresholds;
  if (spec.direction === "higher-better") {
    if (value >= a) return "green";
    if (value >= b) return "amber";
    return "red";
  } else {
    if (value <= a) return "green";
    if (value <= b) return "amber";
    return "red";
  }
}

export const STATUS_TOKENS: Record<Status, { dot: string; bg: string; text: string; border: string }> = {
  green: {
    dot: "bg-[var(--color-status-green)]",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  amber: {
    dot: "bg-[var(--color-status-amber)]",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  red: {
    dot: "bg-[var(--color-status-red)]",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
};

export const STATUS_LABEL_VI: Record<Status, string> = {
  green: "Đạt",
  amber: "Cảnh báo",
  red: "Vượt ngưỡng",
};
