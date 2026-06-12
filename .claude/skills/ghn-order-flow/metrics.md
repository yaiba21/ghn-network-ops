# GHN metrics — per stage

Each metric has: **formula** · **direction** (higher-better ↑ / lower-better ↓) · **GHN baseline + target** · **dimensions to slice**.

> **Baseline numbers below are real production numbers from GHN's network ops team** — use these for mock data + UI calibration. Adjust thresholds for status logic but keep baselines close to reality.

## Step 0 — ORDER_CREATED

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| Volume đơn / ngày | `COUNT(order_id)` | ↑ | 50,000 (network avg) | — |
| % đơn được routing thành công | `SUM(planned_path IS NOT NULL) / COUNT(*)` | ↑ | 98.5% | 99% |
| % đơn lỗi địa chỉ | `SUM(routing_status='ADDRESS_ERROR') / COUNT(*)` | ↓ | 0.6% | <0.3% |
| % đơn rơi fallback rule | `SUM(routing_method='FALLBACK') / COUNT(*)` | ↓ | 3.2% | <2% |
| ORS latency (P50/P95/P99) | từ ORS log | ↓ | P50 85ms · P99 220ms | P95 <200ms |

**Dimensions:** hour-of-day · day-of-week · service · sender region/province · shop tier · COD/non-COD · season (sale events)

## Step 1–3 — PICKUP (First-mile)

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| % Pickup success | `SUM(pickup_success_ts NOT NULL) / SUM(pickup_requested)` | ↑ | 94% | 96% |
| Pickup TAT (giờ) P50 | `pickup_success_ts - created_ts` | ↓ | 2.5h | <2h |
| % pickup đúng SLA | `SUM(pickup_tat <= sla) / COUNT(*)` | ↑ | 91% | 95% |
| % hủy pickup | `SUM(pickup_cancelled) / SUM(pickup_requested)` | ↓ | 2.5% | <2% |
| % drop-off vs pickup-at-home | tỷ trọng 2 luồng | — | 35% drop-off | — |
| TAT tạo đơn → bắn vào kiện | `received_at_pickup_post_ts - created_ts` | ↓ | 3.2h | <2.5h |
| % đơn không có MVĐ (lỗi nhãn) | từ event meta | ↓ | 0.3% | <0.2% |
| Productivity NVPTTT | `COUNT(orders) / NVPTTT / day` | ↑ | 45 đơn/người/ngày | 55 |
| % đơn lưu qua đêm tại BC lấy | `DATE(transporting_to_ktc_in_ts) > DATE(pickup_success_ts)` | ↓ | 4.8% | <3% |

**Dimensions:** post (BC lấy) · NVPTTT · phường/quận/tỉnh · vùng · pickup form (drop-off/home) · khung giờ · service · ngày trong tuần / mùa vụ

**Drill paths:** Pickup success % → by BC lấy → by NVPTTT → by hour → by failure reason

## Step 4–5 — First-mile linehaul + KTC inbound

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| First-mile on-time % | `SUM(actual_arrive <= planned_arrive) / COUNT(trips)` | ↑ | 92.5% | 95% |
| Fill rate first-mile | `AVG(fill_rate_weight)` | ↑ | 72% | 80% |
| TAT BC lấy → KTC (giờ) | `received_at_ktc_in_ts - transporting_to_ktc_in_ts` | ↓ | 4.8h | <4h |
| % trip xuất đúng cut-off | `actual_depart_ts <= planned_depart_ts` | ↑ | 92.5% | 95% |
| KTC inbound sort accuracy | `1 - missort_count / total_sorted` | ↑ | 99.2% | 99.5% |
| Cost / đơn first-mile | `SUM(trip_cost) / SUM(parcels)` | ↓ | 3,800 VND | -5% |
| % overstay KTC inbound | overstay >24h | ↓ | 2.1% | <1.5% |

**Dimensions:** KTC · lane (BC lấy → KTC) · trip · vùng · khung giờ · loại xe · carrier · ngày / mùa vụ

