# GHN Network Ops Dashboard — Design Handoff

> Snapshot **2026-05-24** · Trạng thái: Phase 1 done (Page 0 Tổng quan ✓), Phase 2–4 pending. Tài liệu này dùng để tiếp tục design work bên ngoài code (Claude, Figma, v.v.) — đọc cùng với `ghn_dashboard_plan_1.md` (spec gốc 5 pages) để có ngữ cảnh.

---

## 1. Trạng thái hiện tại

### 1.1 Routes đã có

| URL | Page | Trạng thái | Sidebar label |
|---|---|---|---|
| `/` | Page 0 — Tổng quan | ✅ Done theo plan_1 | "Tổng quan" |
| `/order-journey` | Page 1 — Hành trình đơn | 🟡 Stub (placeholder) | "Hành trình đơn" |
| `/journey` | (legacy) Journey vận hành theo stage BC/KTC | ⚠️ Giữ từ pivot trước, không match plan_1 | "Journey vận hành" |
| `/routing` | Page 2 — Định tuyến (ORS) | ⚠️ Đã có content nhưng chưa audit vs plan_1 | "Định tuyến (ORS)" |
| `/network` | Page 3 — Mạng lưới (NDS + KTC) | ⚠️ Đã có content nhưng chưa audit vs plan_1 | "Mạng lưới (NDS + KTC)" |
| `/transportation` | Page 4 — Vận chuyển | ❌ Skip lúc này theo y/c | — |
| `/settings/upload` | Upload CSV để override mock | ✅ Done, đẩy xuống dưới Cài đặt | "Tải dữ liệu" (sub) |
| `/reports/daily`, `/reports/weekly` | — | ❌ Sidebar có link, page chưa build | "Daily ops" / "Weekly KPI" (sub) |

### 1.2 Sidebar IA hiện tại

```
📊 Tổng quan                 → /
📦 Hành trình đơn            → /order-journey
🔀 Journey vận hành          → /journey
🛣  Định tuyến (ORS)          → /routing
🚛 Mạng lưới (NDS + KTC)     → /network
📈 Báo cáo
   └─ Daily ops              → /reports/daily
   └─ Weekly KPI             → /reports/weekly
⚙️ Cài đặt
   └─ Tải dữ liệu            → /settings/upload
```

**Note**: Có sự trùng lặp `/order-journey` (Page 1 spec) vs `/journey` (legacy operational view). Cần quyết: gộp hay giữ song song.

### 1.3 Tech stack

- **Next.js 16.2.6** + **React 19** App Router + TypeScript
- **Tailwind v4** (`@theme` directive trong globals.css)
- **lucide-react** icons
- **recharts** charts
- **date-fns** + **seedrandom** (deterministic mock)
- **class-variance-authority** + **clsx** + **tailwind-merge** (variants + cn helper)

**Khác với plan_1**: spec yêu cầu Next.js 14 + shadcn/ui + Tremor + TanStack Query + Zustand. Hiện tại dùng Next 16, **không có shadcn/Tremor/TanStack/Zustand**. Components là tự viết theo design tokens GHN. Filter state lưu trong URL params qua `FilterContext`.

---

## 2. Design system (tokens locked)

Định nghĩa trong `src/app/globals.css` qua Tailwind v4 `@theme`:

### Colors

| Token | Value | Dùng cho |
|---|---|---|
| `--color-app-bg` / `--color-surface` | `#FFFFFF` | App + card background |
| `--color-border` | `#E5E5E5` | Default border |
| `--color-border-soft` | `#F3F4F6` | Row separator nhẹ |
| `--color-hover` | `#F5F5F5` | Hover row/button |
| `--color-row-selected` | `#FEF2F2` | Active sidebar item, selected row |
| `--color-table-head` | `#FAFAFA` | Table header bg |
| `--color-text` | `#1F2937` | Primary |
| `--color-text-muted` | `#6B7280` | Secondary |
| `--color-text-faint` | `#9CA3AF` | Muted |
| **`--color-ghn-red`** | `#DC2626` | Brand: active states, primary CTA outline |
| **`--color-ghn-orange`** | `#F97316` | Brand: logo box, accent (search button trước đó, đã bỏ) |
| `--color-status-green` | `#10B981` | Health: ok |
| `--color-status-amber` | `#F59E0B` | Health: warn |
| `--color-status-red` | `#EF4444` | Health: bad |

### Typography

- Font: **Inter** (via `next/font/google`)
- Tabular nums cho tất cả con số (`.tabular-nums`)
- Title: `text-xl font-semibold`
- Section header: `text-xs uppercase tracking-wide font-medium text-muted`
- Body: `text-sm`
- Big KPI value: `text-[44px] leading-none font-semibold`

