# Dashboard Analytics — Spec

## Goal

Turn `/dashboard` into a real analytics surface backed by synced transactions and budgets, with no hardcoded financial values and no placeholder investing or AI sections pretending to be live.

This milestone should answer:

"For the selected month, how much came in, how much went out, where did it go, and which rows need attention?"

## Scope

**In scope**
- Replace the dashboard KPI strip with real transaction-backed metrics.
- Replace the cashflow chart with real daily inflow/outflow data for the selected month.
- Replace the recent ledger mock with real transactions.
- Reuse `budgets.summary` for the Budget Progress section.
- Replace the watchlist card with a real spending-by-category panel.
- Add a real month selector for dashboard analytics.
- Define deterministic rules for pending items, transfers, refunds, uncategorized rows, and inactive-account history.

**Out of scope for this milestone**
- AI-generated insight copy.
- Stock watchlists, market prices, or simulated portfolio prompts.
- Recurring-spend or subscription detection.
- Custom date ranges like week, quarter, or YTD.
- Forecasting, trend projection, or anomaly detection.
- Merchant-rule learning from dashboard interactions.

## Product Definition

The dashboard is the top-level readout for the user's imported ledger.

It should be:
- real
- deterministic
- month-scoped
- consistent with `/transactions` and `/budgets`

It should not introduce a second financial interpretation layer. Dashboard math must either:
- come from a dedicated dashboard query with locked rules, or
- reuse an existing source such as `budgets.summary`

## Primary Decisions

### Period model

- Dashboard analytics are scoped to a calendar month.
- Input month uses `YYYY-MM-DD` and must be normalized to the first of the month.
- Replace the fake `W / M / Q / YTD` picker with a real month switcher.
- Default month is the current calendar month in the user's local workflow.

### Existing dashboard sections

Ship these sections on `/dashboard`:
- monthly overview cards
- cashflow chart
- recent ledger
- budget progress
- spending-by-category panel
- quick actions

Remove or replace these placeholder sections in the core milestone:
- watchlist
- simulated portfolio CTA
- rotating AI insight copy

If layout balance needs another panel, use a deterministic summary derived from live data. Do not keep static copy in production UI.

## Domain Rules

### Canonical amount semantics

- FinWin transaction storage is account-based:
  - positive = money in
  - negative = money out
- Plaid normalization happens before persistence.
- Dashboard queries must not re-invert provider amounts.

### Selected month boundaries

Given `month = 2026-04-01`:
- include rows where `date >= 2026-04-01`
- include rows where `date < 2026-05-01`

### Which transactions count in dashboard aggregates

For monthly overview cards and the cashflow chart:
- user-scoped
- month-scoped
- include pending rows
- include historical rows from inactive accounts
- exclude rows categorized as `Credit Card Payment`

Reasoning:
- pending should align with current budgeting behavior
- inactive-account history should still count for historical truth
- transfers represent visible ledger movement unless explicitly reclassified into a more precise category
- credit-card-payment rows would distort inflow/outflow totals with internal money movement

### Refund and reversal treatment

For overview and cashflow metrics:
- positive rows count toward inflow
- negative rows count toward outflow

This is intentional cashflow math, not budget-spend math.

For spending-by-category:
- compute category spend from net category movement
- refunds reduce spend in the same category
- displayed spend is floored at `0.00`

Examples:
- Groceries `-100`, refund `+20` => category spend `80`
- Shopping `-20`, refund `+35` => category spend `0`

### Uncategorized transactions

- Uncategorized rows are included in overview and cashflow if they are not transfer-like rows.
- Uncategorized spend should be allowed to appear in the category breakdown so the dashboard can expose unfinished categorization work.
- Uncategorized remains excluded from `budgets.summary` and budget math.

## Metrics Definition

### Monthly overview cards

The first dashboard strip should show three metrics:
- inflow
- outflow
- net cashflow

### Inflow

Sum of positive qualifying transaction amounts for the selected month.

### Outflow

Absolute sum of negative qualifying transaction amounts for the selected month.

### Net cashflow

`inflow - outflow`

Equivalent to the signed sum of qualifying transaction amounts.

### Savings rate

`netCashflow / inflow`

Rules:
- return `null` when inflow is `0`
- allow negative values if the month is net negative
- format as a percent in the UI

Savings rate remains a valid derived metric, but it should not occupy one of the primary dashboard overview cards in this milestone. If surfaced later, it should appear in a secondary summary treatment rather than crowding the KPI strip.

### Month-over-month comparison

Each card may show a comparison to the prior calendar month.

Comparison rules:
- compare against the immediately previous month using the same inclusion rules
- if the previous month has no qualifying rows, return no delta instead of implying a real `0`
- UI should render a neutral "no prior month yet" state instead of fake percentage movement

### Cashflow chart

