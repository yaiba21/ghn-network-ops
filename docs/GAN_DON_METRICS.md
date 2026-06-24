# Gán đơn (Order Allocation) — Tóm tắt metrics & cấu trúc

> Reference để tái sử dụng ở project khác. Trang `/routing` của GHN Network Ops Dashboard — chuyên về **phân tuyến / gán đơn về BC** và **đổi kho** (re-route warehouse).

---

## 0. Dashboard tổng thể (1 phút)
Dashboard vận hành mạng lưới GHN (Next.js, mock data có hiệu chỉnh). Đơn vị: **14 vùng / 34 tỉnh / 12 KTC / ~1.200 BC**. Mọi metric tính từ 4 fact table: `FactOrder`, `FactTrip`, `FactPickup`, `FactDelivery`. Các trang: Tổng Quan, Hành Trình Đơn, **Gán đơn**, Mạng lưới BC, Phạm vi BC, Định tuyến (vận tải), Báo cáo, Quản lý mục tiêu.

Quy ước chung:
- **Đèn trạng thái**: 🟢 đạt · 🟡 cảnh báo · 🔴 chưa đạt — theo ngưỡng (`thresholds`) + hướng tốt (`direction`).
- **WoW** = Tuần này (7 ngày gần nhất) vs Tuần trước (7 ngày liền trước); Δ tính bằng **điểm % (pp)**.
- **Đổi kho** = đơn bị gán lại BC giao khác so với BC ban đầu (`new_wh ≠ old_wh`).
- **Phường mới / cũ** = `phuongIsNew` (địa chỉ thuộc phường mới mở rộng hay không).

---

## 1. Mục đích trang Gán đơn
Đo chất lượng **phân tuyến đơn** (ORS gán đơn về đúng BC) và hệ quả **đổi kho** — đổi kho cao = phân tuyến sai/thiếu config → phát sinh chi phí + trễ. Phân tích theo **nguồn đơn (channel) × phường mới/cũ × vùng × BC**, kèm **lý do đổi kho** và **WoW**.

---

## 2. Key metrics (header)

| Metric | Công thức | Đơn vị | Hướng | Ngưỡng 🟢/🟡 |
|---|---|---|---|---|
| **Tỷ lệ đổi kho overall** | đơn đổi kho giao (new_wh ≠ old_wh) / tổng đơn nhập BC giao | % | thấp tốt | ≤1.5 / ≤2.3 |
| **Tổng đơn đổi kho** | đếm đơn `isChangedWarehouse = true` trong kỳ | đơn | — | — |
| **Chi phí phát sinh** | tổng đơn đổi kho × **10.000đ/đơn** (chênh lệch cost có vs không đổi kho) | VND | thấp tốt | — |

---

## 3. So sánh WoW (3 metric chính)
Grouped bar **Tuần trước vs Tuần này** + Δ (pp) cho:
- **% chỉ định kho**, **% không chỉ định**, **% đổi kho overall**.

---

## 4. Tỷ lệ đổi kho — breakdown từ overall
5 ô: **Overall** + **HCM·phường mới / HCM·phường cũ / HN·phường mới / HN·phường cũ**.
- Mỗi ô = đơn đổi kho trong segment / tổng đơn segment.
- Phường mới (HN/HCM) thường cao nhất.

| Segment | Ngưỡng 🟢/🟡 |
|---|---|
| Overall | ≤1.5 / ≤2.3 |
| Phường MỚI | ≤6 / ≤10 |
| Phường CŨ | ≤2 / ≤4 |

---

## 5. Tỷ lệ đổi kho toàn quốc — theo nguồn đơn × phường mới/cũ
Bảng: dòng = **Overall / SPE / TTS / SME**; cột = **Phường mới (%) · WoW · Phường cũ (%) · WoW**.
- `% = đơn đổi kho trong (channel × phường) / tổng đơn (channel × phường)`.
- WoW = chênh điểm % tuần này − tuần trước (↑ đỏ = xấu đi, ↓ xanh = cải thiện).

---

## 6. Top 20 BC đổi kho cao nhất + lý do
Cột: `bcName · region · province · totalOrders · revertCount · revertRate(%) · topReason · status`.
- `revertRate = revertCount / totalOrders`. Ngưỡng 🟢≤2.3 / 🟡≤4.

