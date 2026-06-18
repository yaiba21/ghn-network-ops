# GHN Network Ops Dashboard — Tài liệu giới thiệu dự án

> Dashboard vận hành mạng lưới logistics e2e của GHN (GiaoHangNhanh) — từ First Mile (lấy hàng) → Middle Mile (KTC + Linehaul) → Last Mile (giao hàng).
> Tài liệu này mô tả **ngữ cảnh · cách tiếp cận · logic · ý tưởng** để người mới (PM, BA, dev, leader vùng) hiểu nhanh dự án.

---

## 1. TL;DR (đọc 30 giây)

- **Là gì:** 1 web dashboard (Next.js) gom toàn bộ chỉ số sức khoẻ vận hành mạng GHN vào 5 trang chính, lọc theo 14 vùng / 34 tỉnh / 12 KTC / ~1.200 BC, nhiều góc nhìn (channel, loại hàng, SLA, NCC, tuyến).
- **Cho ai:** PM Network, leader vùng, team vận hành & BI — để theo dõi đèn xanh/vàng/đỏ, drill xuống điểm có vấn đề, và ra quyết định.
- **Trạng thái hiện tại:** chạy trên **mock data có hiệu chỉnh thực tế** (seeded), kiến trúc đã sẵn sàng để cắm data thật. Live: https://ghn-network-ops.vercel.app
- **Triết lý:** mỗi con số phải **tính được từ dữ liệu gốc** (fact tables), không hard-code; mỗi chỉ số có **công thức rõ ràng** (tooltip ℹ️ ngay trên dashboard); UI sạch kiểu Linear/Notion, tiếng Việt, giữ thuật ngữ nghiệp vụ GHN.

---

## 2. Ngữ cảnh & bài toán

GHN vận hành mạng giao nhận toàn quốc với 3 chặng lớn:

1. **First Mile** — NV lấy hàng (NVPTTT) gom đơn từ shop về BC lấy.
2. **Middle Mile** — BC → KTC (kho trung chuyển) → Linehaul (xe liên vùng) → KTC → BC giao.
3. **Last Mile** — NVBC giao hàng tới người nhận; xử lý GTC / GTB / hoàn / thất lạc.

**Vấn đề trước khi có dashboard:**
- Chỉ số nằm rải rác ở nhiều report/sheet, mỗi team 1 định nghĩa → khó so sánh, khó truy nguyên.
- Khó nhìn xuyên suốt **hành trình 1 đơn** và xác định chặng nào đang làm hỏng SLA.
- Khó phát hiện nhanh **vùng/BC/tuyến/NCC** nào cần can thiệp (attention).
- Chi phí vận tải khó theo dõi theo vùng so với budget.

**Dashboard giải quyết:** một nguồn sự thật (single source of truth) trực quan, có drill-down, có cảnh báo, có định nghĩa chỉ số ngay trong UI.

---

## 3. Mục tiêu thiết kế

| Mục tiêu | Thể hiện trong sản phẩm |
|---|---|
| **Nhìn nhanh sức khoẻ** | Đèn giao thông (xanh/vàng/đỏ) theo ngưỡng cho mọi KPI + heatmap |
| **Truy nguyên (drill-down)** | Vùng → BC → đơn; tuyến → trip → điểm chạm; vùng → NCC |
| **Theo hành trình đơn** | Sankey trạng thái đầy đủ + bảng cut-off theo 6 chặng |
| **Định nghĩa minh bạch** | Mỗi KPI card có icon ℹ️ → tooltip công thức |
| **So sánh nhiều chiều** | Filter: vùng/tỉnh/KTC/channel/loại hàng/SLA/loại tuyến/NCC + WoW |
| **Sẵn sàng data thật** | Tách rõ tầng dữ liệu; resolver mock↔real; bộ template schema |

---

## 4. Cách tiếp cận (triết lý xây dựng)

### 4.1. "Tính từ fact, không hard-code"
Mọi metric đều được **tính ra từ các bảng sự kiện (fact tables)** chứ không gán cứng. Nghĩa là khi thay mock bằng data thật, chỉ cần nạp đúng schema fact → toàn bộ KPI/heatmap/bảng tự cập nhật.

