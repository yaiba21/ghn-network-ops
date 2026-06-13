// Pure helpers for serializing/parsing FilterState ↔ URLSearchParams.
// Kept separate from the React context so they're testable in isolation.

import { addDays, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { defaultFilter } from "./mock-data";
import { toISODate } from "./utils";
import type {
  CaCode,
  Carrier,
  ChannelCode,
  FilterState,
  Granularity,
  LoaiBcCode,
  LoaiHang,
  LoaiTuyen,
  RegionCode,
  ServiceType,
  SlaDays,
  TimePreset,
  VehicleType,
} from "./types";

const TODAY_ISO = "2026-05-20"; // mirrors mock-data TODAY

const SERVICE_TYPES: ServiceType[] = ["standard", "bulky", "express"];
const REGIONS: (RegionCode | "all")[] = ["all", "bac", "trung", "nam"];
const GRANULARITIES: Granularity[] = ["daily", "weekly", "monthly"];
const PRESETS: TimePreset[] = ["today", "week", "month", "custom"];
const VEHICLES: (VehicleType | "all")[] = ["all", "truck", "container", "van"];
const CARRIERS: (Carrier | "all")[] = ["all", "internal", "tpl-a", "tpl-b", "tpl-c"];

// Phase 1 — Dimensions mới
const CHANNELS_ALL: (ChannelCode | "all")[] = ["all", "tts", "spe", "sme", "ka", "b2b", "cb"];
const LOAI_BCS_ALL: (LoaiBcCode | "all")[] = [
  "all",
  "hon-hop",
  "chuyen-giao",
  "chuyen-lay",
  "b2b",
  "gxt",
  "hang-vua",
  "khl",
  "ahamove",
];
const CAS_ALL: (CaCode | "all")[] = ["all", "ca1", "ca2", "ca3"];
const LOAI_HANGS_ALL: (LoaiHang | "all")[] = ["all", "standard", "bulky"];
const LOAI_TUYENS_ALL: (LoaiTuyen | "all")[] = ["all", "noi-vung", "lien-vung"];
const SLA_DAYS_ALL: (SlaDays | "all")[] = ["all", 1, 2, 3];

export function presetToRange(preset: TimePreset): { from: string; to: string } {
  const today = parseISO(TODAY_ISO);
  if (preset === "today") return { from: TODAY_ISO, to: TODAY_ISO };
  if (preset === "week") {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    return { from: toISODate(start), to: TODAY_ISO };
  }
  if (preset === "month") {
    const start = startOfMonth(today);
    return { from: toISODate(start), to: TODAY_ISO };
  }
  // custom — fall back to last 30 days
  return { from: toISODate(addDays(today, -29)), to: TODAY_ISO };
}

export function parseFilterFromParams(sp: URLSearchParams): FilterState {
  const base = defaultFilter();
  const preset = (sp.get("preset") as TimePreset) ?? base.preset;
  const validPreset = PRESETS.includes(preset) ? preset : base.preset;

  let from = sp.get("from") ?? base.from;
  let to = sp.get("to") ?? base.to;
  if (validPreset !== "custom") {
    const r = presetToRange(validPreset);
    from = r.from;
    to = r.to;
  }

  const granularity = (sp.get("g") as Granularity) ?? base.granularity;
  const validG = GRANULARITIES.includes(granularity) ? granularity : base.granularity;

  const region = sp.get("r") as RegionCode | "all" | null;
  const validRegion =
    region && REGIONS.includes(region) ? region : (base.regionCode ?? "all");

  const svcRaw = sp.get("svc");
  const services: ServiceType[] = svcRaw
    ? svcRaw
        .split(",")
        .filter((s): s is ServiceType => SERVICE_TYPES.includes(s as ServiceType))
    : base.serviceTypes;

  const veh = sp.get("veh") as VehicleType | "all" | null;
  const validVeh = veh && VEHICLES.includes(veh) ? veh : "all";

  const car = sp.get("car") as Carrier | "all" | null;
  const validCar = car && CARRIERS.includes(car) ? car : "all";

  // Phase 1 — new dimensions
  const ch = sp.get("ch") as ChannelCode | "all" | null;
  const validCh = ch && CHANNELS_ALL.includes(ch) ? ch : "all";

  const lbc = sp.get("lbc") as LoaiBcCode | "all" | null;
  const validLbc = lbc && LOAI_BCS_ALL.includes(lbc) ? lbc : "all";

  const ca = sp.get("ca") as CaCode | "all" | null;
  const validCa = ca && CAS_ALL.includes(ca) ? ca : "all";

  const lh = sp.get("lh") as LoaiHang | "all" | null;
  const validLh = lh && LOAI_HANGS_ALL.includes(lh) ? lh : "all";

  const lt = sp.get("lt") as LoaiTuyen | "all" | null;
  const validLt = lt && LOAI_TUYENS_ALL.includes(lt) ? lt : "all";

  const slaRaw = sp.get("sla");
  const slaNum =
    slaRaw === "1" ? 1 : slaRaw === "2" ? 2 : slaRaw === "3" ? 3 : null;
  const validSla: SlaDays | "all" = slaNum ?? "all";

  return {
    preset: validPreset,
    from,
    to,
    granularity: validG,
    regionCode: validRegion,
    provinceCode: sp.get("p") ?? undefined,
    districtCode: sp.get("d") ?? undefined,
    wardCode: sp.get("w") ?? undefined,
    serviceTypes: services,
    ktcCode: sp.get("ktc") ?? undefined,
    laneCode: sp.get("lane") ?? undefined,
    vehicleType: validVeh,
    carrier: validCar,
    // Phase 1
    bcCode: sp.get("bc") ?? undefined,
    channelCode: validCh,
    loaiBc: validLbc,
    caCode: validCa,
    loaiHang: validLh,
    loaiTuyen: validLt,
    slaDays: validSla,
  };
}

export function serializeFilter(filter: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (filter.preset !== "month") sp.set("preset", filter.preset);
  if (filter.preset === "custom") {
    sp.set("from", filter.from);
    sp.set("to", filter.to);
  }
  if (filter.granularity !== "daily") sp.set("g", filter.granularity);
  if (filter.regionCode && filter.regionCode !== "all") sp.set("r", filter.regionCode);
  if (filter.provinceCode) sp.set("p", filter.provinceCode);
  if (filter.districtCode) sp.set("d", filter.districtCode);
  if (filter.wardCode) sp.set("w", filter.wardCode);
  if (filter.serviceTypes.length) sp.set("svc", filter.serviceTypes.join(","));
  if (filter.ktcCode) sp.set("ktc", filter.ktcCode);
  if (filter.laneCode) sp.set("lane", filter.laneCode);
  if (filter.vehicleType && filter.vehicleType !== "all") sp.set("veh", filter.vehicleType);
  if (filter.carrier && filter.carrier !== "all") sp.set("car", filter.carrier);
  // Phase 1
  if (filter.bcCode) sp.set("bc", filter.bcCode);
  if (filter.channelCode && filter.channelCode !== "all") sp.set("ch", filter.channelCode);
  if (filter.loaiBc && filter.loaiBc !== "all") sp.set("lbc", filter.loaiBc);
  if (filter.caCode && filter.caCode !== "all") sp.set("ca", filter.caCode);
  if (filter.loaiHang && filter.loaiHang !== "all") sp.set("lh", filter.loaiHang);
  if (filter.loaiTuyen && filter.loaiTuyen !== "all") sp.set("lt", filter.loaiTuyen);
  if (filter.slaDays && filter.slaDays !== "all") sp.set("sla", String(filter.slaDays));
  return sp;
}

/**
 * Patch a filter and auto-clear stale cascading fields:
 * - Changing region clears province/district/ward/ktc.
 * - Changing province clears district/ward.
 * - Changing district clears ward.
 * - Changing preset to !=custom resets from/to to the preset range.
 */
export function patchFilter(prev: FilterState, patch: Partial<FilterState>): FilterState {
  const next: FilterState = { ...prev, ...patch };

  if ("regionCode" in patch && patch.regionCode !== prev.regionCode) {
    next.provinceCode = undefined;
    next.districtCode = undefined;
    next.wardCode = undefined;
    next.ktcCode = undefined;
  }
  if ("provinceCode" in patch && patch.provinceCode !== prev.provinceCode) {
    next.districtCode = undefined;
    next.wardCode = undefined;
    next.bcCode = undefined;
  }
  if ("districtCode" in patch && patch.districtCode !== prev.districtCode) {
    next.wardCode = undefined;
  }
  if ("preset" in patch && patch.preset && patch.preset !== "custom") {
    const r = presetToRange(patch.preset);
    next.from = r.from;
    next.to = r.to;
  }

  return next;
}
