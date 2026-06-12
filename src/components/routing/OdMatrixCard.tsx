"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Heatmap } from "@/components/ui/Heatmap";
import { getOdMatrix } from "@/lib/mock-data";
import {
  cn,
  formatCompactInt,
  formatHours,
  formatPct,
} from "@/lib/utils";
import type { FilterState, OdMetric } from "@/lib/types";

type Tab = { key: OdMetric; label: string };

const TABS: Tab[] = [
  { key: "volume", label: "Volume đơn" },
  { key: "misRoutePct", label: "Mis-route %" },
  { key: "leadTimeHours", label: "Avg lead time" },
];

export function OdMatrixCard({ filter }: { filter: FilterState }) {
  const [metric, setMetric] = useState<OdMetric>("volume");
  const data = useMemo(() => getOdMatrix(filter, metric), [filter, metric]);

  const format =
    metric === "volume"
      ? (v: number) => formatCompactInt(v)
      : metric === "misRoutePct"
        ? (v: number) => formatPct(v)
        : (v: number) => formatHours(v);

  return (
    <Card
      title="Origin-Destination matrix"
      subtitle="Sender province × Receiver province. Toggle metric để xem lane nào dày, lane nào lỗi, lane nào lâu."
      actions={
        <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-md p-0.5 bg-white">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setMetric(t.key)}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-colors",
                metric === t.key
                  ? "bg-[var(--color-row-selected)] text-[var(--color-ghn-red)] font-medium"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      <Heatmap
        data={data}
        valueFormat={format}
        rowLabel="Sender"
        colLabel="Receiver"
      />
    </Card>
  );
}
