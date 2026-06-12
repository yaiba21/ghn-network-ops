---
name: ghn-order-flow
description: Use whenever you work on GHN (GiaoHangNhanh) parcel logistics — anything touching the order journey, hub/post/lane operations, or routing decisions. Triggers include the GHN terminology (BC, KTC, NVPTTT, NVBC, MVĐ, lane, %TC, %GT1P, COT, TAT), the state-machine names (ORDER_CREATED, PICKUP_SUCCESS, RECEIVED_AT_KTC_IN, OUT_FOR_DELIVERY, etc.), and questions about how a parcel moves end-to-end — from shop intake to delivery, with returns. Has the 15-step state model, 5 skip patterns, role glossary, and stage-by-stage KPIs.
---

# GHN order flow

GHN (GiaoHangNhanh) is a Vietnamese parcel logistics network. A parcel moves through a chain of **posts (BC)** and **transfer hubs (KTC)** between sender and receiver. The same schema covers domestic same-city, inter-region, and returns — what differs is **how many events fire**, not which fields exist.

## When you need this skill

- Designing/building dashboards or reports about parcel flow, hub/post performance, last-mile delivery, or returns
- Naming things in a GHN-flavored way (don't anglicize: it's **BC** not "post office", **KTC** not "hub", **NVBC** not "driver")
- Computing KPIs that span stages (E2E OTD, lead time P90, return rate, %TC)
- Understanding what data a "delivered" / "returned" / "lost" outcome implies
- Mapping API events / status codes to the canonical state machine

## Three rules that catch most mistakes

1. **Don't hard-code path**. Same-quận orders skip Step 4–8 (no KTC). Same-tỉnh orders skip Step 6–7 (1 KTC). Use `last_known_state` + `state_history`, never `if (event.type === "X")` chains.
2. **`current_state` ≠ event timestamp**. An order can be "Transporting" in the system but have `RECEIVED_AT_SORTING` as its last physical scan — these are *anomalies* worth surfacing, not bugs.
3. **OTD vs %TC vs first-attempt are different metrics**. OTD = delivered by promised SLA. %TC = % attempts that succeed. First-attempt = % delivered on attempt #1. Don't conflate.

## How to navigate the reference files

Load the file you need; don't preload everything.

- **`flow.md`** — the 15-step state machine (forward + reverse), 5 skip patterns, system anomaly states
- **`glossary.md`** — every GHN acronym + Vietnamese-English terminology mapping (use this whenever you need to read or write GHN-flavored Vietnamese in code/UI/docs)
- **`metrics.md`** — KPIs per stage with formulas, dimensions to slice, drill-down paths, and GHN baseline numbers

## Naming conventions

When writing code or UI text about GHN:

- **Variable / function names**: use GHN abbreviations directly — `ktcCode`, `bcGiao`, `mvd`, `gtcRate`, `nvbcId`. Don't translate to English ("hub", "driver").
- **Vietnamese UI labels**: keep abbreviations as-is (`%TC`, `%TB`, `%GT1P`, `MVĐ`, `OTD`, `COT`, `TAT`). Spell out the full term in tooltips when first introduced.
- **English code comments**: OK to use full English ("delivery attempt", "transfer hub") for readability, but the data model field names stay GHN.

## Common workflow patterns

When asked "build a dashboard for X stage" → load `flow.md` to find the right state-machine slice, `metrics.md` for KPI definitions, `glossary.md` for labels.

When asked "is metric X higher-better or lower-better" → `metrics.md` has a direction column.

When designing a query/aggregate → never query the raw event table for dashboard reads; pre-aggregate to daily roll-ups (`agg_daily_*`). See `metrics.md` for the recommended pre-agg shape.

When deciding what to skip in a small/local order → `flow.md` § Skip patterns.
