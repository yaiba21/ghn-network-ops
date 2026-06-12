"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useFilter } from "@/components/filter/FilterContext";
import {
  dataUpdatedAt,
  getBcGiaoKpis,
  getBcHoanKpis,
  getBcNhanKpis,
  getJourneyAnomalies,
  getJourneyFunnel,
  getJourneyOverview,
  getKtcStatus,
  getNetworkKpis,
  getPickupKpis,
} from "@/lib/mock-data";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/filter/FilterBar";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { Card } from "@/components/ui/Card";
import { KpiCardFrom } from "@/components/ui/KpiCard";
import { Funnel } from "@/components/ui/Funnel";
import { JourneyFlow } from "@/components/journey/JourneyFlow";
import { formatCompactInt, formatVND } from "@/lib/utils";
import { STATUS_TOKENS } from "@/lib/kpi-config";
import type {
  BcGiaoKpis,
  BcHoanKpis,
  BcNhanKpis,
  JourneyStageKey,
  PickupKpis,
} from "@/lib/types";

export default function JourneyPage() {
  const { filter } = useFilter();

  const stages = getJourneyOverview(filter);
  const anomalies = getJourneyAnomalies(filter);
  const pickup = getPickupKpis(filter);
  const bcNhan = getBcNhanKpis(filter);
  const network = getNetworkKpis(filter);
  const ktcStatuses = getKtcStatus(filter);
  const bcGiao = getBcGiaoKpis(filter);
  const bcHoan = getBcHoanKpis(filter);
  const updated = dataUpdatedAt();

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Journey vận hành" },
        ]}
        title="Journey vận hành"
        subtitle="Từ lúc nhận đến khi giao thành công (hoặc hoàn). Mỗi chặng là 1 stage funnel với KPI riêng — click ô bên trên để nhảy nhanh."
        updatedAt={updated}
      />

      <FilterBar
        show={{
          region: true,
          province: true,
          service: true,
          granularity: true,
        }}
      />

      {/* Visual 5-stage flow */}
      <Card
        title="Tổng quan hành trình"
        subtitle="Status + tỷ lệ pass + throughput mỗi chặng. Click 1 chặng để cuộn xuống chi tiết."
      >
        <JourneyFlow stages={stages} />
      </Card>

      {anomalies.length > 0 && (
        <AlertBanner alerts={anomalies} />
      )}

      {/* Stage 1 — Pickup */}
      <PickupSection kpis={pickup} funnel={getJourneyFunnel(filter, "pickup")} />

      {/* Stage 2 — BC nhận */}
      <BcNhanSection
        kpis={bcNhan}
        funnel={getJourneyFunnel(filter, "bcNhan")}
      />

      {/* Stage 3 — KTC */}
      <KtcSection
        sortAccuracy={network.sortAccuracy.value}
        tatHub={network.tatHub.value}
        missortRate={network.missortRate.value}
        overstayRate={network.overstayRate.value}
        funnel={getJourneyFunnel(filter, "ktc")}
        topUnderperformer={
          ktcStatuses
            .slice()
            .sort((a, b) => b.tatHours - a.tatHours)
            .find((k) => k.status !== "green")?.ktcName ?? "—"
        }
      />

      {/* Stage 4 — BC giao */}
      <BcGiaoSection
        kpis={bcGiao}
        funnel={getJourneyFunnel(filter, "bcGiao")}
      />

      {/* Stage 5 — BC hoàn */}
      <BcHoanSection
        kpis={bcHoan}
        funnel={getJourneyFunnel(filter, "bcHoan")}
      />
    </div>
  );
}

// ---------- Stage section wrapper ---------------------------------------