---

## 7. Deep-dive lý do đổi kho — theo nguồn đơn × phường mới/cũ
Ma trận: **dòng = lý do**, **cột = (Overall / SPE / TTS / SME) × (Mới / Cũ)** = % phân bổ lý do trong từng cột (mỗi cột cộng = 100%).
- Phường mới lệch về *Sai routing rule / Sai mapping địa chỉ*; phường cũ lệch về *BC đóng/quá tải*.

**5 lý do đổi kho** (`ly_do_code` · tên · nhóm):
| Code | Tên | Nhóm | Tỷ trọng mock |
|---|---|---|---|
| `bc-closed` | BC nhận đóng / quá tải | Vận hành | 28% |
| `routing-rule` | Sai routing rule | Vận hành | 22% |
| `address-error` | Sai mapping địa chỉ | Vận hành | 16% |
| `service-unavail` | Service không hỗ trợ vùng | Vận hành | 8% |
| `khac` | Khác / GAP công thức | GAP | 26% |
→ ~66% lý do vận hành (fix được), ~34% GAP công thức.

---

## 8. Phân giải gán đơn — chỉ định kho
2 thẻ (từ engine ORS phân giải: **Chỉ định BC + Bộ BC + Mặc định**):

| Metric | Công thức | Hướng | Ngưỡng 🟢/🟡 |
|---|---|---|---|
| **% đơn chỉ định kho** | (Chỉ định BC + Bộ BC) / tổng đơn | cao tốt | ≥88 / ≥80 |
| **% đơn không chỉ định** | Mặc định / tổng đơn (rơi về default = thiếu config BC → dễ revert) | thấp tốt | ≤10 / ≤18 |

(Liên quan: **% phân tuyến đúng lần đầu ≈ 100% − tỷ lệ đổi kho**; ngưỡng ≥98.5 / ≥95.)

---

## 9. So sánh theo loại hàng (BC lấy / BC giao)
3 nhóm: **Tiêu chuẩn / Cồng kềnh / Nặng**. Mỗi nhóm:
- `donLay` (đơn BC lấy), `donGiao` (đơn BC giao)
- `% đổi kho`, `% phân tuyến đúng` (= 100 − đổi kho), `ontime giao`
- Hàng cồng kềnh/nặng thường đổi kho + trễ nhiều hơn.

---

## 10. Lý do đổi kho (pie) + Tác động chi phí
- **Donut** 5 lý do (mục 7) theo số đơn.
- **Tác động chi phí**: tổng đơn đổi kho · chi phí phát sinh (×10k/đơn) · tiềm năng tiết kiệm nếu giảm 40% đổi kho.

---

## 11. Dữ liệu cần để tính (fact-level)
Tối thiểu 1 dòng / đơn (`fact_order` + join `fact_pickup`):

| Trường | Mô tả |
|---|---|
| `order_id` | MVĐ |
| `created_ts` | thời điểm tạo (lọc kỳ + WoW) |
| `channel` | nguồn đơn: tts/spe/sme/ka/b2b/cb |
| `phuong_moi` (bool) | địa chỉ phường mới hay cũ |
| `region_code` / `province_code` | vùng / tỉnh giao |
| `bc_giao_code` (+ name) | BC giao (sau gán) |
| `is_changed_warehouse` (bool) | có đổi kho không |
| `ly_do_code` | lý do đổi kho (5 mã ở mục 7) — **cần để tính deep-dive** |
| `assign_layer` | Chỉ định BC / Bộ BC / Mặc định — **cần cho % chỉ định kho** |

Từ các trường này tính được TẤT CẢ metric trong trang: tỷ lệ đổi kho (overall / channel / phường / vùng / BC), % chỉ định kho, deep-dive lý do, WoW, top BC, chi phí (×10k).

> Lưu ý: trong dashboard hiện tại `assign_layer` (chỉ định/bộ/mặc định) và phân bổ lý do deep-dive đang sinh **mock** (seeded theo tỷ lệ đổi kho) — chờ data ORS thật. Template nhập lý do: `templates/Template_Ly_Do_Doi_Kho.xlsx`.
