// Formatting + small helpers. All number formatters use vi-VN locale.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const nfVN = new Intl.NumberFormat("vi-VN");
const nfVN1 = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const nfVN2 = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatInt(n: number): string {
  return nfVN.format(Math.round(n));
}

export function formatVND(n: number, compact = false): string {
  if (compact) {
    if (n >= 1_000_000_000) return `${nfVN1.format(n / 1_000_000_000)} tỷ`;
    if (n >= 1_000_000) return `${nfVN1.format(n / 1_000_000)} tr`;
    if (n >= 1_000) return `${nfVN1.format(n / 1_000)}K`;
  }
  return `${nfVN.format(Math.round(n))}đ`;
}

export function formatPct(n: number, digits = 1): string {
  const f = digits === 0 ? nfVN : digits === 2 ? nfVN2 : nfVN1;
  return `${f.format(n)}%`;
}

export function formatMs(n: number): string {
  if (n >= 1000) return `${nfVN1.format(n / 1000)}s`;
  return `${formatInt(n)}ms`;
}

export function formatHours(n: number): string {
  return `${nfVN1.format(n)}h`;
}

export function formatMinutes(n: number): string {
  return `${formatInt(n)} phút`;
}

export function formatDays(n: number): string {
  return `${nfVN1.format(n)} ngày`;
}

export function formatKg(n: number): string {
  return `${formatInt(n)} kg`;
}

export function formatKm(n: number): string {
  return `${formatInt(n)} km`;
}

export function formatOrders(n: number): string {
  return `${formatInt(n)} đơn`;
}

export function formatCompactInt(n: number): string {
  if (n >= 1_000_000) return `${nfVN1.format(n / 1_000_000)}M`;
  if (n >= 1_000) return `${nfVN1.format(n / 1_000)}K`;
  return formatInt(n);
}

export function formatDelta(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  const f = digits === 0 ? nfVN : digits === 2 ? nfVN2 : nfVN1;
  return `${sign}${f.format(n)}%`;
}

/** Percentage-point delta: "+0,5 pp" / "-1,2 pp" (Vietnamese decimal). */
export function formatPp(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  const f = digits === 0 ? nfVN : digits === 2 ? nfVN2 : nfVN1;
  return `${sign}${f.format(n)} pp`;
}

// ---- Value formatter dispatcher (used by KpiCard / tables) -------------

import type { KpiUnit } from "./types";

export function formatValue(value: number, unit: KpiUnit): string {
  switch (unit) {
    case "%":
      return formatPct(value);
    case "VND":
      return formatVND(value);
    case "ms":
      return formatMs(value);
    case "h":
      return formatHours(value);
    case "phút":
      return formatMinutes(value);
    case "ngày":
      return formatDays(value);
    case "đơn":
      return formatOrders(value);
    case "kg":
      return formatKg(value);
    case "km":
      return formatKm(value);
    default:
      return formatInt(value);
  }
}

// ---- Date helpers ------------------------------------------------------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatVNDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Short form "20/05" — useful for dense X-axis ticks. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function formatVNDateTime(d: Date): string {
  // Use UTC reads so SSR (server, often UTC) and CSR (browser, often UTC+7)
  // render the same string — avoids React hydration mismatch.
  const y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}/${M}/${y} ${hh}:${mm}`;
}

export function rangeDays(from: string, to: string): string[] {
  const out: string[] = [];
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    out.push(toISODate(d));
  }
  return out;
}

export function lastNDays(n: number, endIso: string): string[] {
  const end = new Date(endIso + "T00:00:00");
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(toISODate(d));
  }
  return out;
}