### Components & variants

**Buttons** (`Button` với cva variants):
- `primary`: white bg, border `--color-ghn-red`, text đỏ, hover fill đỏ trắng
- `secondary`: white bg, border `--color-border`, text dark
- `ghost`: text muted, hover bg hover
- `danger`: bg đỏ trắng

**Cards/Tables**:
- Card: border `--color-border`, rounded-md, **không shadow**
- KpiCard: dense `p-4`, label uppercase top, value `text-3xl`, delta + sparkline + status dot
- BigKpiCard (Page 0): `p-5`, value `text-[44px]`, status pill (On target/At risk/Off target)
- HealthCard (Page 0): `p-3`, border-l-4 màu status, click → href
- Table: header bg `#FAFAFA` uppercase tracking-wide text-xs, cell padding `px-4 py-3`, numbers right-aligned, empty cells `-`

**Status indicators**:
- StatusDot: 8px circle
- Status pill: `bg-${green|amber|red}-50` + border + text colored — dùng cho BigKpiCard
- Border-left-2 đỏ + bg `#FEF2F2` — sidebar active item

### KPI threshold logic (`src/lib/kpi-config.ts`)

Mỗi metric khai báo:
```ts
{ key, label, unit, direction: 'higher-better' | 'lower-better',
  baseline, target, thresholds: [greenAt, amberAt] }
```
- `higher-better`: green nếu ≥ thresholds[0], amber nếu ≥ thresholds[1], else red
- `lower-better`: green nếu ≤ thresholds[0], amber nếu ≤ thresholds[1], else red

Hiện có ~45 KPI specs trong KPI dict — đầy đủ cho mọi page.

---

## 3. Page 0 — Tổng quan (✅ Done)

### Layout structure

```
PageHeader (no subtitle, no default action buttons)
  └─ Breadcrumb: "GHN Network Ops / Tổng quan"
  └─ Title: "Tổng quan vận hành"
  └─ Last updated: DD/MM/YYYY HH:mm

FilterBar (minimal: region toggle + service multi-select)

§1 North Star    [4 BigKpiCards full-width grid 4]
                 OTD · CPP · Volume hôm nay · Lost rate

§2 Sức khoẻ module    [8 HealthCards grid 4×2]
                       ORS · Pickup · KTC · Linehaul fill · Linehaul on-time
                       · %TC · TC lần 1 · Tỷ lệ hoàn

§3 Xu hướng 30 ngày   [4 line charts grid 2×2]
                       OTD · CPP · Volume(actual+forecast) · Return rate

§4 Cảnh báo 24h qua   [AlertFeed — list dạng vertical, click jump]

§5 Pulse hôm nay      [3 Gauges grid 3]
                       OTD · Volume · CPP
```

### Components dùng (chỉ Page 0)

| File | Mô tả |
|---|---|
| `components/overview/BigKpiCard.tsx` | 44px value, status pill, 14d sparkline, target hint |
| `components/overview/HealthCard.tsx` | Compact, border-l-4 status, click → href module |
| `components/overview/AlertFeed.tsx` | Severity-sorted list, time stamp, click jump |
| `components/overview/Gauge.tsx` | SVG semicircular arc 180°, progress fill, target marker |
| `components/overview/MiniVietnamMap.tsx` | **DEPRECATED — đã bỏ khỏi Page 0** (giữ file phòng dùng lại) |

### Data mapping (mock helpers)

```
getOverviewBigKpis(filter)  → { otd, costPerParcel, volume, lostRate }
getModuleHealth(filter)     → 8 ModuleHealthItem (ORS/Pickup/KTC/Linehaul ×2/Last-mile ×2/Returns)
getOverviewTrends(filter)   → { otd[], costPerParcel[], volume[], returnRate[] }
getOverallAlerts(filter)    → AlertItem[] với href + time
getOverviewGauges(filter)   → [OTD, Volume, CPP] OverviewGauge[]
```

### Quyết định đã chốt trong review

- ❌ Bỏ "Bản đồ vùng" (MiniVietnamMap section)
- ❌ Bỏ subtitle "Glance-and-go 30s…" trên PageHeader
- ❌ Bỏ search box "Tìm lane, hub, BC, trip ID…" trong TopBar
- ✅ Thêm filter "Dịch vụ" (service multi-select)
- 📌 Filter bar Page 0: region + service (skip province / granularity)

### Còn chưa làm trong Page 0