## Step 6 — Inter-KTC linehaul (xương sống mạng)

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| Linehaul on-time % | per leg `SUM(on_time) / COUNT(legs)` | ↑ | 93% | 95% |
| Fill rate linehaul | weight + volume, lấy max | ↑ | 72% | 80% |
| Cost / đơn linehaul (VND) | `SUM(cost) / SUM(parcels)` | ↓ | 5,200 VND | -7% |
| Lane utilization (%) | `actual_parcels / capacity_parcels` per lane per day | ↑ | 68% | 80% |
| TAT linehaul P50 | per lane | ↓ | 8h intra-region · 36h Bắc-Nam | — |
| % chuyến rỗng chiều về (deadhead) | `SUM(empty_return) / SUM(trips)` | ↓ | 32% | <25% |
| % linehaul >2 hops | path inefficiency signal | ↓ | 8% | <5% |
| Forecast accuracy (MAPE) | `AVG(ABS(actual-forecast)/actual)` per lane per day | ↓ | 14% | <10% |
| Cost / kg | unit economics | ↓ | 8,400 VND/kg | — |
| Cost / km | unit economics | ↓ | 6,200 VND/km | — |

**Dimensions:** lane · KTC origin→dest · vùng · khung giờ · loại xe · carrier · ngày trong tuần · mùa vụ

This is the **network design focus area** — NDS team optimizes here.

## Step 7–8 — KTC outbound + BC giao inbound

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| KTC outbound sort accuracy | `1 - missort_to_wrong_post / total_sorted` | ↑ | 99.0% | 99.5% |
| TAT KTC out → BC giao | `received_at_delivery_post_ts - last_ktc_out_ts` | ↓ | 2.8h | <2.5h |
| Fill rate KTC → BC giao | per trip | ↑ | 68% | 75% |
| % đơn missort phải re-route | via re-route events | ↓ | 1.8% | <1% |
| Dwell time KTC cuối | `last_ktc_out_ts - received_at_ktc_out_ts` | ↓ | 3.5h | <3h |
| % BC giao nhận đúng cut-off | timely arrival to BC giao | ↑ | 89% | 93% |

**Dimensions:** KTC · BC giao · lane KTC→BC giao · vùng · khung giờ

## Step 9–10 — BC giao + OUT_FOR_DELIVERY (Last-mile)

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| % đơn ra tuyến trong ngày | `SUM(out_for_delivery same-day as received_at_delivery_post) / COUNT(*)` | ↑ | 88% | 92% |
| TAT BC giao → out for delivery | `out_for_delivery_ts - received_at_delivery_post_ts` | ↓ | 1h | <0.75h |
| % đơn lưu qua đêm tại BC giao | overstay rate | ↓ | 3.8% | <2% |
| Avg # đơn / NVBC / ngày | productivity | ↑ | 38 đơn/người/ngày | 45 |
| Avg stops / route | route planning quality | ↓ | 28 stops | optimal — depends on density |
| Avg distance / route | route planning quality | ↓ | 42 km | — |

## Step 11 — DELIVERED / FAILED (outcome)

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| **%TC** | `SUM(outcome='GTC') / COUNT(attempts)` | ↑ | 95% | 96% |
| **OTD %** | `SUM(delivered_ts <= promised_delivery_ts) / SUM(delivered)` | ↑ | 93.83% | 95% |
| **%TB** | `SUM(outcome='GTB') / COUNT(attempts)` | ↓ | 5% | <4% |
| **First-attempt success %** | `SUM(GTC at attempt_no=1) / COUNT(orders)` | ↑ | 82% | 85% |
| %GT1P | `SUM(outcome='GT1P') / COUNT(attempts)` | ↓ | 1.2% | <1% |
| % đơn cần ≥3 lần thử | `SUM(delivery_attempts >= 3) / COUNT(*)` | ↓ | 4.5% | <3% |
| COD reconciliation rate | `SUM(cod_settled) / SUM(cod_collected)` | ↑ | 99.4% | 99.7% |
| Avg delivery cost / đơn last-mile | `last_mile_cost / parcels` | ↓ | 4,200 VND | — |
| Damage rate | `SUM(damage_reported) / COUNT(delivered)` | ↓ | 0.18% | <0.1% |

