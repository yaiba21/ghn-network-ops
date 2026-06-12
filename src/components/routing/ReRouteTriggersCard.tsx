import { Card } from "@/components/ui/Card";
import { Donut } from "@/components/ui/Donut";
import { MetricChart } from "@/components/ui/MetricChart";
import {
  formatCompactInt,
  formatPct,
  shortDate,
} from "@/lib/utils";
import type { ReRouteTriggerRow, SeriesPoint } from "@/lib/types";

type Props = {
  triggers: ReRouteTriggerRow[];
  trend: SeriesPoint[];
};

export function ReRouteTriggersCard({ triggers, trend }: Props) {
  const total = triggers.reduce((a, b) => a + b.count, 0);
  const slices = triggers.map((t) => ({
    key: t.reason,
    label: t.reason,
    value: t.count,
    color: t.color,
  }));

  return (
    <Card
      title="Re-route triggers"
      subtitle="Nguyên nhân đơn phải đổi path sau khi ORS đã quyết định ban đầu, kèm trend 30 ngày."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie + legend list */}
        <div>
          <Donut
            data={slices}
            valueFormatter={(v) => formatCompactInt(v)}
            centerLabel={
              <div className="flex flex-col items-center text-center">
                <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  Tổng re-route
                </div>
                <div className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                  {formatCompactInt(total)}
                </div>
              </div>
            }
          />
          <ul className="mt-2 space-y-1 text-xs">
            {triggers.map((t) => (
              <li
                key={t.reason}
                className="flex items-center justify-between gap-2"
              >
                <span className="inline-flex items-center gap-2 text-[var(--color-text)] min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: t.color }}
                  />
                  <span className="truncate">{t.reason}</span>
                </span>
                <span className="tabular-nums text-[var(--color-text-muted)] shrink-0">
                  {formatCompactInt(t.count)} ·{" "}
                  <span className="text-[var(--color-text)] font-medium">
                    {formatPct(t.pct)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Trend */}
        <div>
          <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] font-medium mb-2">
            Re-route rate (30 ngày)
          </div>
          <MetricChart<SeriesPoint>
            type="line"
            data={trend}
            xKey="date"
            height={220}
            xTickFormatter={(v) => shortDate(String(v))}
            yTickFormatter={(v) => formatPct(v)}
            tooltipValueFormatter={(v) => formatPct(v)}
            series={[
              {
                key: "actual",
                label: "Re-route %",
                color: "#DC2626",
                type: "line",
              },
              {
                key: "target",
                label: "Target",
                color: "#9CA3AF",
                type: "line",
              },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}