- Auto-refresh 5 phút (cần TanStack Query hoặc setInterval). Hiện data static.
- Mobile responsive: 2 KPI/hàng, stack vertical. Hiện chỉ test desktop ≥1280px.
- Threshold rule chưa lưu DB / config được. Hard-code trong `kpi-config.ts`.

---

## 4. Page 1 — Hành trình đơn hàng (`/order-journey`)

**Trạng thái:** Stub. Build theo plan_1 Page 1 spec.

### Spec recap

**Audience:** Customer Service, Shop Success, Ops Manager.
**Câu hỏi cần trả lời:** "đơn của shop X đang ở đâu, mất bao lâu, có đúng SLA không"

### Sections cần build

1. **Filters**: Date range (Created vs Delivered toggle) · Service · Sender/Receiver region · Shop search · Status multi-select
2. **6 KPI cards**: Total orders · OTD % · Avg lead time (P50 + P90 nhỏ) · First-attempt success % · Return rate % · Lost rate %
3. **Funnel chart** (full width, 10 stages):
   ```
   ORDER_CREATED → PICKUP_SUCCESS → AT_KTC_IN → LINEHAUL_DONE
   → AT_KTC_OUT → AT_DELIVERY_POST → OUT_FOR_DELIVERY → DELIVERED
   RETURNED · LOST (branch)
   ```
   Hover: count + drop-off %. Click step → filter dashboard về state đó.
4. **Lead time per stage** — box plot horizontal (P10/P50/P90/P99 + outliers + SLA target line)
5. **Sankey diagram** — flow source → next state, độ dày = volume. Failure path đỏ.
6. **Cohort heatmap** — X: hours since created (0–96h), Y: cohort by created date (14d), cell color = % delivered
7. **Order tracker table** — search MVĐ/order_id/phone, columns: MVĐ/Shop/Created/Current state/Days in state/SLA. Click row → **Drill drawer**:
   - Vertical timeline of events
   - Map: actual path (nodes đi qua)
   - Comparison planned vs actual per step
   - Failure reasons

### Components cần thêm

- `BoxPlot` (recharts không có native — custom SVG hoặc plotly)
- `Sankey` (dùng @nivo/sankey hoặc tự viết)
- `CohortHeatmap` (canvas-based nếu cell count cao)
- `OrderTimelineDrawer` (Sheet slide từ phải)

### Data shape cần thêm

- `getOrderFunnel(filter)` → 10-step funnel với count + dropoff
- `getStageLeadTimes(filter)` → mỗi stage có P10/P50/P90/P99/outliers + slaHours
- `getSankeyFlows(filter)` → edges [source, target, value, isFailure]
- `getDeliveryCohorts(filter)` → cohort by date × hours since created
- `getOrderList(filter, search, limit)` → paginated list với current state + SLA status
- `getOrderTimeline(orderId)` → full event history + planned vs actual

---

## 5. Page 2 — Định tuyến (ORS) (`/routing`)

**Trạng thái:** Page đã build trước pivot. Cần audit vs plan_1 Page 2 spec.

### Spec checklist (chưa verify từng cái)

- [ ] 6 KPI cards: Routing accuracy / Mis-route rate / Re-route rate / % fallback / ORS latency (P50/P99) / Coverage %
- [ ] OD matrix heatmap: sender province × receiver province, toggle volume/mis-route/lead time
- [ ] Routing decision quality: stacked bar per service (direct/1-hop/2-hop/3+ hop) + match % bar
- [ ] Mis-route deep dive table: top 20 patterns (planned → actual, count, extra TAT, extra cost)
- [ ] Re-route triggers: pie chart + trend
- [ ] Service coverage Vietnam choropleth map (cần GeoJSON provinces)

**Hiện có**: KPIs (`getRoutingKpis`), routing 24h trend, latency histogram, service breakdown, service coverage bars, mis-route table — có thể đa số tương đương spec nhưng layout chưa đúng. Cần screenshot review.

---

## 6. Page 3 — Mạng lưới (NDS + KTC) (`/network`)

**Trạng thái:** Page đã build trước pivot. Cần audit vs plan_1 Page 3 spec.

### Spec checklist

- [ ] 6 KPI cards: Fill rate / Linehaul on-time / Cost per parcel linehaul / Sort accuracy / % overstay >24h / Forecast MAPE
- [ ] Hub overview grid: 1 card / KTC với volume vs forecast / sort accuracy / TAT / overstay / inbound vs outbound
- [ ] Lane performance table: lane/trips/fill/on-time/cost/sparkline 7d. Highlight fill <60% (red) hoặc >95% (amber)
- [ ] **Network map**: Vietnam map với KTC nodes (size = volume) + lane edges (thickness = trips, color = on-time)
- [ ] Capacity vs demand stacked area per KTC (30d actual + 7d forecast + capacity ceiling)
- [ ] Forecast accuracy scatter forecast vs actual + MAPE summary
- [ ] **Hub Detail Drawer** (click hub): TAT distribution histogram, inbound/outbound timeline by hour, top destinations/sources, sort error breakdown