```
fact tables (đơn / trip / pickup / delivery)
        │  (filter theo FilterState)
        ▼
aggregators.ts  ──►  compute primitives (ontime, %GTC, cost/kg, đổi kho, fill rate…)
        │
        ▼
KpiValue / Row[]  ──►  React pages  ──►  KpiCard / DataTable / Heatmap / Sankey / Map
```

### 4.2. Mock "giống thật"
Mock data được **hiệu chỉnh (calibrate)** để phân bố chỉ số ra giống thực tế: ontime ~88–94% theo vùng, cost/kg ~1.850đ, %GTC ~88–96%, có mùa vụ (Tết drop), bias HN/HCM, phân bố theo cỡ shop… → demo ra số liệu hợp lý, đèn xanh/vàng/đỏ đa dạng (không "đỏ hết" hay "xanh hết").

### 4.3. Định nghĩa chỉ số là first-class
Mỗi KPI có 1 entry trong **registry** (`kpi-config.ts`): nhãn, đơn vị, hướng tốt (cao/thấp tốt), baseline, target, **ngưỡng đèn**, và **công thức (definition)** hiển thị tooltip. Đổi ngưỡng/định nghĩa ở 1 chỗ → áp dụng toàn dashboard.

### 4.4. UI tối giản, nghiệp vụ Việt
- Phong cách **Linear/Notion**: gọn, nhiều khoảng trắng, bảng dày thông tin.
- Brand GHN: đỏ `#DC2626`, cam `#F97316`. **Không** dark mode, **không** gradient loè loẹt, **không** emoji.
- Toàn bộ UI + giải thích bằng **tiếng Việt**, giữ viết tắt nghiệp vụ: **BC** (bưu cục), **KTC** (kho trung chuyển), **MVĐ** (mã vận đơn), **GTC/GTB** (giao thành công/thất bại), **LTC** (lấy đúng cut-off), **COT** (cut-off time), **TAT** (turnaround), **NVPTTT/NVBC**, **đổi kho**…

### 4.5. Drill-down + cảnh báo có chủ đích
Bảng nào "cần action" thì cho click drill xuống cấp chi tiết hơn, và tô màu/cảnh báo theo **mức cần chú ý tương đối** (không chỉ ngưỡng tuyệt đối) để luôn nổi bật được nhóm tệ nhất.

---

## 5. Kiến trúc & logic

### 5.1. Các tầng

| Tầng | File | Vai trò |
|---|---|---|
| **Dữ liệu gốc** | `src/lib/mock-data.ts` | Sinh fact tables (seeded, calibrate) + master data (vùng/tỉnh/KTC/BC) |
| **Kiểu dữ liệu** | `src/lib/types.ts` | `FactOrder/Trip/Pickup/Delivery`, `FilterState`, `RegionCode`, trạng thái đơn… |
| **Engine chỉ số** | `src/lib/aggregators.ts` | ~4.100 dòng: lọc + tính mọi metric, trả về cho từng trang |
| **Registry KPI** | `src/lib/kpi-config.ts` | Định nghĩa/ngưỡng/đèn/công thức cho 80+ KPI |
| **Định tuyến bản đồ** | `src/lib/osrm.ts` | Lấy hình học đường bộ thật (route bám đường, không cắt biển) |
| **Upload (đang xây)** | `upload-templates.ts`, `csv.ts` | Template + parse CSV cho luồng nạp data thật |
| **Giao diện** | `src/app/*/page.tsx` + `src/components/ui/*` | Trang + component tái sử dụng |

### 5.2. Mô hình dữ liệu (fact tables)

- **FactOrder** (~30k đơn) — 1 dòng/đơn: channel, BC lấy/giao, KTC, vùng, tỉnh, loại hàng, SLA, mốc thời gian (created/picked/delivered/promised), trạng thái cuối, đổi kho, cỡ shop…
- **FactTrip** (~15–40k chuyến) — 1 dòng/chuyến xe: loại tuyến (FM/LH/LM/RT), origin/dest, KTC, plan/actual depart-arrive, fill rate, empty km, total km, cost, NCC, loại xe.
- **FactPickup** (~29k) — 1 dòng/lượt lấy: NVPTTT, BC, đã gán?, LTC?, lead time gán/lấy.
- **FactDelivery** (~42k) — 1 dòng/lần giao (attempt): outcome (GTC/GTB), số lần thử.

