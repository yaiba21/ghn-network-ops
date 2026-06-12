# GHN Network Ops Dashboard

Production-quality dashboard cho **GiaoHangNhanh — Network Logistics** team, theo dõi **middle-mile** (ORS + NDS/KTC). Built với mock data realistic, sẵn sàng swap sang real API.

## Stack

- **Next.js 16** (App Router, Turbopack, React Compiler)
- **React 19** + TypeScript strict
- **Tailwind CSS v4** (tokens trong `globals.css @theme`)
- **Recharts** cho charts
- **lucide-react** icons
- **date-fns** + **seedrandom** cho mock data ổn định
- `class-variance-authority` + `clsx` + `tailwind-merge` cho component primitives (thay vì shadcn proper, vì tokens đã được match)

## Cấu trúc

```
src/
  app/                       App Router pages
    page.tsx                 / — Tổng quan (Phase 3)
    routing/page.tsx         /routing — Định tuyến (ORS) (Phase 3)
    network/page.tsx         /network — Mạng lưới NDS + KTC (Phase 3)
    layout.tsx, globals.css

  components/
    Logo.tsx
    shell/
      AppShell.tsx           Sidebar + TopBar wrapper
      Sidebar.tsx
      TopBar.tsx
      SidebarContext.tsx     Collapse state

  lib/
    types.ts                 All domain + API types
    utils.ts                 Formatters (VND, %, ms, kg, km, đơn) + date helpers + cn()
    kpi-config.ts            KPI specs, thresholds, status logic (green/amber/red)
    mock-data.ts             Seeded data store + getters mirroring real API surface
```

## Phase plan

- ✅ **Phase 1 — Foundation**: Next.js + Tailwind + shell + data layer (types, utils, kpi-config, mock-data)
- ⏳ **Phase 2 — Reusable components**: KpiCard, Sparkline, StatusBadge, FilterBar, DateRangePicker, DataTable, MetricChart, Heatmap, Funnel, AlertBanner
- ⏳ **Phase 3 — Pages**: `/` Tổng quan → review → `/routing` ORS → `/network` NDS+KTC
- ⏳ **Phase 4 — Polish**: loading/empty states, URL state, screenshots

## Mock data

Tất cả dữ liệu sinh từ `seedrandom('ghn-network-ops')` → ổn định across reloads.

- **Geo**: 3 vùng (Bắc/Trung/Nam) × 20 Tỉnh × 60 Quận × 200 Phường
- **Network**: 25 KTC (transfer hubs) × 50 lanes (KTC→KTC) — phân loại intra / inter / express
- **Lịch sử**: 365 ngày trở về từ `2026-05-20`, ~50k đơn/ngày baseline
- **Patterns** đã embed:
  - Weekly seasonality (T2/T7 +18-22%, CN -30%)
  - 11.11 (×3), 12.12 (×2.5), Black Friday (×2), Tết ramp (×1.5) + post-Tết dip
  - Trend tăng ~5%/tháng
  - 1-2 incident days/tháng (drop 17% volume + degrade quality)
  - Underperforming hubs (KTC Khánh Hoà, Quảng Nam, Nghệ An, An Giang) cho story khi drill-down
  - Trung region nhẹ tay underperform để có narrative

## Public API surface (mock)

Mọi function trong `lib/mock-data.ts` có signature `f(filter: FilterState): T`, mô phỏng REST/RPC tương lai:

```ts
getOverallKpis, getVolumeStack, getCostTrend, getCostStack, getLeadTime,
getQualityRows, getPipelineHealth, getOverallAlerts,
getRoutingKpis, getRoutingAccuracy24h, getLatencyHistogram,
getServiceBreakdown, getServiceCoverage, getMisRouteRows, getRoutingAlerts,
getNetworkKpis, getVolumeForecast, getCutOffHeatmap, getKtcOverstayFunnel,
getForecastMapeTrend, getLanePerf, getKtcStatus, getNetworkAlerts,
getRegions, getProvinces, getDistricts, getWards, getKtcs, getLanes,
dataUpdatedAt, defaultFilter
```

Swap sang real API: thay body từng function bằng `fetch(...)`, giữ nguyên signature.

## Glossary (đúng terminology GHN)

| Viết tắt | Nghĩa |
|---|---|
| BC | Bưu cục (post office / station) |
| KTC | Kho Trung Chuyển (transfer hub) |
| MVĐ | Mã vận đơn (tracking code) |
| Lane | Chặng KTC → KTC |
| COT | Cut-off time |
| OTD | On-Time Delivery |
| TAT | Turn Around Time |
| MAPE | Mean Absolute Percentage Error (forecast accuracy) |
| NDS | Network Design System |
| ORS | Order Routing System |

## Dev

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
```

> **Lưu ý**: Next.js 16 đã đổi nhiều API so với 14/15. Đọc `node_modules/next/dist/docs/` trước khi thêm config mới.