The chart should show daily bars for the selected month:
- inflow per day
- outflow per day

Output should include one row per calendar day in the selected month range so the chart remains stable even on sparse data.

Each day row should include:
- `date`
- `inflowAmount`
- `outflowAmount`
- `netAmount`

This chart replaces the current static 7-day mock.

### Spending-by-category panel

This panel replaces the watchlist card.

It should answer:

"What categories are driving month-to-date spend?"

Inclusion rules:
- month-scoped
- user-scoped
- include pending rows
- include inactive-account history
- exclude the `Income` group
- exclude the `Transfers` group
- exclude `Credit Card Payment`

Computation:
- aggregate by category
- `rawCategoryTotal = sum(amount)`
- `spendAmount = max(-rawCategoryTotal, 0)`

Display rules:
- hide categories where `spendAmount = 0`
- sort descending by `spendAmount`
- return top categories for compact dashboard display
- include uncategorized spend when present

Recommended return shape:
- `rows`
  - `categoryId | null`
  - `categoryName`
  - `groupName`
  - `spendAmount`
  - `shareOfTopCategories` or `shareOfTotal`
- `totals`
  - `totalTrackedSpend`
  - `categoryCount`

### Recent ledger

This panel replaces the hardcoded `ledger` array.

Recommended behavior:
- return the latest 6 to 8 transactions for the selected month
- order by `date DESC, createdAt DESC`
- include account and category metadata needed for display
- include pending status
- include rows from inactive accounts if they fall in the selected month

Each row should include:
- `id`
- `date`
- `name`
- `merchantName`
- `amount`
- `pending`
- `accountId`
- `accountName`
- `accountMask`
- `accountIsActive`
- `categoryId`
- `categoryName`
- `categoryGroupName`

The card should continue linking to `/transactions`.

## Budget Progress Reuse

Dashboard budget data must continue to reuse `budgets.summary`.

Rules:
- selected dashboard month and budget month should match
- dashboard should format a compact subset of rows if needed
- budget math must not be duplicated inside a dashboard-specific query

## API Surface

Add `dashboardRouter` to `src/server/trpc/routers/`.

### `dashboard.overview`

**Input**
- `month: string`

**Output**
- `month`
- `comparisonMonth`
- `comparisonAvailable`
- `totals`
  - `inflow`
  - `outflow`
  - `netCashflow`
  - `savingsRate`
- `deltas`
  - `inflow`
  - `outflow`
  - `netCashflow`
  - `savingsRate`

### `dashboard.cashflow`

**Input**
- `month: string`

**Output**
- `month`
- `days`
  - `date`
  - `inflowAmount`
  - `outflowAmount`
  - `netAmount`

### `dashboard.spendingByCategory`

**Input**
- `month: string`

**Output**
- `month`
- `totals`
- `rows`

### `dashboard.recentTransactions`

**Input**
- `month: string`
- optional `limit`

**Output**
- display-ready recent ledger rows for the dashboard only

This should stay narrower than `transactions.list` and avoid returning filter payloads the dashboard does not need.

## UI Surface

Page: `src/pages/dashboard.tsx`

### Header controls

- Replace the fake period tabs with a real month switcher.
- Keep the existing page shell, sidebar, and header language unless a specific dashboard section needs layout changes.

### Overview cards

- Four cards, not three.
- Display live values only.
- Comparison text should be absent or neutral when no prior-month baseline exists.

### Cashflow

- Title should reflect the selected month, not a fake 7-day window.
- The panel should render clean empty states when the month has no qualifying transactions.

### Spending-by-category

- Use a compact chart or ranked bar treatment.
- Prioritize readability over decorative market-style styling.
- The panel should visually reinforce that FinWin is a budgeting app first, not an investing terminal yet.

### Recent ledger

- Use merchant name when present, fallback to transaction name.
- Keep pending visibly labeled.
- If a row belongs to an inactive account, the account metadata can still display; do not drop the row silently.

### Placeholder removal

- Remove watchlist-specific labels and market-delay text.
- Remove static AI quote rotation.
- Keep quick actions only for implemented routes and actions.

## Edge Cases

- User has linked accounts but no transactions in selected month:
  - dashboard renders empty states, not mock numbers
- User has only transfer rows in selected month:
  - overview cards can show zero because internal movement is excluded
- User has outflow but no inflow:
  - savings rate is `null`, not divide-by-zero noise
- User is newly connected and prior month has no data:
  - suppress deltas
- Refund-heavy month:
  - category spend floors at zero
- Inactive account history exists in selected month:
  - include it in aggregates and recent ledger if it falls in range

## Non-Goals

This milestone is not trying to:
- infer intent from merchants
- detect subscriptions
- explain numbers with AI
- introduce portfolio analytics
- solve every date-range need

It is only trying to make the existing dashboard trustworthy.