function StageHeader({
  step,
  label,
  description,
  tone,
  anchorKey,
  linkHref,
  linkLabel,
}: {
  step: number;
  label: string;
  description: string;
  tone: "green" | "blue" | "violet" | "amber" | "rose";
  anchorKey: JourneyStageKey;
  linkHref?: string;
  linkLabel?: string;
}) {
  const stripTone: Record<typeof tone, string> = {
    green: "bg-emerald-500",
    blue: "bg-sky-500",
    violet: "bg-violet-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  };
  return (
    <div
      id={`stage-${anchorKey}`}
      className="scroll-mt-20 flex items-start justify-between gap-4 pt-2"
    >
      <div className="flex items-start gap-3">
        <span
          className={`w-7 h-7 shrink-0 rounded-md text-white font-semibold flex items-center justify-center text-sm ${stripTone[tone]}`}
        >
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            {label}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {description}
          </p>
        </div>
      </div>
      {linkHref && (
        <Link
          href={linkHref}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ghn-red)] hover:underline"
        >
          {linkLabel ?? "Xem chi tiết"} <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ---------- Stage 1: Pickup ---------------------------------------------

function PickupSection({
  kpis,
  funnel,
}: {
  kpis: PickupKpis;
  funnel: ReturnType<typeof getJourneyFunnel>;
}) {
  return (
    <section className="space-y-3">
      <StageHeader
        step={1}
        label="Nhận hàng — Pickup"
        description="Người gửi mang đến bưu cục hoặc NVPTTT đi nhận tại địa chỉ. Đo throughput + tỷ lệ huỷ + trễ pickup."
        tone="green"
        anchorKey="pickup"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={kpis.successRate} size="sm" />
        <KpiCardFrom kpi={kpis.cancelRate} size="sm" />
        <KpiCardFrom kpi={kpis.lateRate} size="sm" />
        <KpiCardFrom
          kpi={kpis.avgTatMin}
          size="sm"
          hint="Từ lúc yêu cầu → nhập BC"
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card
            title="Funnel pickup hôm nay"
            subtitle="Yêu cầu pickup → NVPTTT đến → Lấy thành công → Nhập BC nhận."
          >
            <Funnel steps={funnel} />
          </Card>
        </div>
        <PickupSplitCard />
      </div>
    </section>
  );
}

function PickupSplitCard() {
  // Mock: ~62% pickup tại nhà (NVPTTT), 38% mang tới BC.
  const totalHome = 62;
  const totalBc = 38;
  return (
    <Card
      title="Phân bổ kênh pickup"
      subtitle="Tỷ trọng pickup tại nhà vs mang tới BC."
    >
      <div className="space-y-3">
        <ChannelRow label="NVPTTT đến địa chỉ người gửi" pct={totalHome} color="#F97316" />
        <ChannelRow label="Người gửi mang đến BC" pct={totalBc} color="#1F2937" />
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--color-border-soft)] text-xs text-[var(--color-text-muted)]">
        Pickup tại nhà chiếm phần lớn — TAT trung bình +12 phút vs mang tới BC.
      </div>
    </Card>
  );
}

function ChannelRow({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-text)]">{label}</span>
        <span className="font-semibold tabular-nums">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-[var(--color-hover)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ---------- Stage 2: BC nhận --------------------------------------------

function BcNhanSection({
  kpis,
  funnel,
}: {
  kpis: BcNhanKpis;
  funnel: ReturnType<typeof getJourneyFunnel>;
}) {
  return (
    <section className="space-y-3">
      <StageHeader
        step={2}
        label="Bưu cục nhận: xử lý & phân kiện"
        description="Tạo & bắn đơn → phân loại → đóng kiện → xuất KTC/BC giao. Nguồn rủi ro: sai mã, sai kiện, không có MVĐ."
        tone="blue"
        anchorKey="bcNhan"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={kpis.wrongCodeRate} size="sm" />
        <KpiCardFrom kpi={kpis.wrongPackageRate} size="sm" />
        <KpiCardFrom kpi={kpis.missingMvdRate} size="sm" />
        <KpiCardFrom
          kpi={kpis.processingTatMin}
          size="sm"
          hint="Tạo đơn → xuất kiện"
        />
      </div>
      <Card
        title="Funnel xử lý tại BC nhận"
        subtitle="Drop-off lớn ở Phân loại / Đóng kiện → BC đang nghẽn nhân lực."
      >
        <Funnel steps={funnel} />
      </Card>
    </section>
  );
}

// ---------- Stage 3: KTC ------------------------------------------------

function KtcSection({
  sortAccuracy,
  tatHub,
  missortRate,
  overstayRate,
  funnel,
  topUnderperformer,
}: {
  sortAccuracy: number;
  tatHub: number;
  missortRate: number;
  overstayRate: number;
  funnel: ReturnType<typeof getJourneyFunnel>;
  topUnderperformer: string;
}) {
  return (
    <section className="space-y-3">
      <StageHeader
        step={3}
        label="Kho trung chuyển (KTC)"
        description="Hub phân loại trung gian. Nhập → kiểm seal → phân loại → đóng kiện → xuất tiếp KTC/BC giao."
        tone="violet"
        anchorKey="ktc"
        linkHref="/network"
        linkLabel="Xem dashboard Mạng lưới"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KtcQuickStat
          label="Sort accuracy KTC"
          value={`${sortAccuracy.toFixed(2)}%`}
          status={sortAccuracy >= 99.5 ? "green" : sortAccuracy >= 98.5 ? "amber" : "red"}
        />
        <KtcQuickStat
          label="TAT tại KTC"
          value={`${tatHub.toFixed(1)}h`}
          status={tatHub <= 4 ? "green" : tatHub <= 8 ? "amber" : "red"}
        />
        <KtcQuickStat
          label="% Missort"
          value={`${missortRate.toFixed(1)}%`}
          status={missortRate <= 0.5 ? "green" : missortRate <= 1.5 ? "amber" : "red"}
        />
        <KtcQuickStat
          label="% Overstay (qua đêm)"
          value={`${overstayRate.toFixed(1)}%`}
          status={overstayRate <= 2 ? "green" : overstayRate <= 5 ? "amber" : "red"}
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card
            title="Funnel overstay KTC hôm nay"
            subtitle="Nhập KTC → sort xong → đóng kiện → xuất hàng."
          >
            <Funnel steps={funnel} />
          </Card>
        </div>
        <Card
          title="KTC cần chú ý nhất"
          subtitle="Đang underperform xa nhất theo TAT + sort accuracy."
        >
          <div className="space-y-2">
            <div className="text-xl font-semibold text-[var(--color-text)]">
              {topUnderperformer}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Mở dashboard Mạng lưới để xem chi tiết từng KTC, sort accuracy realtime, và lanes phụ thuộc.
            </div>
            <Link
              href="/network"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ghn-red)] hover:underline"
            >
              Drill xuống /network <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
}

function KtcQuickStat({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: "green" | "amber" | "red";
}) {
  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] truncate">
          {label}
        </div>
        <span
          className={`w-2 h-2 rounded-full ${STATUS_TOKENS[status].dot}`}
          aria-label={status}
        />
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-text)]">
        {value}
      </div>
    </div>
  );
}

