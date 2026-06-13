"use client";

import { useMemo, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { useFilter } from "./FilterContext";
import { DateRangePicker } from "./DateRangePicker";
import { GranularityToggle } from "./GranularityToggle";
import { DimensionSelect } from "./DimensionSelect";
import { ServiceTypeMulti } from "./ServiceTypeMulti";
import {
  getBcsByProvince,
  getDistricts,
  getKtcs,
  getLanes,
  getProvinces,
  getRegions,
  getWards,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  CA_LABEL_VI,
  CHANNEL_LABEL_VI,
  LOAI_BC_LABEL_VI,
  LOAI_HANG_LABEL_VI,
  LOAI_TUYEN_LABEL_VI,
  type CaCode,
  type ChannelCode,
  type LoaiBcCode,
  type LoaiHang,
  type LoaiTuyen,
  type SlaDays,
} from "@/lib/types";

type Props = {
  /** Toggle individual dimension controls per page (e.g. KTC only useful on Network). */
  show?: {
    region?: boolean;
    province?: boolean;
    district?: boolean;
    ward?: boolean;
    service?: boolean;
    granularity?: boolean;
    ktc?: boolean;
    lane?: boolean;
    vehicle?: boolean;
    carrier?: boolean;
    // Phase 1
    bc?: boolean;
    channel?: boolean;
    loaiBc?: boolean;
    ca?: boolean;
    loaiHang?: boolean;
    loaiTuyen?: boolean;
    slaDays?: boolean;
  };
  extras?: ReactNode;
  className?: string;
};

const DEFAULT_SHOW: Required<NonNullable<Props["show"]>> = {
  region: true,
  province: true,
  district: false,
  ward: false,
  service: true,
  granularity: true,
  ktc: false,
  lane: false,
  vehicle: false,
  carrier: false,
  // Phase 1 — off by default; pages enable per need
  bc: false,
  channel: false,
  loaiBc: false,
  ca: false,
  loaiHang: false,
  loaiTuyen: false,
  slaDays: false,
};

// Phase 1 — opts arrays
const CHANNEL_OPTS: { value: ChannelCode; label: string }[] = [
  "tts",
  "spe",
  "sme",
  "ka",
  "b2b",
  "cb",
].map((c) => ({ value: c as ChannelCode, label: CHANNEL_LABEL_VI[c as ChannelCode] }));

const LOAI_BC_OPTS: { value: LoaiBcCode; label: string }[] = [
  "hon-hop",
  "chuyen-giao",
  "chuyen-lay",
  "b2b",
  "gxt",
  "hang-vua",
  "khl",
  "ahamove",
].map((c) => ({ value: c as LoaiBcCode, label: LOAI_BC_LABEL_VI[c as LoaiBcCode] }));

const CA_OPTS: { value: CaCode; label: string }[] = [
  "ca1",
  "ca2",
  "ca3",
].map((c) => ({ value: c as CaCode, label: CA_LABEL_VI[c as CaCode] }));

const LOAI_HANG_OPTS: { value: LoaiHang; label: string }[] = [
  { value: "standard", label: LOAI_HANG_LABEL_VI.standard },
  { value: "bulky", label: LOAI_HANG_LABEL_VI.bulky },
];

const LOAI_TUYEN_OPTS: { value: LoaiTuyen; label: string }[] = [
  { value: "noi-vung", label: LOAI_TUYEN_LABEL_VI["noi-vung"] },
  { value: "lien-vung", label: LOAI_TUYEN_LABEL_VI["lien-vung"] },
];

const SLA_OPTS: { value: string; label: string }[] = [
  { value: "1", label: "1 ngày" },
  { value: "2", label: "2 ngày" },
  { value: "3", label: "3 ngày" },
];

const VEHICLE_OPTS = [
  { value: "truck", label: "Xe tải" },
  { value: "container", label: "Container" },
  { value: "van", label: "Xe nhỏ" },
] as const;

const CARRIER_OPTS = [
  { value: "internal", label: "Nội bộ" },
  { value: "tpl-a", label: "3PL A" },
  { value: "tpl-b", label: "3PL B" },
  { value: "tpl-c", label: "3PL C" },
] as const;

export function FilterBar({ show, extras, className }: Props) {
  const { filter, setFilter, resetFilter } = useFilter();
  const cfg = { ...DEFAULT_SHOW, ...(show ?? {}) };

  const regionOpts = useMemo(
    () => getRegions().map((r) => ({ value: r.code, label: r.name })),
    [],
  );
  const provinceOpts = useMemo(
    () =>
      getProvinces()
        .filter(
          (p) =>
            !filter.regionCode ||
            filter.regionCode === "all" ||
            p.regionCode === filter.regionCode,
        )
        .map((p) => ({ value: p.code, label: p.name })),
    [filter.regionCode],
  );
  const districtOpts = useMemo(
    () =>
      getDistricts(filter.provinceCode).map((d) => ({
        value: d.code,
        label: d.name,
      })),
    [filter.provinceCode],
  );
  const wardOpts = useMemo(
    () =>
      getWards(filter.districtCode).map((w) => ({
        value: w.code,
        label: w.name,
      })),
    [filter.districtCode],
  );
  const ktcOpts = useMemo(
    () =>
      getKtcs()
        .filter(
          (k) =>
            !filter.regionCode ||
            filter.regionCode === "all" ||
            k.regionCode === filter.regionCode,
        )
        .filter((k) => !filter.provinceCode || k.provinceCode === filter.provinceCode)
        .map((k) => ({ value: k.code, label: k.name })),
    [filter.regionCode, filter.provinceCode],
  );
  const laneOpts = useMemo(
    () => getLanes().map((l) => ({ value: l.code, label: l.name })),
    [],
  );
  const bcOpts = useMemo(
    () =>
      (filter.provinceCode
        ? getBcsByProvince(filter.provinceCode)
        : []
      ).map((b) => ({ value: b.code, label: b.name })),
    [filter.provinceCode],
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 p-3 border border-[var(--color-border)] bg-white rounded-md",
        className,
      )}
    >
      <DateRangePicker
        preset={filter.preset}
        from={filter.from}
        to={filter.to}
        onChange={(next) =>
          setFilter({ preset: next.preset, from: next.from, to: next.to })
        }
        className="min-w-[220px]"
      />

      {cfg.region && (
        <DimensionSelect
          label="Vùng"
          value={
            filter.regionCode && filter.regionCode !== "all"
              ? filter.regionCode
              : undefined
          }
          options={regionOpts}
          onChange={(v) => setFilter({ regionCode: v ?? "all" })}
          allOptionLabel="Toàn quốc"
          width={150}
        />
      )}

      {cfg.province && (
        <DimensionSelect
          label="Tỉnh / Thành"
          value={filter.provinceCode}
          options={provinceOpts}
          onChange={(v) => setFilter({ provinceCode: v })}
          allOptionLabel="Tất cả Tỉnh / Thành"
          width={200}
          searchable
        />
      )}

      {cfg.district && (
        <DimensionSelect
          label="Quận / Huyện"
          value={filter.districtCode}
          options={districtOpts}
          onChange={(v) => setFilter({ districtCode: v })}
          allOptionLabel="Tất cả Quận / Huyện"
          width={200}
          disabled={!filter.provinceCode}
          searchable
        />
      )}

      {cfg.ward && (
        <DimensionSelect
          label="Phường / Xã"
          value={filter.wardCode}
          options={wardOpts}
          onChange={(v) => setFilter({ wardCode: v })}
          allOptionLabel="Tất cả Phường / Xã"
          width={200}
          disabled={!filter.districtCode}
          searchable
        />
      )}

      {cfg.ktc && (
        <DimensionSelect
          label="KTC"
          value={filter.ktcCode}
          options={ktcOpts}
          onChange={(v) => setFilter({ ktcCode: v })}
          allOptionLabel="Tất cả KTC"
          width={220}
          searchable
        />
      )}

      {cfg.lane && (
        <DimensionSelect
          label="Lane"
          value={filter.laneCode}
          options={laneOpts}
          onChange={(v) => setFilter({ laneCode: v })}
          allOptionLabel="Tất cả lane"
          width={240}
          searchable
        />
      )}

      {cfg.vehicle && (
        <DimensionSelect
          label="Loại xe"
          value={
            filter.vehicleType && filter.vehicleType !== "all"
              ? filter.vehicleType
              : undefined
          }
          options={VEHICLE_OPTS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => setFilter({ vehicleType: v ?? "all" })}
          allOptionLabel="Tất cả loại xe"
          width={150}
        />
      )}

      {cfg.carrier && (
        <DimensionSelect
          label="Nhà thầu"
          value={
            filter.carrier && filter.carrier !== "all"
              ? filter.carrier
              : undefined
          }
          options={CARRIER_OPTS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) => setFilter({ carrier: v ?? "all" })}
          allOptionLabel="Tất cả nhà thầu"
          width={150}
        />
      )}

      {cfg.bc && (
        <DimensionSelect
          label="BC"
          value={filter.bcCode}
          options={bcOpts}
          onChange={(v) => setFilter({ bcCode: v })}
          allOptionLabel={
            filter.provinceCode ? "Tất cả BC" : "Chọn Tỉnh trước"
          }
          width={220}
          disabled={!filter.provinceCode}
          searchable
        />
      )}

      {cfg.channel && (
        <DimensionSelect
          label="Nguồn đơn"
          value={
            filter.channelCode && filter.channelCode !== "all"
              ? filter.channelCode
              : undefined
          }
          options={CHANNEL_OPTS}
          onChange={(v) => setFilter({ channelCode: v ?? "all" })}
          allOptionLabel="Tất cả nguồn"
          width={170}
        />
      )}

      {cfg.loaiBc && (
        <DimensionSelect
          label="Loại BC"
          value={
            filter.loaiBc && filter.loaiBc !== "all" ? filter.loaiBc : undefined
          }
          options={LOAI_BC_OPTS}
          onChange={(v) => setFilter({ loaiBc: v ?? "all" })}
          allOptionLabel="Tất cả loại BC"
          width={180}
        />
      )}

      {cfg.ca && (
        <DimensionSelect
          label="Ca"
          value={
            filter.caCode && filter.caCode !== "all" ? filter.caCode : undefined
          }
          options={CA_OPTS}
          onChange={(v) => setFilter({ caCode: v ?? "all" })}
          allOptionLabel="Tất cả ca"
          width={150}
        />
      )}

      {cfg.loaiHang && (
        <DimensionSelect
          label="Loại hàng"
          value={
            filter.loaiHang && filter.loaiHang !== "all"
              ? filter.loaiHang
              : undefined
          }
          options={LOAI_HANG_OPTS}
          onChange={(v) => setFilter({ loaiHang: v ?? "all" })}
          allOptionLabel="Tất cả"
          width={150}
        />
      )}

      {cfg.loaiTuyen && (
        <DimensionSelect
          label="Loại tuyến"
          value={
            filter.loaiTuyen && filter.loaiTuyen !== "all"
              ? filter.loaiTuyen
              : undefined
          }
          options={LOAI_TUYEN_OPTS}
          onChange={(v) => setFilter({ loaiTuyen: v ?? "all" })}
          allOptionLabel="Tất cả"
          width={150}
        />
      )}

      {cfg.slaDays && (
        <DimensionSelect
          label="SLA"
          value={
            filter.slaDays && filter.slaDays !== "all"
              ? String(filter.slaDays)
              : undefined
          }
          options={SLA_OPTS}
          onChange={(v) =>
            setFilter({
              slaDays:
                v === "1"
                  ? 1
                  : v === "2"
                    ? 2
                    : v === "3"
                      ? 3
                      : ("all" as const),
            })
          }
          allOptionLabel="Tất cả SLA"
          width={120}
        />
      )}

      {cfg.service && (
        <ServiceTypeMulti
          value={filter.serviceTypes}
          onChange={(v) => setFilter({ serviceTypes: v })}
          className="min-w-[180px]"
        />
      )}

      {cfg.granularity && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
            Mức tổng hợp
          </div>
          <GranularityToggle
            value={filter.granularity}
            onChange={(v) => setFilter({ granularity: v })}
          />
        </div>
      )}

      {extras}

      <div className="ml-auto self-end">
        <button
          type="button"
          onClick={resetFilter}
          className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-hover)] rounded-md"
        >
          <RotateCcw className="w-3 h-3" /> Đặt lại
        </button>
      </div>
    </div>
  );
}