Master: **14 vùng** (HNO, HCM, DSH, DNB, DCL, BTB, DBB, TTB, NTB, TNG, XBG, TBB, TNT, TNB), **34 tỉnh**, **12 KTC**, **~1.200 BC**.

### 5.3. Dòng tính 1 metric (ví dụ Ontime Network)

```
filterOrders(filter)                      # lọc đơn theo bộ filter
  → đơn delivered có deliveredTs
  → đếm deliveredTs ≤ promisedTs
  → % = ontime / tổng delivered
  → buildKpi("ontimeNetwork", value, sparkline 7 ngày, prevValue)
  → statusFromValue() gán đèn theo ngưỡng trong kpi-config
```

`buildKpi()` trả về `KpiValue` đầy đủ: value, target, % delta vs kỳ trước, sparkline, đèn, hướng tốt, **definition** (công thức cho tooltip).

---

## 6. Cấu trúc trang (Information Architecture)

| Trang | Route | Nội dung chính |
|---|---|---|
| **Tổng Quan** | `/` | 10 key metrics toàn mạng · Pulse check hành trình đơn · Trend 14 ngày · Heatmap 14 vùng · so sánh channel / loại hàng / SLA |
| **Hành Trình Đơn** | `/journey` | Bảng 6 chặng + tỷ lệ đúng cut-off · **Sankey trạng thái đầy đủ** (18 node) · các final status · drill xuống từng MVĐ |
| **Định Tuyến (Order Allocation)** | `/routing` | % chỉ định kho / không chỉ định · đổi kho overall · **chart WoW** · bảng đổi kho toàn quốc theo channel × phường mới/cũ · engine resolve · top BC đổi kho |
| **Mạng Lưới (Network Design & Linehaul)** | `/network` | Scorecard 14 vùng (OPR/ODR/Ontime TC/% gán/%GTC trên gán/longtail/BCG trễ SLA…) · **Phân chia phạm vi BC** (heatmap attention + drill chi tiết BC) · KTC scorecard · ma trận lane OD |
| **Vận Tải (Trip & Fleet)** | `/transport` | KPI vận tải · **bản đồ route bám đường (OSRM)** · sức khoẻ tuyến · chuyến realtime → **trang chi tiết chuyến** · **chi phí run rate vs budget theo vùng** → drill NCC |
| **Báo cáo** | `/reports/daily`, `/reports/weekly` | Báo cáo vận hành ngày / KPI tuần |
| **Cài đặt — Upload** | `/settings/upload` | Luồng nạp data thật (đang phát triển) |

---

## 7. Bộ chỉ số & cách tính (glossary rút gọn)

> Toàn bộ công thức cũng hiện ngay trên dashboard qua icon ℹ️ trên KPI card.

| Chỉ số | Công thức |
|---|---|
| **Ontime Network** | đơn giao đúng SLA (delivered ≤ promised) / tổng đơn đã giao |
| **%GTC** | đơn GTC / đơn đã đến quyết định giao (delivered + GTB + hoàn) |
| **% LTC** | lượt lấy đúng cut-off / tổng lượt cần lấy |
| **Ontime giao (ODR)** | đơn giao trước/đúng hẹn / đơn đã giao |
| **Cost/kg** | tổng chi phí linehaul / tổng kg quy đổi |
| **Fill rate kg** | kg thực rời / tải chuẩn của xe |
| **% Empty Mileage** | km chạy rỗng / tổng km |
| **Tỷ lệ đổi kho** | đơn đổi kho giao (kho mới ≠ kho cũ) / tổng đơn nhập BC giao |
| **% chỉ định kho** | đơn được ORS chỉ định (Chỉ định BC + Bộ BC) / tổng đơn |
| **% hàng ≥4 ca** | đơn về BC giao còn ≥4 ca trước hạn (1 ca ~5h) / tổng |
| **OPR** | đơn về đích tốt (delivered + hoàn TC + đang xử lý) / tổng |
| **Run rate vs budget** | chi phí kỳ quy đổi/tháng so với budget tháng → cảnh báo vượt |

---

## 8. Hệ thống thiết kế (design system)

