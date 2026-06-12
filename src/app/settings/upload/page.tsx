"use client";

import { useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Trash2,
  Upload as UploadIcon,
  UploadCloud,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { useUploadedData } from "@/components/upload/UploadedDataContext";
import {
  DATASETS,
  type DatasetSpec,
  type ParseResult,
  type UploadedDatasetKey,
} from "@/lib/upload-templates";
import { downloadCSV, readFileAsText } from "@/lib/csv";
import { dataUpdatedAt } from "@/lib/mock-data";
import { cn, formatInt } from "@/lib/utils";

type StatusMsg =
  | { kind: "success"; text: string }
  | { kind: "error"; text: string }
  | { kind: "warning"; text: string };

// Map dataset → which dashboard page it shows up on (for quick deep-link)
const DATASET_HREF: Record<UploadedDatasetKey, string> = {
  "ops-scorecard": "/",
  "cost-by-category": "/",
  "lane-perf": "/network#stage-inter-ktc",
  "ktc-status": "/network#stage-realtime",
};

export default function UploadPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumb={[
          { label: "GHN Network Ops", href: "/" },
          { label: "Tải lên dữ liệu" },
        ]}
        title="Tải lên dữ liệu vận hành"
        subtitle="Tải template CSV về, điền số liệu thực tế, upload lại để dashboard hiển thị thay cho mock data."
        updatedAt={dataUpdatedAt()}
        showDefaultActions={false}
      />

      <AlertBanner
        alerts={[
          {
            id: "ls-only",
            severity: "info",
            title:
              "Dữ liệu được lưu LOCAL trên trình duyệt (localStorage). Không gửi lên server. Xoá cache trình duyệt = mất dữ liệu.",
          },
        ]}
      />

      <StatusSummary />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {(Object.keys(DATASETS) as UploadedDatasetKey[]).map((k) => (
          <DatasetCard key={k} spec={DATASETS[k]} />
        ))}
      </div>
    </div>
  );
}

// ---------- StatusSummary at top ---------------------------------------

