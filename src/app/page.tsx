"use client";

import { useMemo } from "react";
import { useFilter } from "@/components/filter/FilterContext";
import {
  getOverviewAlerts,
  getOverviewModuleHealth,
  getOverviewNorthStar,
  getOverviewPulseGauges,
  getOverviewRegionHeatmap,
} from "@/lib/aggregators";
import { dataUpdatedAt } from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { ModuleHealthCard } from "@/components/ui/ModuleHealthCard";
import { PulseGauge } from "@/components/ui/PulseGauge";
import { Heatmap } from "@/components/ui/Heatmap";
import { formatVND, formatPct } from "@/lib/utils";

export default function OverallPage() {
  const { filter } = useFilter();

  const northStar = useMemo(() => getOverviewNorthStar(filter), [filter]);
  const modules = useMemo(() => getOverviewModuleHealth(filter), [filter]);
  const heatmap = useMemo(() => getOverviewRegionHeatmap(filter), [filter]);
  const alerts = useMemo(() => getOverviewAlerts(filter), [filter]);
  const gauges = useMemo(() => getOverviewPulseGauges(filter), [filter]);
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops" }, { label: "Tổng Quan" }]}
        title="Tổng Quan — Sức khoẻ vận hành mạng"
        subtitle="6 chỉ số chiến lược · 5 mô-đun nghiệp vụ · so sánh 3 vùng. Click ô đỏ để drill xuống trang chi tiết."
        updatedAt={updated}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          channel: true,
          loaiBc: true,
          ca: true,
          loaiHang: true,
          loaiTuyen: true,
          slaDays: true,
          granularity: true,
        }}
      />

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      {/* === 6 thẻ North Star === */}
      <section>
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
          North Star — 6 chỉ số chiến lược toàn mạng
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCardFrom kpi={northStar.ontimeNetwork} size="sm" />
          <KpiCardFrom kpi={northStar.costPerKg} size="sm" />
          <KpiCardFrom kpi={northStar.hangVeBc4Ca} size="sm" />
          <KpiCardFrom kpi={northStar.nddAchieve} size="sm" />
          <KpiCardFrom kpi={northStar.ontimeVanTai} size="sm" />
          <KpiCardFrom kpi={northStar.doiKhoOverall} size="sm" />
        </div>
      </section>

      {/* === 5 mô-đun nghiệp vụ + Pulse Gauges === */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Sức khoẻ theo mô-đun (click drill xuống trang chi tiết)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <ModuleHealthCard module={modules[0]} href="/stages#first-mile" />
            <ModuleHealthCard module={modules[1]} href="/network" />
            <ModuleHealthCard module={modules[2]} href="/stages#last-mile" />
            <ModuleHealthCard module={modules[3]} href="/routing" />
            <ModuleHealthCard module={modules[4]} href="/transport" />
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-2">
            Pulse realtime
          </div>
          <Card>
            <div className="grid grid-cols-2 gap-4">
              {gauges.map((g) => (
                <PulseGauge key={g.label} data={g} />
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* === Heatmap 3 vùng × 3 metric === */}
      <Card
        title="So sánh 3 vùng × 3 chỉ số"
        subtitle="Heatmap màu theo ngưỡng đèn giao thông. Click vào ô để drill xuống vùng đó."
        actions={
          <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
            [MẪU per-vùng — chờ data thật]
          </div>
        }
      >
        <Heatmap
          data={heatmap}
          rowLabel="Vùng"
          colLabel="Chỉ số"
          valueFormat={(v: number) => {
            if (v > 1000) return formatVND(v);
            return formatPct(v, 1);
          }}
        />
      </Card>
    </div>
  );
}
