# GHN glossary

Vietnamese terms + acronyms used inside GHN. **Use these in code identifiers, UI labels, and documentation** — do not translate to English unless explicitly asked.

## Nodes (geographic + organizational)

| Term | Meaning | English equiv |
|---|---|---|
| **BC** | Bưu cục | Post / station |
| **BC nhận** (BC lấy) | Bưu cục nhận đơn từ shop / pickup | Origin post |
| **BC giao** | Bưu cục giao hàng cho khách (last-mile) | Delivery post |
| **BC hoàn** | Bưu cục xử lý hoàn | Returns post |
| **KTC** | Kho Trung Chuyển | Transfer hub |
| **Hub** | Synonym của KTC trong giao tiếp tiếng Anh | — |
| **Lane** | Chặng linehaul **KTC → KTC** | Lane |
| **Route** (tuyến) | Tuyến last-mile của 1 NVBC | Route |
| **Phường / Xã** | Ward — đơn vị địa lý nhỏ nhất | Ward |
| **Quận / Huyện** | District | District |
| **Tỉnh / Thành phố** | Province | Province |
| **Vùng** | Region — Bắc / Trung / Nam | Region |

## People / roles

| Term | Meaning |
|---|---|
| **NVPTTT** | Nhân viên phụ trách thị trường — pickup staff đi lấy hàng từ shop |
| **NVBC** | Nhân viên bưu cục — last-mile shipper, người giao tận tay khách |
| **NVBC hoàn** | NVBC chuyên giao hàng hoàn về shop |
| **Sorter** | Nhân viên phân kiện tại KTC |
| **Driver** | Tài xế linehaul (KTC → KTC) — thường là 3PL |
| **Shop** | Người gửi / merchant — phân loại theo `tier`: TOP / SME / INDIVIDUAL |
| **Carrier** | 3PL bên ngoài vs `internal` (nội bộ GHN) |

## Documents / tracking

| Term | Meaning |
|---|---|
| **MVĐ** | Mã vận đơn — tracking code, in dạng "GHN..." |
| **order_id** | Internal ID của đơn (khác MVĐ) |
| **parcel_code** | Synonym của MVĐ, dùng trong DB schema |
| **planned_path** | Path ORS tính ra lúc tạo đơn |
| **actual_path** | Path thực tế đơn đi qua |

## Outcome / delivery status

| Term | Meaning | English |
|---|---|---|
| **%TC** | Tỷ lệ giao thành công | Delivery success rate |
| **%TB** | Tỷ lệ giao thất bại | Delivery fail rate |
| **%GT1P** | Tỷ lệ giao 1 phần — khách nhận một phần đơn | Partial delivery rate |
| **%GTC** | Tỷ lệ giao trong ca / shift — khác với %TC | Same-shift delivery rate |
| **GTC outcome** | Giao thành công (single-attempt result) | — |
| **GTB outcome** | Giao thất bại (single-attempt result) | — |
| **OTD** | On-Time Delivery — giao đúng SLA cam kết | — |
| **First-attempt success** | % giao TC ngay lần thử 1 | — |
| **Return rate** | % đơn cuối cùng đi về hoàn | — |
| **Lost rate** | % đơn thất lạc | — |
| **Damage rate** | % đơn báo hư hỏng | — |

## Time / SLA

| Term | Meaning |
|---|---|
| **TAT** | Turn Around Time — tổng thời gian xử lý tại 1 node |
| **COT** | Cut-Off Time — hạn chót xuất hàng trong ngày |
| **SLA** | Service Level Agreement — cam kết thời gian giao |
| **Dwell time** | Thời gian đơn lưu lại tại KTC trước khi xuất |
| **Overstay** | Đơn dwell quá ngưỡng (thường >24h) |
| **Lead time** | Thời gian end-to-end từ tạo đơn đến giao |
| **Khung giờ** | Time window (e.g. khung giờ cut-off sáng/chiều/đêm) |

## Money

| Term | Meaning |
|---|---|
| **COD** | Cash on Delivery — thu hộ tiền hàng cho shop |
| **CPP** | Cost per parcel (VND/đơn) |
| **COD reconciliation** | Đối soát COD — verify số tiền NVBC thu = số tiền nộp về |
| **Declared value** | Giá trị khai báo của hàng — dùng cho bồi thường |

## Operations

| Term | Meaning |
|---|---|
| **Fill rate** | % thể tích / trọng tải xe được sử dụng |
| **Cross-dock** | Đơn vào KTC rồi xuất ngay, không qua đêm |
| **Sort accuracy** | % đơn được phân loại đúng tại KTC |
| **Missort** | Phân loại sai → routing tới wrong KTC/BC |
| **Fallback rule** | Quy tắc ORS chạy khi rule chuẩn không match |
| **Mis-route** | `actual_path` khác `planned_path` |
| **Re-route** | Đơn bị đổi path sau khi ORS đã quyết định ban đầu |
| **Deadhead** | Chuyến rỗng chiều về (no load) |

## Service types

| Term | Meaning |
|---|---|
| **Standard** (chuẩn) | Service thường |
| **Bulky** (cồng kềnh) | Hàng cồng kềnh / nặng — riêng lane |
| **Express** (nhanh) | Giao nhanh trong ngày |
| **B2B** | Giao buôn |
| **Freight** | Vận chuyển khối lượng lớn |

## System modules

| Term | Meaning |
|---|---|
| **ORS** | Order Routing System — quyết định đơn ĐI ĐÂU |
| **NDS** | Network Design System — thiết kế lane / KTC topology |
| **TMS** | Transport Management System — quản lý trip / linehaul / last-mile |
| **App TRuck** | Mobile app cho tài xế linehaul |
| **App NVBC** | Mobile app cho shipper last-mile |