- **Màu trạng thái:** xanh (đạt) / vàng (cảnh báo) / đỏ (vượt ngưỡng) — quy về token chung, ngưỡng lấy từ `kpi-config`.
- **Component tái sử dụng:** `KpiCard` (+ tooltip công thức), `DataTable` (sort/search/paginate/row-click), `Heatmap`, `SankeyChart`, `Donut`, `MetricChart` (combo/bar/line), `Modal`, bản đồ Leaflet (`LeafletTransportMap`, `LeafletTerritoryMap`, `TripRouteMap`), `StatusBadge/StatusDot/Sparkline`.
- **Bản đồ:** OpenStreetMap (CartoDB light) + react-leaflet; territory dùng **Voronoi** (d3-delaunay) chia phạm vi BC không chồng nhau; route vận tải dùng **OSRM** để bám đường bộ thật.
- **Animation:** fade-in nhẹ, skeleton loading, tôn trọng `prefers-reduced-motion`.

---

## 9. Từ mock → data thật

### 9.1. Pattern resolver + fallback
Tầng dữ liệu thiết kế để **ưu tiên data thật nếu có, fallback về mock** — nghĩa là có thể nạp dần từng bảng mà dashboard vẫn chạy.

### 9.2. Bộ template schema (7-template hybrid) — đã chốt hướng
- **2 master:** danh mục BC, danh mục KTC/vùng/tỉnh.
- **3 daily rollup:** tổng hợp ngày theo đơn / theo trip / theo pickup (kèm **count-pair** numerator+denominator để roll-up đúng các tỷ lệ).
- **2 raw sample:** mẫu fact đơn + fact trip để kiểm chứng công thức.

> Nguyên tắc quan trọng: các metric tỷ lệ phải kèm **tử số + mẫu số** (không chỉ %), để khi gộp nhiều ngày/nhiều vùng vẫn tính lại đúng.

### 9.3. Lộ trình nạp
1. Nạp master (BC/KTC). 2. Nạp daily rollup. 3. Đối chiếu raw sample để xác nhận công thức khớp. 4. (Sau) tự pull định kỳ từ Google Sheet / data warehouse.

---

## 10. Ý tưởng & định hướng (roadmap)

1. **MCP server cho domain Network** — để team vận hành/biz tự "vibe-code" app riêng:
   - *Tools* (ngữ nghĩa, không phải SQL thô): hỏi metric theo vùng/kỳ, drill, so sánh.
   - *Resources*: glossary, schema, KPI registry.
   - Tái dùng đúng `aggregators.ts` + `kpi-config.ts` → MCP và dashboard luôn nhất quán định nghĩa.
2. **Upload data thật** — hoàn thiện luồng `/settings/upload` (template + validate + resolver).
3. **Auto-pull** — kết nối nguồn (Google Sheet / DWH) để làm tươi số liệu tự động.
4. **Cảnh báo chủ động** — alert khi KPI vượt ngưỡng / vùng-BC-tuyến vào nhóm đỏ.
5. **Budget thật cho vận tải** — thay budget mock bằng phân bổ thật theo vùng.
6. **OSRM self-host / Mapbox** — thay OSRM demo để ổn định + nhanh hơn ở production.

---

## 11. Tech stack

- **Next.js 16** (App Router, Turbopack) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** (@theme tokens)
- **Recharts** (chart + Sankey) · **react-leaflet + Leaflet** (bản đồ) · **d3-delaunay** (Voronoi)
- **OSRM** (định tuyến đường bộ) · seedrandom (mock ổn định) · date-fns
- Deploy: **GitHub → Vercel**

---

## 12. Chạy & deploy

```bash
npm install
npm run dev            # http://localhost:3000
./node_modules/.bin/tsc --noEmit   # typecheck
npx vercel deploy --prod --yes     # deploy production
```

- Repo: `yaiba21/ghn-network-ops` · Live: https://ghn-network-ops.vercel.app

---

## 13. Lưu ý quan trọng khi đọc số liệu

- Số liệu hiện tại là **mock đã hiệu chỉnh** — đúng về *cấu trúc/quan hệ*, không phải số vận hành thật. Các bảng có gắn nhãn "công thức ước lượng — mock" ở những chỗ là proxy (vd budget vận tải, một số sub-metric BC, % chỉ định kho).
- Một số metric ở cấp **BC trong tỉnh đông BC** (vd HCM ~200 BC) có mẫu nhỏ → WoW được *guard* để không nhiễu; khi có data thật (sản lượng lớn hơn) sẽ đầy đủ hơn.
- Khi cắm data thật: chỉ cần đúng schema fact → **không phải sửa logic tính**, dashboard tự lên số.