**Top failure reasons (group by `failure_reason`):**
- Khách hàng từ chối / không có nhu cầu
- Không liên lạc được khách
- Sai địa chỉ
- Hàng hỏng / vỡ
- Khác

**Dimensions:** BC giao · NVBC · tuyến · phường/quận/tỉnh · vùng · attempt number (1/2/3+) · failure reason · service · COD/non-COD · receiver type · khung giờ

## Step 12–15 — Returns (Reverse)

| Metric | Formula | Dir | Baseline | Target |
|---|---|---|---|---|
| Return rate | `SUM(is_returned) / COUNT(orders)` | ↓ | 7.5% | <6% |
| % hoàn thành công | `SUM(return_completed) / SUM(return_initiated)` | ↑ | 84% | 90% |
| TAT hoàn (ngày) | `return_completed_ts - return_initiated_ts` | ↓ | 4.5 ngày | <3.5 |
| % hoàn thất bại → lưu kho | `SUM(return_failed) / SUM(return_initiated)` | ↓ | 14% | <8% |
| % thất lạc trong hoàn | `SUM(lost_during_return) / SUM(return_initiated)` | ↓ | 1.2% | <0.5% |
| Tồn kho lưu kho (đơn) | `COUNT(orders WHERE stored_at_warehouse)` | ↓ | — | — |
| Aging tồn kho | bucket: <30 / 30–60 / 60+ ngày | ↓ | — | — |
| Chi phí hoàn / đơn | `return_cost / returned_orders` | ↓ | 8,500 VND | — |

**Dimensions:** BC hoàn · NVBC hoàn · shop · vùng · lý do hoàn · số lần hoàn lại · service · COD/non-COD

## E2E (Cross-stage) — North Star

| Metric | Definition | Baseline | Target |
|---|---|---|---|
| **E2E OTD %** | % đơn `delivered_ts <= promised_delivery_ts` | 93.83% | 95% |
| **E2E lead time (P50/P90/P99)** | `delivered_ts - created_ts` | P50 28h · P90 52h · P99 96h | — |
| **Cost per parcel (CPP)** | `(first_mile + linehaul + last_mile + return) / parcels` | 12,500 VND | -7% |
| **% đơn delay >1 ngày** | `SUM(delivered_ts > promised + 24h) / SUM(delivered)` | 4.2% | <3% |
| **Lost rate** | `SUM(is_lost) / COUNT(orders)` | 0.15% | <0.1% |
| **NPS / CSAT** | post-delivery survey | — | — |

## Status logic — green / amber / red

Default rule per metric, with `thresholds: [greenAt, amberAt]`:

- **Higher-better**: green if `value >= greenAt`, amber if `value >= amberAt`, else red
- **Lower-better**: green if `value <= greenAt`, amber if `value <= amberAt`, else red

| Metric | greenAt | amberAt |
|---|---|---|
| OTD E2E | 95 | 92 |
| %TC | 96 | 93 |
| %TB | 4 | 6 |
| Fill rate xe | 80 | 70 |
| % trip đúng COT | 95 | 90 |
| CPP vs target | ≤target | +5% |
| Routing accuracy | 99 | 97 |
| Pickup success | 96 | 93 |
| Sort accuracy KTC | 99.5 | 98.5 |
| Lost rate | 0.1 | 0.3 |

## Pre-aggregation strategy

**Never query `fact_parcel_event` directly from dashboards.** Pre-compute daily roll-ups:

```sql
agg_daily_order_funnel  -- day × service × region: count ở mỗi state
agg_daily_step_tat      -- day × step × dimension: P50/P90/P99 TAT
agg_daily_post_kpi      -- day × BC: pickup/delivery KPIs
agg_daily_ktc_kpi       -- day × KTC: sort/fill rate KPIs
agg_daily_lane_kpi      -- day × lane: trip on-time, fill rate, cost
agg_daily_shipper_kpi   -- day × NVBC: productivity, %TC
```

For real-time views (trip tracker, alert feed) read from a small "current state" snapshot table updated every minute, not from raw events.