// ---------- Stage 4: BC giao --------------------------------------------

function BcGiaoSection({
  kpis,
  funnel,
}: {
  kpis: BcGiaoKpis;
  funnel: ReturnType<typeof getJourneyFunnel>;
}) {
  const codPendingPct =
    kpis.codCollected === 0
      ? 0
      : (kpis.codPendingDeposit / kpis.codCollected) * 100;
  return (
    <section className="space-y-3">
      <StageHeader
        step={4}
        label="Bưu cục giao: last-mile"
        description="Nhập kiện · phân tuyến · NVBC giao. Kết quả: ✓ GTC · ~ GT1P · × GTB (>3 lần → chuyển hoàn)."
        tone="amber"
        anchorKey="bcGiao"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={kpis.gtcRate} size="sm" hint="Giao thành công" />
        <KpiCardFrom kpi={kpis.gt1pRate} size="sm" hint="Giao 1 phần" />
        <KpiCardFrom kpi={kpis.gtbRate} size="sm" hint="Giao thất bại" />
        <KpiCardFrom kpi={kpis.lostRate} size="sm" hint="Thất lạc / hư hỏng" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="xl:col-span-2">
          <Card
            title="Funnel last-mile hôm nay"
            subtitle="Nhập BC giao → phân tuyến → trên đường giao → giao thành công."
          >
            <Funnel steps={funnel} />
          </Card>
        </div>
        <Card title="COD hôm nay" subtitle="Tiền thu hộ — tổng & phần chưa nộp lại.">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Đã thu
              </div>
              <div className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
                {formatVND(kpis.codCollected, true)}
              </div>
              <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                ~{formatCompactInt(kpis.codCollected / 280_000)} đơn có COD
              </div>
            </div>
            <div className="pt-3 border-t border-[var(--color-border-soft)]">
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Chưa nộp lại
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-xl font-semibold tabular-nums text-[var(--color-text)]">
                  {formatVND(kpis.codPendingDeposit, true)}
                </div>
                <div
                  className={`text-xs font-medium ${
                    codPendingPct <= 10
                      ? "text-emerald-600"
                      : codPendingPct <= 25
                        ? "text-amber-600"
                        : "text-red-600"
                  }`}
                >
                  {codPendingPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

// ---------- Stage 5: BC hoàn --------------------------------------------

function BcHoanSection({
  kpis,
  funnel,
}: {
  kpis: BcHoanKpis;
  funnel: ReturnType<typeof getJourneyFunnel>;
}) {
  return (
    <section className="space-y-3">
      <StageHeader
        step={5}
        label="Bưu cục hoàn: xử lý & hoàn trả"
        description="Đơn GTB >3 lần hoặc yêu cầu hoàn → NVBC hoàn cho người gửi. Hoàn thất bại quá lâu → lưu kho."
        tone="rose"
        anchorKey="bcHoan"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCardFrom kpi={kpis.returnSuccessRate} size="sm" />
        <KpiCardFrom kpi={kpis.returnFailRate} size="sm" />
        <KpiCardFrom kpi={kpis.avgReturnDays} size="sm" hint="GTB → trả người gửi" />
        <KpiCardFrom kpi={kpis.storedRate} size="sm" hint="Lưu kho quá hạn" />
      </div>
      <Card
        title="Funnel hoàn trả"
        subtitle="Yêu cầu hoàn → nhập BC hoàn → NVBC giao hoàn → hoàn thành công."
      >
        <Funnel steps={funnel} />
      </Card>
    </section>
  );
}