**Hiện có**: `getNetworkKpis`, `getLanePerf`, `getKtcStatus`, `getCutOffHeatmap`, `getKtcOverstayFunnel`, `getVolumeForecast`, `getForecastMapeTrend` — data layer khá đầy đủ. Cần map sang spec layout, thêm Vietnam map.

---

## 7. Page 4 — Vận chuyển (`/transportation`) — SKIP

User đã yêu cầu skip Transportation (Page 4) trong scope hiện tại. Spec đầy đủ trong plan_1, làm sau.

---

## 8. Reusable component inventory

### Shell
- `components/shell/AppShell.tsx` — wraps everything với SidebarProvider, FilterProvider, UploadedDataProvider
- `components/shell/Sidebar.tsx` — left nav, collapsible
- `components/shell/TopBar.tsx` — sticky 56px, logo + module name + hub selector + bell + avatar (đã bỏ search box)
- `components/shell/SidebarContext.tsx` — collapsed state

### Filter
- `components/filter/FilterContext.tsx` — global filter state, URL sync
- `components/filter/FilterBar.tsx` — composes filter controls, `show` prop config per page
- `components/filter/DateRangePicker.tsx`
- `components/filter/DimensionSelect.tsx` — generic dim dropdown (region/province/ktc/lane)
- `components/filter/GranularityToggle.tsx` — daily/weekly/monthly
- `components/filter/ServiceTypeMulti.tsx` — Express/Freight/B2B

### UI primitives
- `components/ui/Button.tsx` — cva variants (primary/secondary/ghost/danger × sm/md/lg)
- `components/ui/Select.tsx` — custom dropdown với search, controlled value
- `components/ui/Card.tsx` — content wrapper với title/subtitle/actions slots
- `components/ui/PageHeader.tsx` — breadcrumb + title + subtitle + default actions + last-updated
- `components/ui/KpiCard.tsx` — standard variant (KpiCard + KpiCardFrom)
- `components/ui/Sparkline.tsx` — pure SVG 14-point
- `components/ui/StatusDot.tsx` / `StatusBadge.tsx`
- `components/ui/AlertBanner.tsx` — stacked alert banner (Page 0 dùng AlertFeed thay vì cái này)
- `components/ui/MetricChart.tsx` — recharts wrapper (line/bar/area/stacked-bar/combo)
- `components/ui/DataTable.tsx` — sortable, searchable
- `components/ui/Heatmap.tsx`
- `components/ui/Funnel.tsx`
- `components/ui/Donut.tsx`

### Page 0 specific (`overview/`)
- BigKpiCard, HealthCard, AlertFeed, Gauge, **MiniVietnamMap (unused)**

### Legacy Journey (`journey/`, `overall/`)
- `JourneyFlow.tsx`, `StageHeader.tsx` — dùng cho `/journey` legacy page
- `OpsScorecardCard.tsx`, `PipelineHealthCard.tsx` — không còn dùng ở Page 0 (đã wipe). Có thể tái sử dụng hoặc xóa.

---

## 9. Open decisions

| # | Decision | Note |
|---|---|---|
| 1 | `/order-journey` vs `/journey` — gộp hay giữ song song? | Hiện đang giữ cả 2. `/journey` legacy không match plan_1 |
| 2 | Bỏ `/journey` legacy hay refactor thành Page 1? | Liên quan #1 |
| 3 | Build Page 4 Transportation lúc nào? | Đang skip |
| 4 | Vietnam map cho Page 2 Routing coverage + Page 3 Network map: GeoJSON nào? | Cần download GeoJSON VN provinces. `react-leaflet` hay `@nivo/geo`? |
| 5 | Auto-refresh 5 phút cho Page 0 — wire TanStack Query? | Hiện data static |
| 6 | Sankey + BoxPlot + CohortHeatmap library: `@nivo/sankey` cho Sankey, custom SVG cho BoxPlot, canvas cho CohortHeatmap? | Plan_1 đề xuất ECharts cho complex viz |
| 7 | `OpsScorecardCard` + `PipelineHealthCard` (từ Overall cũ) — xóa hay tái sử dụng? | Hiện không link từ đâu |
| 8 | Reports pages (`/reports/daily`, `/reports/weekly`) — scope thế nào? | Plan_1 không spec chi tiết |
| 9 | Mobile responsive — bắt buộc ở mức nào? | Plan_1 nói Page 0 phải responsive (iPad/phone), pages khác desktop-only |
| 10 | Loại bỏ Header subtitle pattern cho mọi page hay chỉ Page 0? | Hiện chỉ bỏ ở Page 0 |

