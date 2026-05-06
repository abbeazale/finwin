# Dashboard Analytics — Plan

Companion to [spec/dashboard-analytics.md](../spec/dashboard-analytics.md). This milestone narrows Phase 3 to one job: replace the remaining dashboard placeholders with deterministic ledger-backed analytics.

## Goal

Ship a trustworthy `/dashboard` backed by real imported transactions and existing budget summary logic, with:
- real monthly overview cards
- real daily cashflow
- real recent ledger rows
- real category spending breakdown
- no placeholder watchlist or AI insight copy

This milestone is complete when the dashboard stops pretending and every financial number on the page comes from the database.

## UI Direction

Preserve the existing dashboard shell and visual language where it is already working:
- sidebar
- header
- typography
- overall atmosphere

Do not preserve placeholder behavior just because it is already styled.

### Keep

- the dashboard as the main signed-in landing page
- the current editorial finance-desk tone
- quick actions, if they point to real product surfaces

### Replace

- fake KPI numbers
- fake cashflow bars
- fake ledger rows
- watchlist card
- rotating AI insight card
- fake period picker

## Delivery Order

Build in this order:

1. lock the dashboard metric rules
2. add `dashboardRouter`
3. wire overview + recent ledger
4. wire cashflow + spending-by-category
5. update `src/pages/dashboard.tsx` and remove placeholder sections
6. verify against live synced data

## Phase 0 — Metrics Contract (1/2 day)

Before adding the router, lock the financial rules in code comments or helper names so the queries do not drift.

### Decide once

- dashboard month is calendar-month only
- transfers are included in overview and cashflow as visible ledger movement
- `Credit Card Payment` is excluded from overview and cashflow
- pending rows are included
- inactive-account history is included
- category spend uses net category movement floored at zero
- deltas disappear when prior-month baseline is missing

### Exit

No ambiguity remains around what the dashboard is measuring.

## Phase 1 — `dashboardRouter` Backbone (1 day)

Add `src/server/trpc/routers/dashboard.ts` and wire it into `_app.ts`.

### Implement first

- `dashboard.overview`
- `dashboard.recentTransactions`

### Why this order

- overview replaces the most visible placeholder numbers first
- recent ledger removes the most obvious mock data from the page

### Notes

- keep month validation aligned with `budgets.summary`
- return money values as strings for UI formatting consistency
- keep comparison metadata explicit so the page can suppress fake deltas

### Exit

The dashboard has live top-line numbers and live ledger rows even if charts are not wired yet.

## Phase 2 — Cashflow + Category Spend (1 day)

Implement the chart-backed dashboard queries.

### Build

- `dashboard.cashflow`
- `dashboard.spendingByCategory`

### Query rules

- one row per day for the selected month in `cashflow`
- stable ordering
- transfer exclusion locked in one place
- category spending sorted by highest spend
- uncategorized spend can surface when real

### Exit

The dashboard now has enough live data to replace both the cashflow mock and the watchlist card.

## Phase 3 — Dashboard Page Wiring (1-2 days)

Update `src/pages/dashboard.tsx`.

### Replace

- `kpiCards` constant
- static cashflow data array
- static `ledger` array
- `watchlist` panel
- `insights` rotation
- fake `W / M / Q / YTD` controls

### Add

- real month switcher
- three overview cards
- live cashflow chart
- live spending-by-category panel
- dashboard queries with loading and empty states

### Reuse

- `budgets.summary` for Budget Progress
- existing auth/session page shell
- current live refresh/connect callbacks in the header

### Exit

`/dashboard` contains no hardcoded financial values and no fake investment or AI panels.

## Phase 4 — Verification + Tightening (1/2-1 day)

Run targeted verification against live synced data.

### Minimum checks

- typecheck passes
- targeted lint passes
- current month overview matches manual ledger spot checks
- transfer-heavy rows do not inflate inflow/outflow
- refunds reduce category spend appropriately
- prior-month delta disappears when no baseline exists
- inactive-account historical transactions still affect month totals
- recent ledger rows match `/transactions` ordering for the same month
- budget progress still matches `/budgets`

### Exit

The dashboard can be trusted as the main entry point into the product.

## Suggested Implementation Shape

### Server

- `src/server/trpc/routers/dashboard.ts`
- shared month helpers may live beside dashboard router if they stay small

### Client

- `src/pages/dashboard.tsx`
- optional dashboard-specific presentational components only if the page gets unwieldy

### Reused sources

- `src/server/trpc/routers/budgets.ts`
- `src/server/trpc/routers/transactions.ts`
- `src/db/schema.ts`

## Risks And Mitigations

- **Transfer handling can make totals look wrong**
  - Mitigation: include generic `Transfer` rows in overview/cashflow until FinWin can distinguish internal matched transfers from external movement; keep `Credit Card Payment` excluded

- **Refund semantics can drift between cards and category charts**
  - Mitigation: treat overview as cashflow math and category chart as net spend math; document both explicitly

- **Dashboard can fork from budgets logic**
  - Mitigation: continue reusing `budgets.summary`

- **The page can become visually noisy during loading**
  - Mitigation: use section-level loading states instead of replacing the whole page with a spinner

- **Placeholder sections can linger because they look polished**
  - Mitigation: delete them as part of the milestone, not as optional cleanup

## Testing And Verification

Minimum verification for this milestone:

- `bunx tsc --noEmit`
- targeted `bunx eslint` on touched dashboard and router files
- manual checks with live synced data

Recommended manual scenarios:

- month with paycheck plus normal spend
- month with transfer activity between linked accounts
- refund inside a spending category
- uncategorized outflow present
- newly linked user with no prior month baseline
- month containing transactions from an account that has since been unlinked

## Dependencies

- `src/db/schema.ts`
- `src/server/trpc/routers/_app.ts`
- `src/server/trpc/routers/budgets.ts`
- `src/server/trpc/routers/transactions.ts`
- `src/pages/dashboard.tsx`
- `docs/spec/dashboard-analytics.md`

## Follow-On Work

Defer until after the core dashboard is real:
- recurring or subscription detection
- AI explanations layered on top of deterministic metrics
- custom time ranges such as week, quarter, or YTD
- portfolio surfaces returning to the dashboard
