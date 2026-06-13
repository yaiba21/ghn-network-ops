// Template + parser definitions for each uploadable dataset.
// Each template:
//   - has CSV headers + sample rows (downloadable)
//   - has a parser that coerces strings → typed rows and computes derived fields
//   - has a label/description shown on the upload page

import { parseCSV, toCSV } from "./csv";
import { KPI, statusFromValue } from "./kpi-config";
import type {
  CostCategoryRow,
  KpiDirection,
  KtcStatusRow,
  LanePerfRow,
  OpsScorecardRow,
  RegionCode,
  Status,
} from "./types";

export type UploadedDatasetKey =
  | "ops-scorecard"
  | "cost-by-category"
  | "lane-perf"
  | "ktc-status";

export type ParseResult<T> =
  | { ok: true; rows: T[]; warnings: string[] }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(v: string | undefined, field: string): number {
  if (v === undefined || v === "") throw new Error(`Thiếu giá trị cho cột "${field}"`);
  // Accept both "8,500" (Vietnamese) and "8500" / "8500.5"
  const cleaned = v.replace(/[\s,]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  const n = Number(cleaned);
  if (Number.isNaN(n)) {
    throw new Error(`Giá trị không phải số ở cột "${field}": "${v}"`);
  }
  return n;
}

function toOptionalString(v: string | undefined): string | undefined {
  return v && v.length > 0 ? v : undefined;
}

function requireHeaders(actual: string[], expected: string[]): string | null {
  const missing = expected.filter((h) => !actual.includes(h));
  if (missing.length) {
    return `CSV thiếu cột bắt buộc: ${missing.join(", ")}`;
  }
  return null;
}

function statusForOps(
  value: number,
  direction: KpiDirection,
  greenAt: number,
  amberAt: number,
): Status {
  if (direction === "higher-better") {
    if (value >= greenAt) return "green";
    if (value >= amberAt) return "amber";
    return "red";
  }
  if (value <= greenAt) return "green";
  if (value <= amberAt) return "amber";
  return "red";
}

function worst(...xs: Status[]): Status {
  if (xs.includes("red")) return "red";
  if (xs.includes("amber")) return "amber";
  return "green";
}

// ---------------------------------------------------------------------------
// 1. Ops Scorecard (7-ish rows, W20 vs WTD)
// ---------------------------------------------------------------------------

const OPS_HEADERS = [
  "key",
  "label",
  "w20",
  "wtd",
  "target",
  "direction",
  "green_at",
  "amber_at",
  "note",
];

const OPS_SAMPLE: (string | number)[][] = [
  ["odr", "ODR — On-time Delivery Rate", 93.83, 93.0, 95, "higher-better", 95, 92, ""],
  ["oprCot16h", "OPR (COT 16h)", 95.17, 94.17, 96, "higher-better", 95, 92, ""],
  ["oprNewCot", "OPR (COT 9h–19h)", 77.98, 74.23, 90, "higher-better", 90, 80, ""],
  ["fd", "FD — Failed Delivery", 5.59, 5.35, 4, "lower-better", 4, 6, ""],
  ["lateNoDeparture", "% Trễ không xuất tải", 7.5, 7.3, 5, "lower-better", 5, 8, ""],
  [
    "ontimeTrungChuyen",
    "% Ontime trung chuyển (≥4 ca)",
    86.3,
    86.2,
    90,
    "higher-better",
    90,
    80,
    "",
  ],
  ["gtc", "%GTC — Giao thành công", 64, 61, 70, "higher-better", 70, 55, ""],
];

function parseOpsScorecard(csv: string): ParseResult<OpsScorecardRow> {
  const { headers, rows } = parseCSV(csv);
  const headerErr = requireHeaders(headers, [
    "key",
    "label",
    "w20",
    "wtd",
    "target",
    "direction",
    "green_at",
    "amber_at",
  ]);
  if (headerErr) return { ok: false, error: headerErr };

  const warnings: string[] = [];
  const out: OpsScorecardRow[] = [];

  rows.forEach((r, i) => {
    try {
      const direction = r.direction === "lower-better" ? "lower-better" : "higher-better";
      const w20 = toNumber(r.w20, "w20");
      const wtd = toNumber(r.wtd, "wtd");
      const target = toNumber(r.target, "target");
      const greenAt = toNumber(r.green_at, "green_at");
      const amberAt = toNumber(r.amber_at, "amber_at");

      out.push({
        key: r.key,
        label: r.label,
        w20Value: w20,
        wtdValue: wtd,
        target,
        direction,
        unit: "%",
        status: statusForOps(wtd, direction, greenAt, amberAt),
        deltaPp: Math.round((wtd - w20) * 100) / 100,
        note: toOptionalString(r.note),
      });
    } catch (e) {
      warnings.push(`Dòng ${i + 2}: ${(e as Error).message}`);
    }
  });

  if (out.length === 0) {
    return { ok: false, error: "CSV không có dòng dữ liệu hợp lệ." };
  }
  return { ok: true, rows: out, warnings };
}

// ---------------------------------------------------------------------------
// 2. Cost by Category (donut)
// ---------------------------------------------------------------------------

const COST_CAT_HEADERS = ["key", "label", "amount", "color"];

const COST_CAT_SAMPLE: (string | number)[][] = [
  ["partner", "Chi phí đối tác", 4_200_000_000, "#6B7CB8"],
  ["fuel", "Chi phí nhiên liệu", 3_000_000_000, "#EEA060"],
  ["salary", "Chi phí lương", 2_400_000_000, "#84B26A"],
  ["tolls", "Chi phí cầu đường", 1_200_000_000, "#B85850"],
  ["rental", "Chi phí thuê xe tải", 1_200_000_000, "#6F8AAB"],
];

export type CostCategoryUpload = {
  rows: CostCategoryRow[];
  total: number;
};

function parseCostByCategory(csv: string): ParseResult<CostCategoryRow> {
  const { headers, rows } = parseCSV(csv);
  const headerErr = requireHeaders(headers, ["key", "label", "amount", "color"]);
  if (headerErr) return { ok: false, error: headerErr };

  const warnings: string[] = [];
  const intermediate: { key: string; label: string; amount: number; color: string }[] = [];

  rows.forEach((r, i) => {
    try {
      intermediate.push({
        key: r.key,
        label: r.label,
        amount: toNumber(r.amount, "amount"),
        color: r.color || "#6B7280",
      });
    } catch (e) {
      warnings.push(`Dòng ${i + 2}: ${(e as Error).message}`);
    }
  });

  if (!intermediate.length) {
    return { ok: false, error: "CSV không có dòng dữ liệu hợp lệ." };
  }

  const total = intermediate.reduce((a, b) => a + b.amount, 0);
  const out: CostCategoryRow[] = intermediate.map((c) => ({
    key: c.key,
    label: c.label,
    amount: c.amount,
    share: total > 0 ? Math.round((c.amount / total) * 100) / 100 : 0,
    color: c.color,
  }));

  return { ok: true, rows: out, warnings };
}

// ---------------------------------------------------------------------------
// 3. Lane performance
// ---------------------------------------------------------------------------

const LANE_HEADERS = [
  "lane_code",
  "lane_name",
  "volume",
  "fill_rate",
  "cost_per_kg",
  "on_time_departure",
  "on_time_arrival",
  "missort_rate",
];

const LANE_SAMPLE: (string | number)[][] = [
  [
    "L-HCM-KTC01-HNI-KTC01",
    "KTC TP. Hồ Chí Minh 01 → KTC Hà Nội 01",
    3200,
    82.5,
    2150,
    94,
    91,
    0.6,
  ],
  [
    "L-HNI-KTC01-HCM-KTC01",
    "KTC Hà Nội 01 → KTC TP. Hồ Chí Minh 01",
    3100,
    78.0,
    2280,
    92,
    89,
    0.8,
  ],
  [
    "L-DNG-KTC01-HCM-KTC01",
    "KTC Đà Nẵng 01 → KTC TP. Hồ Chí Minh 01",
    1800,
    71.0,
    2400,
    88,
    85,
    1.2,
  ],
  [
    "L-BDG-KTC01-HCM-KTC01",
    "KTC Bình Dương 01 → KTC TP. Hồ Chí Minh 01",
    2500,
    85.0,
    1900,
    96,
    94,
    0.4,
  ],
  [
    "L-HCM-KTC01-DNG-KTC01",
    "KTC TP. Hồ Chí Minh 01 → KTC Đà Nẵng 01",
    1900,
    74.0,
    2350,
    90,
    87,
    1.1,
  ],
];

function parseLanePerf(csv: string): ParseResult<LanePerfRow> {
  const { headers, rows } = parseCSV(csv);
  const headerErr = requireHeaders(headers, LANE_HEADERS);
  if (headerErr) return { ok: false, error: headerErr };

  const warnings: string[] = [];
  const out: LanePerfRow[] = [];

  rows.forEach((r, i) => {
    try {
      const fillRate = toNumber(r.fill_rate, "fill_rate");
      const onTimeDeparture = toNumber(r.on_time_departure, "on_time_departure");
      const onTimeArrival = toNumber(r.on_time_arrival, "on_time_arrival");
      const missortRate = toNumber(r.missort_rate, "missort_rate");

      const status = worst(
        statusFromValue(KPI.fillRate, fillRate),
        statusFromValue(KPI.onTimeArrival, onTimeArrival),
        statusFromValue(KPI.missortRate, missortRate),
      );

      out.push({
        laneCode: r.lane_code,
        laneName: r.lane_name,
        volume: toNumber(r.volume, "volume"),
        fillRate,
        costPerKg: toNumber(r.cost_per_kg, "cost_per_kg"),
        onTimeDeparture,
        onTimeArrival,
        missortRate,
        status,
      });
    } catch (e) {
      warnings.push(`Dòng ${i + 2}: ${(e as Error).message}`);
    }
  });

  if (!out.length) return { ok: false, error: "CSV không có dòng dữ liệu hợp lệ." };
  return { ok: true, rows: out, warnings };
}

// ---------------------------------------------------------------------------
// 4. KTC status
// ---------------------------------------------------------------------------

const KTC_HEADERS = [
  "ktc_code",
  "ktc_name",
  "region_code",
  "processing",
  "pending_sort",
  "ready_dispatch",
  "tat_hours",
  "sort_accuracy",
];

const KTC_SAMPLE: (string | number)[][] = [
  ["HCM-KTC01", "KTC TP. Hồ Chí Minh 01", "HCM", 3200, 800, 1200, 4.5, 99.5],
  ["HCM-KTC02", "KTC TP. Hồ Chí Minh 02", "HCM", 2800, 700, 1100, 5.0, 99.4],
  ["HNI-KTC01", "KTC Hà Nội 01", "HNO", 3000, 750, 1150, 4.8, 99.5],
  ["DNG-KTC01", "KTC Đà Nẵng 01", "TTB", 1800, 600, 800, 6.0, 99.0],
  ["BDG-KTC01", "KTC Bình Dương 01", "DNB", 2400, 650, 900, 4.6, 99.5],
  ["KHA-KTC01", "KTC Khánh Hoà 01", "NTB", 1200, 900, 600, 9.5, 98.6],
];

const VALID_REGION_CODES: string[] = [
  "HNO", "DSH", "TNT", "XBG", "TBB", "DBB", "BTB",
  "TTB", "TNG", "NTB", "HCM", "DNB", "DCL", "TNB",
];

function parseKtcStatus(csv: string): ParseResult<KtcStatusRow> {
  const { headers, rows } = parseCSV(csv);
  const headerErr = requireHeaders(headers, KTC_HEADERS);
  if (headerErr) return { ok: false, error: headerErr };

  const warnings: string[] = [];
  const out: KtcStatusRow[] = [];

  rows.forEach((r, i) => {
    try {
      const region = r.region_code as RegionCode;
      if (!VALID_REGION_CODES.includes(region)) {
        throw new Error(
          `region_code phải là 1 trong 14 vùng (HNO/DSH/TNT/XBG/TBB/DBB/BTB/TTB/TNG/NTB/HCM/DNB/DCL/TNB), nhận: "${r.region_code}"`,
        );
      }
      const sortAccuracy = toNumber(r.sort_accuracy, "sort_accuracy");
      const tatHours = toNumber(r.tat_hours, "tat_hours");
      const status = worst(
        statusFromValue(KPI.sortAccuracy, sortAccuracy),
        statusFromValue(KPI.tatHub, tatHours),
      );

      out.push({
        ktcCode: r.ktc_code,
        ktcName: r.ktc_name,
        regionCode: region,
        processing: toNumber(r.processing, "processing"),
        pendingSort: toNumber(r.pending_sort, "pending_sort"),
        readyDispatch: toNumber(r.ready_dispatch, "ready_dispatch"),
        tatHours,
        sortAccuracy,
        status,
      });
    } catch (e) {
      warnings.push(`Dòng ${i + 2}: ${(e as Error).message}`);
    }
  });

  if (!out.length) return { ok: false, error: "CSV không có dòng dữ liệu hợp lệ." };
  return { ok: true, rows: out, warnings };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export type DatasetSpec = {
  key: UploadedDatasetKey;
  label: string;
  description: string;
  affects: string;
  headers: string[];
  columnHints: { name: string; type: string; hint: string }[];
  fileName: string;
  generateTemplate: () => string;
  parse: (csv: string) => ParseResult<unknown>;
};

export const DATASETS: Record<UploadedDatasetKey, DatasetSpec> = {
  "ops-scorecard": {
    key: "ops-scorecard",
    label: "Bảng điểm vận hành tuần",
    description:
      "7 chỉ số ops-native: ODR / OPR / FD / Trễ xuất tải / On-time trung chuyển / GTC. Mỗi dòng = 1 chỉ số với W20 vs WTD.",
    affects: "Overall → Bảng điểm vận hành tuần",
    headers: OPS_HEADERS,
    columnHints: [
      { name: "key", type: "string", hint: "Định danh nội bộ (vd: odr, fd)" },
      { name: "label", type: "string", hint: 'Nhãn hiển thị (vd: "ODR — On-time Delivery Rate")' },
      { name: "w20", type: "number", hint: "Giá trị tuần liền trước (%)" },
      { name: "wtd", type: "number", hint: "Giá trị tuần hiện tại tới hôm nay (%)" },
      { name: "target", type: "number", hint: "Mục tiêu (%)" },
      { name: "direction", type: "enum", hint: '"higher-better" hoặc "lower-better"' },
      { name: "green_at", type: "number", hint: "Ngưỡng xanh" },
      { name: "amber_at", type: "number", hint: "Ngưỡng vàng (đỏ nếu vượt)" },
      { name: "note", type: "string?", hint: "Ghi chú (optional)" },
    ],
    fileName: "ghn-template-ops-scorecard.csv",
    generateTemplate: () => toCSV(OPS_HEADERS, OPS_SAMPLE),
    parse: parseOpsScorecard,
  },
  "cost-by-category": {
    key: "cost-by-category",
    label: "Cơ cấu chi phí theo hạng mục",
    description:
      "5 hạng mục: đối tác / nhiên liệu / lương / cầu đường / thuê xe tải. Mỗi dòng = số tiền (VND) tích luỹ 30 ngày. Tỷ trọng tự tính từ tổng.",
    affects: "Overall → Cơ cấu chi phí linehaul theo hạng mục",
    headers: COST_CAT_HEADERS,
    columnHints: [
      { name: "key", type: "string", hint: "Định danh (vd: partner, fuel)" },
      { name: "label", type: "string", hint: "Nhãn hiển thị" },
      { name: "amount", type: "number", hint: "Tổng chi phí (VND)" },
      { name: "color", type: "hex", hint: "Màu donut (vd: #6B7CB8)" },
    ],
    fileName: "ghn-template-cost-by-category.csv",
    generateTemplate: () => toCSV(COST_CAT_HEADERS, COST_CAT_SAMPLE),
    parse: parseCostByCategory,
  },
  "lane-perf": {
    key: "lane-perf",
    label: "Hiệu suất lane",
    description:
      "Top lanes theo volume. Status tự derive từ fill_rate / on_time_arrival / missort_rate qua kpi-config.",
    affects: "Mạng lưới → Lane performance — Top theo volume",
    headers: LANE_HEADERS,
    columnHints: [
      { name: "lane_code", type: "string", hint: "Mã lane (vd: L-HCM-KTC01-HNI-KTC01)" },
      { name: "lane_name", type: "string", hint: "Tên hiển thị (KTC A → KTC B)" },
      { name: "volume", type: "number", hint: "Số đơn / ngày" },
      { name: "fill_rate", type: "number", hint: "%" },
      { name: "cost_per_kg", type: "number", hint: "VND/kg" },
      { name: "on_time_departure", type: "number", hint: "%" },
      { name: "on_time_arrival", type: "number", hint: "%" },
      { name: "missort_rate", type: "number", hint: "%" },
    ],
    fileName: "ghn-template-lane-perf.csv",
    generateTemplate: () => toCSV(LANE_HEADERS, LANE_SAMPLE),
    parse: parseLanePerf,
  },
  "ktc-status": {
    key: "ktc-status",
    label: "Trạng thái KTC realtime",
    description:
      "Snapshot từng KTC: số đơn đang xử lý / chờ sort / sẵn sàng xuất + TAT + sort accuracy. Status tự derive.",
    affects: "Mạng lưới → Trạng thái KTC realtime",
    headers: KTC_HEADERS,
    columnHints: [
      { name: "ktc_code", type: "string", hint: "Mã KTC" },
      { name: "ktc_name", type: "string", hint: "Tên KTC" },
      { name: "region_code", type: "enum", hint: '"bac" | "trung" | "nam"' },
      { name: "processing", type: "number", hint: "Đơn đang xử lý" },
      { name: "pending_sort", type: "number", hint: "Đơn chờ sort" },
      { name: "ready_dispatch", type: "number", hint: "Đơn sẵn sàng xuất" },
      { name: "tat_hours", type: "number", hint: "Turn-around time (h)" },
      { name: "sort_accuracy", type: "number", hint: "%" },
    ],
    fileName: "ghn-template-ktc-status.csv",
    generateTemplate: () => toCSV(KTC_HEADERS, KTC_SAMPLE),
    parse: parseKtcStatus,
  },
};
