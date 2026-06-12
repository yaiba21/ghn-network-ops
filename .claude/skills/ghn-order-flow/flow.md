# GHN order state machine

## Canonical 15-step flow (forward + reverse)

```
Step 0:  ORDER_CREATED              (khách đặt đơn)
Step 1:  PICKUP_REQUESTED           (yêu cầu lấy hàng đến BC lấy)
Step 2:  PICKUP_SUCCESS             (BC lấy đã nhận hàng — kiện vào hệ thống)
Step 3:  RECEIVED_AT_PICKUP_POST    (BC lấy đã xử lý, phân kiện)
Step 4:  TRANSPORTING_TO_KTC_IN     (xuất từ BC lấy → KTC đầu)
Step 5:  RECEIVED_AT_KTC_IN         (KTC đầu nhận, sort)
Step 6:  TRANSPORTING_LINEHAUL      (linehaul giữa các KTC — có thể nhiều chặng)
Step 7:  RECEIVED_AT_KTC_OUT        (KTC cuối nhận, sort theo BC giao)
Step 8:  TRANSPORTING_TO_DELIVERY   (KTC cuối → BC giao)
Step 9:  RECEIVED_AT_DELIVERY_POST  (BC giao nhận, phân tuyến)
Step 10: OUT_FOR_DELIVERY           (NVBC nhận đơn, ra tuyến)
Step 11a: DELIVERED                 (✓ giao thành công)
Step 11b: DELIVERY_FAILED_N         (✗ thất bại lần N — quay lại Step 10)
Step 12: RETURN_INITIATED           (sau 3 lần fail → khởi tạo hoàn)
Step 13: …reverse Step 9 → Step 4…  (đi ngược về BC lấy / BC hoàn)
Step 14: RETURN_TO_SENDER_SUCCESS   (✓ hoàn cho shop)
Step 15: RETURN_TO_SENDER_FAILED    (✗ → lưu kho)
```

**Outcome states (terminal):**
- `DELIVERED` — delivered to receiver
- `RETURN_TO_SENDER_SUCCESS` — returned to sender after failed delivery
- `STORED_AT_WAREHOUSE` — return failed, kept in warehouse (treated as "lost" for SLA)
- `LOST` — physically lost in the network

## Skip patterns

Not every order goes through every step. The schema is the **same** — the **event count differs**.

| Loại đơn | Skip | Flow rút gọn |
|---|---|---|
| Cùng quận, BC lấy = BC giao | Bỏ Step 4–8 (không qua KTC) | 0→1→2→3→**9**→10→11 |
| Cùng tỉnh, khác quận | Bỏ Step 6–7 (1 KTC duy nhất) | 0→1→2→3→4→5→**8**→9→10→11 |
| Liên tỉnh thường | Full flow | 0→1→…→11 |
| Liên tỉnh xa (Bắc–Nam) | Multi-hop KTC | 0→…→5→6(KTC1→KTC2→KTC3)→7→… |
| Giao nhanh trong ngày (express) | Bỏ KTC nếu được, ưu tiên lane riêng | 0→1→2→3→9→10→11 |
| Drop-off (khách tự mang đến BC) | Bỏ Step 1 — không có pickup request | 0→**2**→3→… |

**Rule for data layer:** every order shares the same fact-event schema, but `state_history` has different lengths. Don't write `if (orderType === "X") use pathA`; always derive from `last_known_state` + `state_history`.

## State machine anomalies — flag these in dashboards

These are situations where the **physical scan happened but the system status didn't update**. Surface them in alert feeds.

| Anomaly | Meaning |
|---|---|
| `Transporting` + last scan = `RECEIVED_AT_SORTING` | Đã nhập KTC nhưng status hệ thống vẫn nói "đang vận chuyển" |
| `Storing` + last scan = `RECEIVED_AT_LASTMILE` | Đã nhập BC giao/hoàn nhưng status chưa cập nhật |
| `OUT_FOR_DELIVERY` > 24h without resolution | NVBC chưa close đơn — có thể out-of-tour hoặc forgot scan |
| `DELIVERY_FAILED_N` × 3 → no `RETURN_INITIATED` for >24h | Workflow stuck — manual intervention needed |
| `current_state = DELIVERED` + COD not collected | Tài chính phải reconcile |

## Path tracking

```
planned_path: ["BC_LAY_001", "KTC_HCM", "KTC_HN", "BC_GIAO_042"]
actual_path:  ["BC_LAY_001", "KTC_HCM", "KTC_HN", "BC_GIAO_042"]
```

When `actual_path` diverges from `planned_path`, that's a **mis-route** (Step 5 or 7 chose the wrong next node). Track via the `MIS_ROUTE` event variant or by comparing arrays.

## Key timestamps on `fact_order`

These are the "anchor" timestamps lifted from `fact_parcel_event` for fast filtering:

```
created_ts           = ORDER_CREATED
pickup_success_ts    = PICKUP_SUCCESS
first_ktc_in_ts      = first RECEIVED_AT_KTC_IN
last_ktc_out_ts      = last TRANSPORTING_LINEHAUL or RECEIVED_AT_KTC_OUT
delivery_post_in_ts  = RECEIVED_AT_DELIVERY_POST
out_for_delivery_ts  = first OUT_FOR_DELIVERY (resets on failed attempts? — no, capture only first)
delivered_ts         = DELIVERED
return_initiated_ts  = RETURN_INITIATED
return_completed_ts  = RETURN_TO_SENDER_*
promised_delivery_ts = SLA cam kết (from service tier + distance)
```

## Outcome derivation

```
final_status:
  DELIVERED      if delivered_ts IS NOT NULL
  RETURNED       if return_completed_ts IS NOT NULL AND return_succeeded
  LOST           if is_lost flag set OR stored_at_warehouse OR no scan > N days
  IN_PROGRESS    otherwise

is_otd = delivered_ts <= promised_delivery_ts
is_returned = return_initiated_ts IS NOT NULL
is_lost = explicit flag (LOST event) OR aged-out
```
