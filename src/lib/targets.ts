// Quản lý mục tiêu (target) cho các key metric, theo nhiều cấp phạm vi.
// Lưu localStorage (chưa có backend) — có thể thay bằng API sau.

export type ScopeLevelKey =
  | "all"
  | "region"
  | "channel"
  | "loaiHang"
  | "ktc"
  | "bc";

export type TargetMetric = {
  key: string;
  label: string;
  unit: "%" | "VND";
  direction: "higher-better" | "lower-better";
  defaultTarget: number;
  /** Metric tính từ trip → chỉ chính xác ở phạm vi Toàn mạng (trip chưa gắn vùng/BC). */
  tripBased?: boolean;
};

/** Danh mục metric có thể đặt mục tiêu. */
export const TARGET_METRICS: TargetMetric[] = [
  { key: "ontimeNetwork", label: "Ontime Network", unit: "%", direction: "higher-better", defaultTarget: 90 },
  { key: "pctTC", label: "%GTC", unit: "%", direction: "higher-better", defaultTarget: 92 },
  { key: "pctLTC", label: "%LTC (ontime lấy)", unit: "%", direction: "higher-better", defaultTarget: 85 },
  { key: "opr", label: "OPR — tỷ lệ lấy hàng", unit: "%", direction: "higher-better", defaultTarget: 97 },
  { key: "odr", label: "ODR — tỷ lệ giao hàng", unit: "%", direction: "higher-better", defaultTarget: 93 },
  { key: "pctDaGan", label: "% gán (chỉ định kho)", unit: "%", direction: "higher-better", defaultTarget: 88 },
  { key: "hangVeBc4Ca", label: "% on time ≥4 ca", unit: "%", direction: "higher-better", defaultTarget: 90 },
  { key: "doiKhoOverall", label: "Tỷ lệ đổi kho", unit: "%", direction: "lower-better", defaultTarget: 2 },
  { key: "fillRateKg", label: "Fill rate kg", unit: "%", direction: "higher-better", defaultTarget: 75, tripBased: true },
  { key: "ontimeVanTai", label: "Ontime vận tải", unit: "%", direction: "higher-better", defaultTarget: 95, tripBased: true },
  { key: "pctEmptyMileage", label: "% Empty Mileage", unit: "%", direction: "lower-better", defaultTarget: 20, tripBased: true },
  { key: "costPerKg", label: "Cost/kg", unit: "VND", direction: "lower-better", defaultTarget: 1853, tripBased: true },
];

export const SCOPE_LEVELS: { key: ScopeLevelKey; label: string }[] = [
  { key: "all", label: "Toàn mạng" },
  { key: "region", label: "Vùng" },
  { key: "channel", label: "Nguồn đơn (Channel)" },
  { key: "loaiHang", label: "Loại hàng" },
  { key: "ktc", label: "KTC" },
  { key: "bc", label: "Bưu cục (BC)" },
];

export type TargetRecord = {
  id: string;
  metricKey: string;
  scopeLevel: ScopeLevelKey;
  scopeValue: string; // "" khi Toàn mạng
  scopeLabel: string; // hiển thị
  target: number;
  note?: string;
  updatedAt: string; // ISO
};

export function metricByKey(key: string): TargetMetric | undefined {
  return TARGET_METRICS.find((m) => m.key === key);
}

export function scopeLevelLabel(key: ScopeLevelKey): string {
  return SCOPE_LEVELS.find((s) => s.key === key)?.label ?? key;
}

const LS_KEY = "ghn-targets-v1";

export function loadTargets(): TargetRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as TargetRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveTargets(list: TargetRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
}
