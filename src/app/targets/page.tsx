"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Info } from "lucide-react";
import { computeMetricValue } from "@/lib/aggregators";
import { getRegions, getKtcs, getBcs } from "@/lib/mock-data";
import {
  CHANNEL_LABEL_VI,
  LOAI_HANG_LABEL_VI,
  type ChannelCode,
  type LoaiHang,
} from "@/lib/types";
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
import { cn, formatValue } from "@/lib/utils";
import type { KpiUnit, Status } from "@/lib/types";

function scopeValueOptions(level: ScopeLevelKey): { value: string; label: string }[] {
  switch (level) {
    case "region":
      return getRegions().map((r) => ({ value: r.code, label: r.name }));
    case "channel":
      return (Object.keys(CHANNEL_LABEL_VI) as ChannelCode[]).map((k) => ({
        value: k,
        label: CHANNEL_LABEL_VI[k],
      }));
    case "loaiHang":
      return (Object.keys(LOAI_HANG_LABEL_VI) as LoaiHang[]).map((k) => ({
        value: k,
        label: LOAI_HANG_LABEL_VI[k],
      }));
    case "ktc":
      return getKtcs().map((k) => ({ value: k.code, label: k.name }));
    case "bc":
      return getBcs().map((b) => ({ value: b.code, label: b.name }));
    default:
      return [];
  }
}

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

  // Form state
  const [metricKey, setMetricKey] = useState<string>(TARGET_METRICS[0].key);
  const [scopeLevel, setScopeLevel] = useState<ScopeLevelKey>("all");
  const [scopeValue, setScopeValue] = useState<string>("");
  const [targetInput, setTargetInput] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setTargets(loadTargets());
    setHydrated(true);
  }, []);

  const persist = (list: TargetRecord[]) => {
    setTargets(list);
    saveTargets(list);
  };

  const metric = metricByKey(metricKey)!;
  const scopeOpts = useMemo(() => scopeValueOptions(scopeLevel), [scopeLevel]);

  // Giá trị hiện tại (30 ngày) cho preview trong form
  const previewActual = useMemo(
    () => computeMetricValue(metricKey, scopeLevel, scopeValue),
    [metricKey, scopeLevel, scopeValue],
  );

  const scopeMissing = scopeLevel !== "all" && !scopeValue;
  const targetNum = Number(targetInput);
  const canSave = !scopeMissing && targetInput !== "" && Number.isFinite(targetNum);

  const resetForm = () => {
    setEditingId(null);
    setScopeValue("");
    setTargetInput("");
    setNote("");
  };

  const handleSave = () => {
    if (!canSave) return;
    const scopeLabel =
      scopeLevel === "all"
        ? "Toàn mạng"
        : `${scopeLevelLabel(scopeLevel)} · ${
            scopeOpts.find((o) => o.value === scopeValue)?.label ?? scopeValue
          }`;
    const now = new Date().toISOString();

    let list: TargetRecord[];
    if (editingId) {
      list = targets.map((t) =>
        t.id === editingId
          ? { ...t, metricKey, scopeLevel, scopeValue, scopeLabel, target: targetNum, note, updatedAt: now }
          : t,
      );
    } else {
      // gộp nếu đã có cùng metric + scope
      const existing = targets.find(
        (t) => t.metricKey === metricKey && t.scopeLevel === scopeLevel && t.scopeValue === scopeValue,
      );
      if (existing) {
        list = targets.map((t) =>
          t.id === existing.id ? { ...t, scopeLabel, target: targetNum, note, updatedAt: now } : t,
        );
      } else {
        list = [
          { id: newId(), metricKey, scopeLevel, scopeValue, scopeLabel, target: targetNum, note, updatedAt: now },
          ...targets,
        ];
      }
    }
    persist(list);
    resetForm();
  };

  const handleEdit = (t: TargetRecord) => {
    setEditingId(t.id);
    setMetricKey(t.metricKey);
    setScopeLevel(t.scopeLevel);
    setScopeValue(t.scopeValue);
    setTargetInput(String(t.target));
    setNote(t.note ?? "");
  };

  const handleDelete = (id: string) => {
    persist(targets.filter((t) => t.id !== id));
    if (editingId === id) resetForm();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[{ label: "GHN Network Ops", href: "/" }, { label: "Quản lý mục tiêu" }]}
        title="Quản lý mục tiêu"
        subtitle="Admin đặt target cho từng key metric theo phạm vi (toàn mạng / vùng / channel / loại hàng / KTC / BC). Giá trị hiện tại tính trên 30 ngày gần nhất."
      />

      <div className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-hover)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Mục tiêu được lưu cục bộ trên trình duyệt này (localStorage) — phục vụ demo/admin.
          Khi nối backend, thay <code className="font-mono">loadTargets/saveTargets</code> bằng API là dùng chung toàn tổ chức.
        </span>
      </div>

      {/* === Form đặt / cập nhật mục tiêu === */}
      <Card
        title={editingId ? "Cập nhật mục tiêu" : "Đặt mục tiêu mới"}
        subtitle="Chọn chỉ số + phạm vi + giá trị target. Hệ thống tự đối chiếu với giá trị hiện tại."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <Field label="Chỉ số">
            <DimensionSelect
              label="Chỉ số"
              value={metricKey}
              options={TARGET_METRICS.map((m) => ({ value: m.key, label: m.label }))}
              onChange={(v) => v && setMetricKey(v)}
              allOptionLabel="Chọn chỉ số"
              width={260}
              searchable
            />
          </Field>

          <Field label="Cấp phạm vi">
            <DimensionSelect
              label="Cấp phạm vi"
              value={scopeLevel}
              options={SCOPE_LEVELS.map((s) => ({ value: s.key, label: s.label }))}
              onChange={(v) => {
                setScopeLevel((v as ScopeLevelKey) ?? "all");
                setScopeValue("");
              }}
              allOptionLabel="Toàn mạng"
              width={220}
            />
          </Field>

          {scopeLevel !== "all" && (
            <Field label={`Chọn ${scopeLevelLabel(scopeLevel).toLowerCase()}`}>
              <DimensionSelect
                label={scopeLevelLabel(scopeLevel)}
                value={scopeValue || undefined}
                options={scopeOpts}
                onChange={(v) => setScopeValue(v ?? "")}
                allOptionLabel={`Chọn ${scopeLevelLabel(scopeLevel).toLowerCase()}`}
                width={260}
                searchable={scopeLevel === "bc" || scopeLevel === "ktc"}
              />
            </Field>
          )}

          <Field label={`Mục tiêu (${metric.unit})`}>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="any"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder={`vd ${metric.defaultTarget}`}
                className="w-32 rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--color-ghn-red)]"
              />
              <button
                type="button"
                onClick={() => setTargetInput(String(metric.defaultTarget))}
                className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
              >
                dùng mặc định {metric.defaultTarget}
              </button>
            </div>
          </Field>

          <Field label="Ghi chú (tuỳ chọn)">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="vd: mục tiêu Q3, theo cam kết KH…"
              className="w-full rounded-md border border-[var(--color-border)] px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-ghn-red)]"
            />
          </Field>

          <Field label="Giá trị hiện tại (30 ngày)">
            <div className="flex items-center gap-2 py-1.5">
              <span className="text-lg font-semibold tabular-nums text-[var(--color-text)]">
                {formatValue(previewActual, metric.unit as KpiUnit)}
              </span>
              {metric.tripBased && scopeLevel !== "all" && (
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  (trip-based: ở mức toàn mạng)
                </span>
              )}
            </div>
          </Field>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "px-3.5 py-1.5 rounded-md text-sm font-medium text-white",
              canSave
                ? "bg-[var(--color-ghn-red)] hover:opacity-90"
                : "bg-[var(--color-border)] cursor-not-allowed",
            )}
          >
            {editingId ? "Cập nhật mục tiêu" : "Lưu mục tiêu"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 rounded-md text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]"
            >
              Huỷ
            </button>
          )}
          {scopeMissing && (
            <span className="text-xs text-amber-600">Chọn giá trị phạm vi trước khi lưu.</span>
          )}
        </div>
      </Card>

      {/* === Danh sách mục tiêu === */}
      <Card
        title={`Mục tiêu đã đặt — ${targets.length}`}
        subtitle="Đối chiếu giá trị hiện tại vs mục tiêu. Xanh = đạt · vàng = sát · đỏ = chưa đạt."
      >
        {!hydrated ? (
          <div className="h-24 ghn-skeleton rounded-md" />
        ) : targets.length === 0 ? (
          <div className="border border-dashed border-[var(--color-border)] rounded-md p-8 text-center text-sm text-[var(--color-text-muted)]">
            Chưa có mục tiêu nào. Dùng form phía trên để đặt target đầu tiên.
          </div>
        ) : (
          <TargetTable targets={targets} onEdit={handleEdit} onDelete={handleDelete} />
        )}
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function TargetTable({
  targets,
  onEdit,
  onDelete,
}: {
  targets: TargetRecord[];
  onEdit: (t: TargetRecord) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto border border-[var(--color-border)] rounded-md">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-[var(--color-table-head)]">
          <tr>
            {["Chỉ số", "Phạm vi", "Mục tiêu", "Hiện tại", "Chênh lệch", "Ghi chú", "Cập nhật", ""].map(
              (h, i) => (
                <th
                  key={h + i}
                  className={cn(
                    "px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] font-medium whitespace-nowrap",
                    i >= 2 && i <= 4 ? "text-right" : "text-left",
                  )}
                >
                  {h}
                </th>
              ),
            )}
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
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={status} />
                    <span className="font-medium">{m?.label ?? t.metricKey}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{t.scopeLabel}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {formatValue(t.target, unit)}
                </td>
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
                <td className="px-3 py-2 text-xs text-[var(--color-text-muted)] max-w-[180px] truncate">
                  {t.note || "—"}
                </td>
                <td className="px-3 py-2 text-xs text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                  {t.updatedAt.slice(0, 10)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      aria-label="Sửa"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      className="p-1 text-[var(--color-text-muted)] hover:text-red-600"
                      aria-label="Xoá"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