function StatusSummary() {
  const { store, clearAll } = useUploadedData();
  const keys = Object.keys(DATASETS) as UploadedDatasetKey[];
  const uploadedCount = keys.filter((k) => store[k] !== undefined).length;

  return (
    <div className="border border-[var(--color-border)] rounded-md bg-white p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm">
          <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Tình trạng datasets
          </span>
          <div className="mt-0.5">
            <span className="text-2xl font-semibold tabular-nums text-[var(--color-text)]">
              {uploadedCount}
            </span>
            <span className="ml-1 text-sm text-[var(--color-text-muted)]">
              / {keys.length} đang dùng dữ liệu upload
            </span>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={() => {
            if (uploadedCount === 0) return;
            if (
              confirm(
                "Xoá TẤT CẢ dữ liệu upload? Dashboard sẽ quay về mock data.",
              )
            ) {
              clearAll();
            }
          }}
          disabled={uploadedCount === 0}
        >
          Xoá tất cả
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {keys.map((k) => {
          const isUploaded = store[k] !== undefined;
          const rows = store[k];
          return (
            <a
              key={k}
              href={`#dataset-${k}`}
              className={cn(
                "flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs transition-colors",
                isUploaded
                  ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                  : "border-[var(--color-border)] bg-white hover:bg-[var(--color-hover)]",
              )}
            >
              {isUploaded ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-[var(--color-text-faint)] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate text-[var(--color-text)]">
                  {DATASETS[k].label}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                  {isUploaded
                    ? `${formatInt(rows?.length ?? 0)} dòng upload`
                    : "Đang dùng mock"}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ---------- DatasetCard -------------------------------------------------

function DatasetCard({ spec }: { spec: DatasetSpec }) {
  const { get, set, clear } = useUploadedData();
  const rows = get<Record<string, unknown>>(spec.key);
  const isUploaded = rows !== undefined;
  const [status, setStatus] = useState<StatusMsg | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setStatus(null);
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setStatus({ kind: "error", text: "Chỉ chấp nhận file .csv" });
      return;
    }
    try {
      const text = await readFileAsText(file);
      const result = spec.parse(text) as ParseResult<Record<string, unknown>>;
      if (!result.ok) {
        setStatus({ kind: "error", text: result.error });
        return;
      }
      set(spec.key, result.rows);
      const warnText = result.warnings.length
        ? ` · ${result.warnings.length} cảnh báo`
        : "";
      setStatus({
        kind: result.warnings.length ? "warning" : "success",
        text: `Đã nạp ${result.rows.length} dòng${warnText}`,
      });
      setShowPreview(true);
    } catch (e) {
      setStatus({ kind: "error", text: `Lỗi đọc file: ${(e as Error).message}` });
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div id={`dataset-${spec.key}`} className="scroll-mt-20">
      <Card
        title={spec.label}
        subtitle={spec.description}
        actions={
          isUploaded ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-md">
              <CheckCircle2 className="w-3 h-3" />
              {formatInt(rows?.length ?? 0)} dòng upload
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-md">
              Đang dùng mock
            </span>
          )
        }
      >
        <div className="space-y-3">
          {/* Affected page */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--color-text-muted)]">
              <span className="font-medium">Áp dụng vào:</span> {spec.affects}
            </span>
            {isUploaded && (
              <Link
                href={DATASET_HREF[spec.key]}
                className="inline-flex items-center gap-1 font-medium text-[var(--color-ghn-red)] hover:underline shrink-0"
              >
                Xem trên dashboard <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          {/* Drag-drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-md p-4 text-center cursor-pointer transition-colors",
              dragOver
                ? "border-[var(--color-ghn-red)] bg-[var(--color-row-selected)]"
                : "border-[var(--color-border)] hover:bg-[var(--color-hover)]",
            )}
          >
            <UploadCloud
              className={cn(
                "w-6 h-6 mx-auto mb-1.5",
                dragOver
                  ? "text-[var(--color-ghn-red)]"
                  : "text-[var(--color-text-muted)]",
              )}
            />
            <div className="text-sm font-medium text-[var(--color-text)]">
              Kéo thả file CSV vào đây
            </div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
              hoặc click để chọn từ máy
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="w-3.5 h-3.5" />}
              onClick={() =>
                downloadCSV(spec.fileName, spec.generateTemplate())
              }
            >
              Tải template CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<UploadIcon className="w-3.5 h-3.5" />}
              onClick={() => inputRef.current?.click()}
            >
              Chọn file
            </Button>
            {isUploaded && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={
                    showPreview ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={() => setShowPreview((v) => !v)}
                >
                  {showPreview ? "Ẩn preview" : "Xem preview"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => {
                    clear(spec.key);
                    setStatus(null);
                    setShowPreview(false);
                  }}
                >
                  Xoá upload
                </Button>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Status message */}
          {status && (
            <div
              className={cn(
                "flex items-start gap-2 px-3 py-2 text-xs rounded-md border",
                status.kind === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : status.kind === "warning"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-red-50 border-red-200 text-red-800",
              )}
            >
              {status.kind === "error" || status.kind === "warning" ? (
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              )}
              <span>{status.text}</span>
            </div>
          )}

          {/* Column hints (collapsed by default) */}
          <details className="border border-[var(--color-border-soft)] rounded-md">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-hover)] select-none">
              Xem định nghĩa cột ({spec.columnHints.length} cột)
            </summary>
            <table className="w-full text-xs border-t border-[var(--color-border-soft)]">
              <thead className="bg-[var(--color-table-head)]">
                <tr>
                  <th className="text-left px-3 py-1.5 text-[var(--color-text-muted)] font-medium">
                    Cột
                  </th>
                  <th className="text-left px-3 py-1.5 text-[var(--color-text-muted)] font-medium">
                    Kiểu
                  </th>
                  <th className="text-left px-3 py-1.5 text-[var(--color-text-muted)] font-medium">
                    Giải thích
                  </th>
                </tr>
              </thead>
              <tbody>
                {spec.columnHints.map((c) => (
                  <tr
                    key={c.name}
                    className="border-t border-[var(--color-border-soft)]"
                  >
                    <td className="px-3 py-1.5 font-mono text-[11px] text-[var(--color-text)]">
                      {c.name}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--color-text-muted)]">
                      {c.type}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--color-text)]">
                      {c.hint}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          {/* Preview table */}
          {isUploaded && showPreview && rows && rows.length > 0 && (
            <PreviewTable rows={rows} maxRows={5} />
          )}
        </div>
      </Card>
    </div>
  );
}

function PreviewTable({
  rows,
  maxRows = 5,
}: {
  rows: Record<string, unknown>[];
  maxRows?: number;
}) {
  const sample = rows.slice(0, maxRows);
  const headers = Array.from(
    new Set(sample.flatMap((r) => Object.keys(r))),
  );
  return (
    <div className="border border-[var(--color-border)] rounded-md overflow-hidden">
      <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-table-head)]">
        Preview {sample.length} / {rows.length} dòng
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[var(--color-table-head)]">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-1.5 text-[var(--color-text-muted)] font-medium border-t border-[var(--color-border-soft)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.map((r, i) => (
              <tr
                key={i}
                className="border-t border-[var(--color-border-soft)]"
              >
                {headers.map((h) => {
                  const v = r[h];
                  return (
                    <td
                      key={h}
                      className="px-3 py-1.5 text-[var(--color-text)] tabular-nums whitespace-nowrap"
                    >
                      {v === null || v === undefined || v === ""
                        ? "-"
                        : typeof v === "object"
                          ? JSON.stringify(v)
                          : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
