"use client";

import type { TripDetail } from "@/lib/aggregators";
import { cn, formatCompactInt, formatVND, formatVNDate } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";

function fmtTime(iso: string): string {
  return `${formatVNDate(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
}

function fmtDur(min: number): string {
  if (min < 60) return `${min} phút`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

export function TripTimeline({ detail }: { detail: TripDetail }) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Summary label="Loại trip" value={detail.type} />
        <Summary label="Xe / NCC" value={`${detail.vehicle} · ${detail.carrier}`} />
        <Summary label="Parcels" value={formatCompactInt(detail.parcels)} />
        <Summary
          label="Tổng thời lượng"
          value={fmtDur(detail.totalDurationMin)}
          accent
        />
        <Summary label="Quãng đường" value={`${formatCompactInt(detail.totalKm)} km`} />
        <Summary label="Chi phí" value={formatVND(detail.cost, true)} />
        <Summary
          label="Trễ so với plan"
          value={detail.lateMin <= 0 ? "Đúng giờ" : `+${fmtDur(detail.lateMin)}`}
          tone={detail.status}
        />
        <Summary label="Số điểm chạm" value={`${detail.stops.length} điểm`} />
      </div>

      {/* Timeline */}
      <div className="relative pl-1">
        {detail.stops.map((s, i) => {
          const isLast = i === detail.stops.length - 1;
          return (
            <div key={s.order} className="flex gap-3">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0",
                    s.type === "KTC" ? "bg-violet-500" : "bg-emerald-500",
                  )}
                >
                  {s.order}
                </div>
                {!isLast && (
                  <div className="w-0.5 flex-1 bg-[var(--color-border)] my-1 min-h-[40px]" />
                )}
              </div>

              {/* Content */}
              <div className={cn("pb-4 min-w-0 flex-1", isLast && "pb-0")}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {s.name}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded border",
                      s.type === "KTC"
                        ? "bg-violet-50 border-violet-200 text-violet-700"
                        : "bg-emerald-50 border-emerald-200 text-emerald-700",
                    )}
                  >
                    {s.type}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {s.role}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--color-text-faint)]">
                    {s.code}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 text-[11px] tabular-nums">
                  <Field label="Đến" value={fmtTime(s.arriveTs)} />
                  {s.dwellMin > 0 ? (
                    <>
                      <Field label="Rời" value={fmtTime(s.departTs)} />
                      <Field label="Dừng" value={fmtDur(s.dwellMin)} />
                    </>
                  ) : (
                    <Field label="Trạng thái" value="Điểm kết thúc" />
                  )}
                  <Field
                    label="Tổng từ điểm đầu"
                    value={fmtDur(s.cumulativeMin)}
                    accent
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "green" | "amber" | "red";
}) {
  return (
    <div className="bg-[var(--color-hover)] rounded p-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums truncate",
          tone ? STATUS_TOKENS[tone].text : accent ? "text-[var(--color-ghn-red)]" : "text-[var(--color-text)]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <span className="text-[var(--color-text-muted)]">{label}: </span>
      <span className={cn(accent && "font-semibold text-[var(--color-ghn-red)]")}>
        {value}
      </span>
    </div>
  );
}
