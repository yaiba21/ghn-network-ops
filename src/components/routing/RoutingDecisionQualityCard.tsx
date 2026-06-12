import { Card } from "@/components/ui/Card";
import { cn, formatCompactInt, formatPct } from "@/lib/utils";
import { SERVICE_LABEL_VI, type RoutingDecisionRow } from "@/lib/types";

type Props = { rows: RoutingDecisionRow[] };

const HOP_COLOR = {
  direct: "#10B981",
  oneHop: "#F97316",
  twoHop: "#F59E0B",
  threePlus: "#DC2626",
};

/** Per-service stacked bar (hop distribution) + match % chip on the right. */
export function RoutingDecisionQualityCard({ rows }: Props) {
  return (
    <Card
      title="Routing decision quality"
      subtitle="Phân bố hop count theo service + tỷ lệ đơn match planned_path. Càng nhiều multi-hop = path planning yếu hoặc service phức tạp."
    >
      <div className="space-y-4">
        {rows.map((r) => {
          const total = r.direct + r.oneHop + r.twoHop + r.threePlus;
          if (total === 0) return null;
          const pctDirect = (r.direct / total) * 100;
          const pct1 = (r.oneHop / total) * 100;
          const pct2 = (r.twoHop / total) * 100;
          const pct3 = (r.threePlus / total) * 100;
          return (
            <div key={r.serviceType} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {SERVICE_LABEL_VI[r.serviceType]}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                    {formatCompactInt(total)} đơn
                  </span>
                </div>
                <MatchChip pct={r.matchPct} />
              </div>
              <div className="flex h-7 w-full rounded overflow-hidden border border-[var(--color-border)]">
                <Segment color={HOP_COLOR.direct} pct={pctDirect} label="Direct" />
                <Segment color={HOP_COLOR.oneHop} pct={pct1} label="1-hop" />
                <Segment color={HOP_COLOR.twoHop} pct={pct2} label="2-hop" />
                <Segment color={HOP_COLOR.threePlus} pct={pct3} label="3+" />
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)] tabular-nums">
                <Legend color={HOP_COLOR.direct} label={`Direct ${formatPct(pctDirect)}`} />
                <Legend color={HOP_COLOR.oneHop} label={`1-hop ${formatPct(pct1)}`} />
                <Legend color={HOP_COLOR.twoHop} label={`2-hop ${formatPct(pct2)}`} />
                <Legend color={HOP_COLOR.threePlus} label={`3+ ${formatPct(pct3)}`} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Segment({
  color,
  pct,
  label,
}: {
  color: string;
  pct: number;
  label: string;
}) {
  if (pct === 0) return null;
  return (
    <div
      className="flex items-center justify-center text-[11px] font-medium text-white tabular-nums overflow-hidden"
      style={{ width: `${pct}%`, background: color }}
      title={`${label} · ${pct.toFixed(1)}%`}
    >
      {pct >= 8 && `${pct.toFixed(0)}%`}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function MatchChip({ pct }: { pct: number }) {
  const status =
    pct >= 99 ? "green" : pct >= 97 ? "amber" : "red";
  const cls = cn(
    "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tabular-nums border",
    status === "green" && "bg-emerald-50 text-emerald-700 border-emerald-200",
    status === "amber" && "bg-amber-50 text-amber-700 border-amber-200",
    status === "red" && "bg-red-50 text-red-700 border-red-200",
  );
  return <span className={cls}>Match planned {formatPct(pct)}</span>;
}