---

## 10. Mock data layer cheat sheet

File: `src/lib/mock-data.ts` (1411+ lines)
Seed: `seedrandom("ghn-network-ops")` — stable across reloads.
TODAY: `2026-05-20` (hard-coded để mock có history 365 ngày)

### Geo
- 3 vùng (bac/trung/nam), 20+ provinces, 60+ districts, 200+ wards
- 25 KTC, 50 lanes

### Helpers theo page

**Page 0 (Overview):**
- `getOverviewBigKpis(filter)`, `getModuleHealth(filter)`, `getOverviewTrends(filter)`, `getOverallAlerts(filter)`, `getOverviewGauges(filter)`

**Routing (Page 2):**
- `getRoutingKpis`, `getRoutingAccuracy24h`, `getLatencyHistogram`, `getServiceBreakdown`, `getServiceCoverage`, `getMisRouteRows`, `getRoutingAlerts`

**Network (Page 3):**
- `getNetworkKpis`, `getVolumeForecast`, `getCutOffHeatmap`, `getKtcOverstayFunnel`, `getForecastMapeTrend`, `getLanePerf`, `getKtcStatus`, `getNetworkAlerts`

**Journey legacy (`/journey`):**
- `getJourneyOverview`, `getJourneyKpis`, `getPickupKpis`, `getBcNhanKpis`, `getBcGiaoKpis`, `getBcHoanKpis`, `getJourneyFunnel`, `getJourneyAnomalies`

**Page 1 (Order journey)** — chưa có helper, cần thêm:
- `getOrderFunnel`, `getStageLeadTimes`, `getSankeyFlows`, `getDeliveryCohorts`, `getOrderList`, `getOrderTimeline`

### KpiValue shape (`src/lib/types.ts`)

```ts
type KpiValue = {
  label: string;
  value: number;
  unit: '%' | 'VND' | 'ms' | 'h' | 'phút' | 'ngày' | 'đơn' | 'kg' | 'km';
  target: number;
  deltaPct: number;        // % change vs previous comparable period
  sparkline: number[];     // last 14 daily values
  status: 'green' | 'amber' | 'red';
  direction: 'higher-better' | 'lower-better';
};
```

---

## 11. Commands

```bash
cd /Users/vinhphung/ghn-network-ops
npm run dev      # localhost:3000
npm run build    # production build
npm run lint
```

Dev server đã được stop sau khi viết file này. Khi resume work, chỉ cần `npm run dev`.

---

## 12. Glossary (terminology nội bộ GHN — bắt buộc đúng)

| Viết tắt | Nghĩa |
|---|---|
| BC | Bưu cục (post office / station) |
| KTC | Kho Trung Chuyển (transfer hub) |
| NVPTTT | Nhân viên phụ trách thị trường (pickup staff) |
| NVBC | Nhân viên bưu cục (last-mile shipper) |
| MVĐ | Mã vận đơn (tracking code) |
| Lane | Chặng KTC→KTC |
| Route | Tuyến giao của 1 NVBC |
| %TC | Giao thành công |
| %TB | Giao thất bại |
| %GT1P | Giao 1 phần |
| %GTC | Giao trong ca |
| COT | Cut-off time |
| COD | Cash on delivery |
| OTD | On-Time Delivery |
| TAT | Turn Around Time |
| CPP | Cost per parcel |
| ORS | Order Routing System |
| NDS | Network Design System |
| TMS | Transport Management System |
| ODR | On-time Delivery Rate (KPI ops scorecard) |
| OPR | On-time Pickup Rate |
| FD | First Delivery |

---

## 13. Resume checklist khi quay lại code

1. `npm run dev` ở `/Users/vinhphung/ghn-network-ops`
2. Mở `localhost:3000/` — verify Page 0 vẫn render đúng
3. Đọc lại `ghn_dashboard_plan_1.md` (Part C — Pages) + file này (mục 4–6)
4. Pick page tiếp theo theo order đã chốt: **Page 1 (`/order-journey`) → Page 2 (`/routing`) audit → Page 3 (`/network`) audit**
5. Resolve open decisions ở mục 9 trước khi build
