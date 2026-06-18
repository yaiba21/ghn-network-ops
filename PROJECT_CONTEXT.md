# Context dự án — paste vào Claude chat để tiếp tục

> Copy toàn bộ phần dưới (từ "BẠN ĐANG HỖ TRỢ…" trở đi) dán vào đầu cuộc chat mới với Claude.

---

BẠN ĐANG HỖ TRỢ tôi (PM Network của GiaoHangNhanh – GHN) phát triển một **dashboard vận hành mạng lưới logistics e2e**. Đây là context đầy đủ:

## Về tôi & cách làm việc
- Tôi là PM Network GHN. Trả lời tôi bằng **tiếng Việt**.
- Giữ nguyên **viết tắt nghiệp vụ GHN**: BC (bưu cục), KTC (kho trung chuyển), MVĐ (mã vận đơn), GTC/GTB (giao thành công/thất bại), LTC (lấy đúng cut-off), COT (cut-off time), TAT, NVPTTT/NVBC, NCC (nhà cung cấp vận tải), đổi kho.
- UI sạch kiểu Linear/Notion. Brand GHN: đỏ #DC2626, cam #F97316. **Không** dark mode, **không** gradient loè loẹt, **không** emoji.

## Sản phẩm
- Web dashboard Next.js, chạy trên **mock data đã hiệu chỉnh giống thật** (seeded), kiến trúc sẵn sàng cắm data thật.
- Đã deploy: GitHub repo `yaiba21/ghn-network-ops` → Vercel, live tại https://ghn-network-ops.vercel.app
- Phạm vi: 14 vùng GHN / 34 tỉnh / 12 KTC / ~1.200 BC.

## Tech stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind v4 · Recharts (chart + Sankey) · react-leaflet + Leaflet (bản đồ) · d3-delaunay (Voronoi) · OSRM (định tuyến đường bộ thật) · seedrandom · date-fns. Deploy bằng `npx vercel deploy --prod --yes`.

## Kiến trúc (rất quan trọng)
Triết lý: **mọi metric tính từ fact tables, không hard-code** → thay mock bằng data thật chỉ cần đúng schema, không sửa logic.

Luồng: `mock-data.ts` (sinh fact tables) → `aggregators.ts` (lọc theo FilterState + tính metric) → React pages → component UI.

Các file lib chính (trong `src/lib/`):
- `mock-data.ts` (~3.000 dòng) — sinh FactOrder (~30k), FactTrip, FactPickup (~29k), FactDelivery (~42k) + master data.
- `aggregators.ts` (~4.100 dòng) — engine tính mọi metric, mỗi trang có hàm `getXxx(filter)`.
- `kpi-config.ts` — registry 80+ KPI: nhãn, đơn vị, hướng tốt, baseline, target, **ngưỡng đèn**, và **công thức (definition)** hiện trong tooltip ℹ️.
- `types.ts` — FactOrder/Trip/Pickup/Delivery, FilterState, RegionCode (14 vùng), trạng thái đơn.
- `osrm.ts` — fetchRoadPath (route bám đường bộ, fallback đường thẳng) + mapWithLimit.
- `utils.ts` — format (VND, %, compact int, ngày), lastNDays, rangeDays.

Component UI tái dùng (`src/components/ui/`): KpiCard (+ tooltip công thức), DataTable (sort/search/paginate/row-click), Heatmap, SankeyChart, Donut, MetricChart (combo/bar/line), Modal, LeafletTransportMap / LeafletTerritoryMap / TripRouteMap, StatusDot, Sparkline.

## Các trang (route URL giữ nguyên, NHÃN đã đổi gần đây)
- `/` — **Tổng Quan**: 10 key metrics · Pulse check hành trình đơn · Trend 14 ngày · Heatmap 14 vùng · so sánh channel/loại hàng/SLA.
- `/journey` — **Hành Trình Đơn**: bảng 6 chặng + tỷ lệ đúng cut-off · Sankey trạng thái đầy đủ (18 node) · final status · drill xuống từng MVĐ.
- `/routing` — menu "**Gán đơn**", header "Gán đơn (Order Allocation)": % chỉ định kho / không chỉ định · đổi kho · chart WoW · bảng đổi kho toàn quốc theo channel × phường mới/cũ · engine resolve · top BC đổi kho.
- `/network` — menu "**Mạng lưới BC**", header "Mạng lưới BC (Hub Network)": scorecard 14 vùng (Volume/OPR/ODR/Ontime TC/% gán/%GTC trên gán/% Longtail/% BCG trễ SLA/% on time ≥4 ca/Cost-kg) · Phân chia phạm vi BC (heatmap attention + drill chi tiết BC) · KTC scorecard · ma trận lane OD.
- `/transport` — menu "**Định tuyến**", header "Định tuyến (Routing & Transportation)": KPI vận tải · bản đồ route bám đường OSRM (click tuyến → thẻ chi tiết) · sức khoẻ tuyến · chuyến realtime → modal chi tiết chuyến · chi phí run rate vs budget theo vùng → drill NCC.
- `/reports/daily`, `/reports/weekly` — báo cáo. `/settings/upload` — luồng nạp data thật (đang xây).

## Quy ước & quyết định đã chốt
- **Đèn xanh/vàng/đỏ** theo ngưỡng trong kpi-config; màu nằm ở từng ô metric. **Đã bỏ hết cột "Trạng thái" (badge)** ở mọi bảng (giữ "Trạng thái hiện tại" ở /journey vì là dữ liệu trạng thái đơn).
- Mỗi KPI card có **icon ℹ️ → tooltip công thức** (registry KPI_DEFINITION).
- **WoW** (week-over-week) = 7 ngày gần nhất vs 7 ngày trước; metric per-BC mẫu nhỏ được guard tránh nhiễu.
- Route vận tải vẽ bằng **OSRM** (bám đường bộ, nằm trong đất liền VN, zig-zag), fallback nối điểm chạm nếu lỗi.
- **Schema data thật**: hướng "7-template hybrid" (2 master + 3 daily rollup + 2 raw sample); metric tỷ lệ phải kèm **tử số + mẫu số** để roll-up đúng.
- Nhiều chỗ là **proxy/mock** có gắn nhãn "công thức ước lượng — mock" (vd budget vận tải, % chỉ định kho, một số sub-metric BC).

## Một số công thức chính
- Ontime Network = đơn delivered ≤ promised / tổng đơn đã giao.
- %GTC = đơn GTC / đơn đến quyết định giao (delivered + GTB + hoàn).
- %LTC = lượt lấy đúng cut-off / tổng lượt cần lấy.
- Cost/kg = tổng chi phí linehaul / tổng kg.
- Tỷ lệ đổi kho = đơn đổi kho giao (kho mới ≠ cũ) / tổng đơn nhập BC giao.
- Run rate vs budget = chi phí kỳ quy đổi/tháng so với budget tháng → cảnh báo vượt.

## Định hướng tiếp theo (roadmap)
MCP server cho domain Network (tái dùng aggregators + kpi-config) · hoàn thiện upload data thật · auto-pull từ Google Sheet/DWH · alert chủ động · budget vận tải thật · OSRM self-host/Mapbox.

## Lưu ý môi trường
- Repo local: làm việc trên macOS, dev server `npm run dev` cổng 3000 (hay crash với Node mới + Turbopack → restart: `pkill -f "next dev"; rm -rf .next; npm run dev`).
- Có tài liệu chi tiết hơn ở `DASHBOARD_OVERVIEW.md` trong repo.

HÃY xác nhận đã nắm context và hỏi tôi muốn làm gì tiếp.
