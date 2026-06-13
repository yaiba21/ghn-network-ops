"use client";

import { useState } from "react";
import type { OdMatrixData } from "@/lib/aggregators";
import { cn, formatCompactInt, formatPct } from "@/lib/utils";

type Props = {
  data: OdMatrixData;
};

type Mode = "trips" | "ontime";

/**
 * Origin-Destination matrix cho lane KTC↔KTC.
 * Hàng = KTC đi, cột = KTC đến. Cell: số trip (đậm = nhiều) hoặc ontime (màu).
 * Đọc nhanh: hàng đậm = KTC xuất nhiều, vùng đỏ = lane trễ.
 */
export function OdMatrix({ data }: Props) {
  const [mode, setMode] = useState<Mode>("trips");
  const [hover, setHover] = useState<{ o: number; d: number } | null>(null);

  const cellBg = (cell: { trips: number; ontime: number } | null) => {
    if (!cell) return "transparent";
    if (mode === "trips") {
      const t = cell.trips / data.maxTrips; // 0..1
      // cam đậm dần theo volume
      return `rgba(249, 115, 22, ${0.12 + t * 0.78})`;
    }
    // ontime: xanh/vàng/đỏ
    if (cell.ontime >= 95) return "rgba(16,185,129,0.75)";
    if (cell.ontime >= 90) return "rgba(245,158,11,0.75)";
    return "rgba(239,68,68,0.75)";
  };

  const cellText = (cell: { trips: number; ontime: number } | null) => {
    if (!cell) return "";
    return mode === "trips" ? formatCompactInt(cell.trips) : formatPct(cell.ontime, 0);
  };

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-flex bg-white border border-[var(--color-border)] rounded-md p-0.5">
          {(["trips", "ontime"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "px-3 h-7 text-xs font-medium rounded transition-colors",
                mode === m
                  ? "bg-[var(--color-ghn-red-soft)] text-[var(--color-ghn-red)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {m === "trips" ? "Số trip" : "Ontime %"}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          Hàng = KTC đi · Cột = KTC đến · {mode === "trips" ? "đậm = nhiều trip" : "đỏ = lane trễ"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white z-10 px-2 py-1 text-[10px] text-[var(--color-text-muted)] text-left">
                đi ↓ \ đến →
              </th>
              {data.ktcs.map((k, di) => (
                <th
                  key={k.code}
                  className={cn(
                    "px-1 py-1 text-[10px] font-medium",
                    hover?.d === di ? "text-[var(--color-ghn-red)]" : "text-[var(--color-text-muted)]",
                  )}
                  title={k.code}
                >
                  <div className="w-10 truncate mx-auto">{k.label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.ktcs.map((row, oi) => (
              <tr key={row.code}>
                <th
                  className={cn(
                    "sticky left-0 bg-white z-10 px-2 py-1 text-[10px] font-medium text-left whitespace-nowrap",
                    hover?.o === oi ? "text-[var(--color-ghn-red)]" : "text-[var(--color-text)]",
                  )}
                  title={row.code}
                >
                  {row.label}
                </th>
                {data.ktcs.map((col, di) => {
                  const cell = data.cells[oi][di];
                  const isDiag = oi === di;
                  return (
                    <td
                      key={col.code}
                      onMouseEnter={() => setHover({ o: oi, d: di })}
                      onMouseLeave={() => setHover(null)}
                      className="p-0"
                    >
                      <div
                        className={cn(
                          "w-10 h-8 flex items-center justify-center text-[10px] tabular-nums rounded-sm",
                          isDiag && "opacity-30",
                          cell ? "text-[var(--color-text)] font-medium cursor-default" : "text-[var(--color-text-faint)]",
                        )}
                        style={{ backgroundColor: isDiag ? "#f1f5f9" : cellBg(cell) }}
                        title={
                          cell
                            ? `${row.code} → ${col.code}: ${formatCompactInt(cell.trips)} trip · ${formatPct(cell.ontime, 1)} ontime · ${formatCompactInt(cell.parcels)} parcels`
                            : `${row.code} → ${col.code}: không có trip`
                        }
                      >
                        {isDiag ? "—" : cellText(cell)}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[10px] text-[var(--color-text-muted)]">
        {mode === "trips" ? (
          <>
            <span>Ít trip</span>
            <span className="inline-block w-24 h-2 rounded" style={{ background: "linear-gradient(90deg, rgba(249,115,22,0.12), rgba(249,115,22,0.9))" }} />
            <span>Nhiều trip</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: "rgba(16,185,129,0.75)" }} /> ≥95%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: "rgba(245,158,11,0.75)" }} /> 90-95%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: "rgba(239,68,68,0.75)" }} /> &lt;90%</span>
          </>
        )}
      </div>
    </div>
  );
}
