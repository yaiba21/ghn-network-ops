"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, Info } from "lucide-react";
import { computeMetricValue, getMetricBreakdown } from "@/lib/aggregators";
import {
  SCOPE_LEVELS,
  TARGET_METRICS,
  loadTargets,
  metricByKey,
  saveTargets,
  scopeLevelLabel,
  type ScopeLevelKey,
  type TargetRecord,
} from "@/lib/targets";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DimensionSelect } from "@/components/filter/DimensionSelect";
import { StatusDot } from "@/components/ui/StatusDot";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn, formatValue } from "@/lib/utils";
import type { KpiUnit, Status } from "@/lib/types";

function targetStatus(
  actual: number,
  target: number,
  direction: "higher-better" | "lower-better",
): Status {
  const ok = direction === "higher-better" ? actual >= target : actual <= target;
  if (ok) return "green";
  const near = target !== 0 && Math.abs(actual - target) <= Math.abs(target) * 0.05;
  return near ? "amber" : "red";
}

function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  return c?.randomUUID ? c.randomUUID() : `t-${Date.now()}-${Math.round(performance.now())}`;
}

export default function TargetsPage() {
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [metricKey, setMetricKey] = useState<string>(TARGET_METRICS[0].key);
  const [scopeLevel, setScopeLevel] = useState<ScopeLevelKey>("region");

  useEffect(() => {
    setTargets(loadTargets());
    setHydrated(true);
  }, []);

  const persist = (list: TargetRecord[]) => {
    setTargets(list);
    saveTargets(list);
  };

  const metric = metricByKey(metricKey)!;
  const unit = metric.unit as KpiUnit;
  const breakdown = useMemo(
    () => getMetricBreakdown(metricKey, scopeLevel),
    [metricKey, scopeLevel],
  );

  // Map nhanh target đã lưu theo (metric|level|value)
  const targetMap = useMemo(() => {
    const m = new Map<string, TargetRecord>();
    targets.forEach((t) => m.set(`${t.metricKey}|${t.scopeLevel}|${t.scopeValue}`, t));
    return m;
  }, [targets]);

  const setRowTarget = (scopeValue: string, label: string, raw: string) => {
    const key = `${metricKey}|${scopeLevel}|${scopeValue}`;
    const existing = targetMap.get(key);
    const trimmed = raw.trim();
    if (trimmed === "") {
      // xoá target nếu để trống
      if (existing) persist(targets.filter((t) => t.id !== existing.id));
      return;
    }
    const val = Number(trimmed);
    if (!Number.isFinite(val)) return;
    const scopeLabel =
      scopeLevel === "all" ? "Toàn mạng" : `${scopeLevelLabel(scopeLevel)} · ${label}`;
    const now = new Date().toISOString();
    if (existing) {
      persist(
        targets.map((t) =>
          t.id === existing.id ? { ...t, target: val, scopeLabel, updatedAt: now } : t,
        ),
      );
    } else {
      persist([
        { id: newId(), metricKey, scopeLevel, scopeValue, scopeLabel, target: val, updatedAt: now },
        ...targets,
      ]);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Quản lý mục tiêu" }]}
        title="Quản lý mục tiêu"
        subtitle="Đặt target cho key metric theo từng cấp phạm vi. Nhập trực tiếp vào cột Mục tiêu ở bảng breakdown; có số kỳ trước + trend để so sánh target cao/thấp."
      />

      <div className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-hover)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Mục tiêu lưu cục bộ trên trình duyệt (localStorage). Số liệu hiện tại = 15 ngày gần nhất,
          kỳ trước = 15 ngày liền trước. Khi nối backend, thay loadTargets/saveTargets bằng API.
        </span>
      </div>

      {/* === Chọn chỉ số + cấp breakdown === */}
      <div className="flex flex-wrap items-end gap-3">
        <DimensionSelect
          label="Chỉ số"
          value={metricKey}
          options={TARGET_METRICS.map((m) => ({ value: m.key, label: m.label }))}
          onChange={(v) => v && setMetricKey(v)}
          allOptionLabel="Chọn chỉ số"
          width={260}
          searchable
        />
        <DimensionSelect
          label="Breakdown theo"
          value={scopeLevel}
          options={SCOPE_LEVELS.map((s) => ({ value: s.key, label: s.label }))}
          onChange={(v) => v && setScopeLevel(v as ScopeLevelKey)}
          allOptionLabel="Toàn mạng"
          width={220}
        />
        <div className="text-xs text-[var(--color-text-muted)] pb-2">
          {metric.label} · đơn vị {metric.unit} ·{" "}
          {metric.direction === "higher-better" ? "cao hơn tốt" : "thấp hơn tốt"}
          {metric.tripBased && scopeLevel !== "all" ? " · (trip-based: số ở mức toàn mạng)" : ""}
        </div>
      </div>

      {/* === Bảng breakdown — set target inline === */}
      <Card
        title={`Đặt target — ${metric.label} theo ${scopeLevelLabel(scopeLevel)}`}
        subtitle="Nhập giá trị vào cột Mục tiêu để đặt/cập nhật (để trống = xoá). So với Hiện tại & Kỳ trước để biết target hợp lý."
      >
        <div className="overflow-x-auto border border-[var(--color-border)] rounded-md">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-[var(--color-table-head)]">
              <tr>
                {["", `${scopeLevelLabel(scopeLevel)}`, "Trend (30 ngày)", "Kỳ trước", "Hiện tại", "Mục tiêu", "Δ vs MT"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={cn(
                        "px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium whitespace-nowrap",
                        i >= 3 ? "text-right" : "text-left",
                      )}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {breakdown.map((r) => {
                const rec = targetMap.get(`${metricKey}|${scopeLevel}|${r.scopeValue}`);
                const hasTarget = !!rec;
                const status: Status | null = hasTarget
                  ? targetStatus(r.current, rec!.target, metric.direction)
                  : null;
                const delta = hasTarget ? r.current - rec!.target : 0;
                const deltaGood = metric.direction === "higher-better" ? delta >= 0 : delta <= 0;
                const trendVsPrev = r.current - r.prev;
                return (
                  <tr key={r.scopeValue || "all"} className="border-t border-[var(--color-border-soft)]">
                    <td className="px-2 py-2">{status ? <StatusDot status={status} /> : <span className="inline-block w-2 h-2" />}</td>
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Sparkline data={r.sparkline} status={status ?? "green"} width={72} height={22} />
                        <span
                          className={cn(
                            "text-[10px] tabular-nums",
                            Math.abs(trendVsPrev) < 0.05
                              ? "text-[var(--color-text-muted)]"
                              : trendVsPrev > 0
                                ? "text-emerald-600"
                                : "text-red-600",
                          )}
                        >
                          {trendVsPrev >= 0 ? "▲" : "▼"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[var(--color-text-muted)]">
                      {formatValue(r.prev, unit)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatValue(r.current, unit)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          step="any"
                          value={rec ? String(rec.target) : ""}
                          onChange={(e) => setRowTarget(r.scopeValue, r.label, e.target.value)}
                          placeholder={String(metric.defaultTarget)}
                          className="w-24 rounded-md border border-[var(--color-border)] px-2 py-1 text-sm text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-ghn-red)]"
                        />
                        <span className="text-[10px] text-[var(--color-text-muted)] w-6">
                          {unit === "%" ? "%" : "đ"}
                        </span>
                      </div>
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right tabular-nums font-medium",
                        !hasTarget
                          ? "text-[var(--color-text-faint)]"
                          : Math.abs(delta) < 0.01
                            ? "text-[var(--color-text-muted)]"
                            : deltaGood
                              ? "text-emerald-600"
                              : "text-red-600",
                      )}
                    >
                      {hasTarget ? `${delta >= 0 ? "+" : "−"}${formatValue(Math.abs(delta), unit)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[10px] text-[var(--color-text-muted)] flex gap-3">
          <span>Kỳ trước = 15 ngày trước · Hiện tại = 15 ngày gần nhất · Trend = 6 mốc/30 ngày</span>
        </div>
      </Card>

      {/* === Tất cả mục tiêu đã lưu === */}
      <Card
        title={`Tất cả mục tiêu đã lưu — ${targets.length}`}
        subtitle="Toàn bộ target đang đặt (mọi chỉ số & phạm vi). Đối chiếu hiện tại vs mục tiêu."
      >
        {!hydrated ? (
          <div className="h-16 ghn-skeleton rounded-md" />
        ) : targets.length === 0 ? (
          <div className="border border-dashed border-[var(--color-border)] rounded-md p-6 text-center text-sm text-[var(--color-text-muted)]">
            Chưa có mục tiêu nào. Nhập vào cột Mục tiêu ở bảng trên để bắt đầu.
          </div>
        ) : (
          <SavedTargets targets={targets} onDelete={(id) => persist(targets.filter((t) => t.id !== id))} />
        )}
      </Card>
    </div>
  );
}

function SavedTargets({
  targets,
  onDelete,
}: {
  targets: TargetRecord[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto border border-[var(--color-border)] rounded-md">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[var(--color-table-head)]">
          <tr>
            {["Chỉ số", "Phạm vi", "Mục tiêu", "Hiện tại", "Δ", "Cập nhật", ""].map((h, i) => (
              <th
                key={i}
                className={cn(
                  "px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium whitespace-nowrap",
                  i >= 2 && i <= 4 ? "text-right" : "text-left",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {targets.map((t) => {
            const m = metricByKey(t.metricKey);
            const unit = (m?.unit ?? "%") as KpiUnit;
            const dir = m?.direction ?? "higher-better";
            const actual = computeMetricValue(t.metricKey, t.scopeLevel, t.scopeValue);
            const status = targetStatus(actual, t.target, dir);
            const delta = actual - t.target;
            const deltaGood = dir === "higher-better" ? delta >= 0 : delta <= 0;
            return (
              <tr key={t.id} className="border-t border-[var(--color-border-soft)]">
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot status={status} />
                    <span className="font-medium">{m?.label ?? t.metricKey}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{t.scopeLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatValue(t.target, unit)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatValue(actual, unit)}</td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-medium",
                    Math.abs(delta) < 0.01
                      ? "text-[var(--color-text-muted)]"
                      : deltaGood
                        ? "text-emerald-600"
                        : "text-red-600",
                  )}
                >
                  {delta >= 0 ? "+" : "−"}
                  {formatValue(Math.abs(delta), unit)}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                  {t.updatedAt.slice(0, 10)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(t.id)}
                    className="p-1 text-[var(--color-text-muted)] hover:text-red-600"
                    aria-label="Xoá"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
