# Budgets — Plan

Companion to [spec/budgets.md](../spec/budgets.md). This plan keeps the first budgets milestone narrow: one deterministic monthly budgeting loop built directly on synced transactions.

## Goal

Ship the first `/budgets` page backed by real ledger data, with:
- monthly budgets per category
- actual spend per category for the selected month
- clear over / near-limit / unbudgeted states
- inline budget editing

This milestone is complete when the budgeting surface works end-to-end without placeholders and the dashboard can reuse the same backend summary logic.

## UI Stack

Use `shadcn/ui` for the budgets interface rather than continuing the fully custom markup pattern from the current dashboard.

### Component direction

Prefer composing from:
- `Card`
- `Field` primitives
- `Input`
- `Select`
- `Button`
- `Separator`
- `Badge`
- `Skeleton`
- `Table` only if the row layout genuinely benefits from it

Likely additions for this milestone:
- `chart`
- `badge`
- `tabs` or `toggle-group` only if month navigation or view switching needs them
- `progress` if the built-in treatment is preferable to a custom status bar

Form/layout rules:
- Use shadcn composition patterns instead of freeform wrapper markup
- Keep styling on semantic tokens and layout classes
- Avoid rebuilding form controls by hand when a project component already exists

## Visual Direction

Use the `frontend-design` skill to make `/budgets` feel like a deliberate financial workspace rather than a generic SaaS CRUD table.

### Direction to aim for

- Editorial finance desk, not neon fintech
- Dense but calm
- Strong hierarchy between month totals and category rows
- Quiet default rows with sharper emphasis for `unbudgeted`, `near_limit`, and `over`
- Refined motion limited to high-signal moments:
  - month transitions
  - inline save feedback
  - budget status emphasis

### What should feel memorable

The budget page should feel like a real control surface:
- the summary reads like a monthly balance sheet
- category groups feel intentional, not like a flat form dump
- warning states are immediate without becoming visually noisy

## Delivery Order

Build in this order:

1. `budgetsRouter`
2. `budgets.summary`
3. `budgets.upsertMonthlyBudget`
4. `budgets.deleteMonthlyBudget`
5. `/budgets` page
6. dashboard Budget Progress wiring

The summary query comes first because it is the financial source of truth for both the page and the dashboard.

## Chart Library Decision

For FinWin budgeting and dashboard analytics, use the `shadcn` `chart` component backed by Recharts.

### Decision

- Primary chart stack: `shadcn/ui` `chart` + Recharts
- Do not introduce TradingView Lightweight Charts for budgets
- Do not add a second dashboard chart stack unless a later investing surface truly needs it

### Why this is the right fit

- It matches the existing repo direction already captured in prior planning
- It integrates naturally with the chosen component system
- It keeps the chart markup close to the rest of the page composition
- It is sufficient for budget progress, spending mix, and monthly cashflow views
- The shadcn chart layer gives strong defaults without locking the app into a custom abstraction

### Where charts should and should not appear in this milestone

For the first budgets milestone:
- `/budgets` does not require a chart to be useful
- prioritize the summary strip and category rows first
- if a chart is added in this pass, keep it small and supportive

Best candidates if a chart is included:
- monthly budgeted vs actual totals
- category spend distribution
- grouped bars for top spending categories

Avoid in the first pass:
- dense multi-series dashboards
- forecasting charts
- complex stacked interactions
- a second chart library just for aesthetics

## Phase 0 — Preconditions Check (½ day)

Confirm the repo is ready for budgets work before writing the router:

- Canonical transaction storage is account-based:
  - positive = money in
  - negative = money out
- Category reassignment exists on `/transactions`
- Category seed is present in the database
- `budgets` table and uniqueness constraint already exist
- Budgeting spec is locked in `docs/spec/budgets.md`

**Exit:** no remaining ambiguity around sign semantics, month semantics, or budgetable category rules.

## Phase 1 — Summary Query Backbone (1 day)

Add `src/server/trpc/routers/budgets.ts` and implement `budgets.summary`.

### Build

- Add month input validation:
  - accepts `YYYY-MM-DD`
  - requires first-of-month value
- Load budgetable categories with category group metadata
- Load matching budget rows for the selected month
- Aggregate actual monthly spend from `transactions`
- Convert raw monthly totals into spend using canonical semantics:
  - `actualSpend = max(-sum(amount), 0)`
- Return grouped category rows plus overall totals

### Query rules

- User-scoped
- Includes pending transactions
- Includes transactions from inactive accounts
- Excludes uncategorized transactions
- Excludes non-budgetable categories
- Ordered by category group sort order, then category sort order

### Exit

`budgets.summary(month)` returns stable grouped rows and totals from real transaction data with no UI yet required.

## Phase 2 — Budget Mutations (½–1 day)

Implement write paths in the same router.

### `budgets.upsertMonthlyBudget`

- Validate category exists
- Validate category is budgetable
- Validate month is normalized to first-of-month
- Validate amount is non-negative
- Upsert by `userId + categoryId + month`

### `budgets.deleteMonthlyBudget`

- Validate month input
- Delete the single matching row for the signed-in user

### Exit

The backend supports create, edit, and delete for one monthly budget row at a time.

## Phase 3 — `/budgets` Page (1–2 days)

Build `src/pages/budgets.tsx` as the first budgeting surface.

### Core UI

- Month switcher
- Summary strip:
  - total budgeted
  - total spent
  - total remaining
  - over-budget count
- Category groups rendered in stable order
- Per-category row with:
  - category name
  - budget amount input
  - actual spend
  - remaining
  - percent used
  - progress/status treatment

### Interaction model

- Initial load uses `budgets.summary`
- Editing a budget amount saves inline
- Clearing a saved value can delete the budget after confirmation
- Query invalidation refreshes both totals and row state
- Mutation feedback should be local to the row or page, not global noise

### First-pass UI rules

- Show categories with spend but no budget as `unbudgeted`
- Show categories over budget clearly
- Render no-budget / no-spend rows in a quieter state
- Do not add rollover, forecasting, or per-account filters
- Do not make a chart the primary interaction surface

### Exit

A user can open `/budgets`, set a monthly budget, and immediately see budget-vs-actual from real imported transactions.

## Phase 4 — Dashboard Reuse (½ day)

Replace the hardcoded Budget Progress data in `src/pages/dashboard.tsx` with `budgets.summary`.

### Build

- Pick a default month:
  - current calendar month
- Reuse the same backend summary output
- Show a trimmed subset of rows or top-priority rows if needed for density

### Exit

Dashboard budget progress and `/budgets` are driven by one backend financial query path.

## Data Notes

### Budget amount

- Stored on `budgets.amount`
- Always non-negative
- Monthly only

### Actual amount

- Never stored
- Always derived from transactions
- Calculated from canonical account semantics

### Remaining amount

- `budget - actual`
- Can be negative when over budget

### Percent used

- `actual / budget` when budget exists and is greater than zero
- `null` when no budget exists

## Risks And Mitigations

- **Refund-heavy categories can look odd**
  - Mitigation: floor actual spend at `0`

- **Users may have many categories with no budget and no spend**
  - Mitigation: keep those rows visually quiet; avoid adding extra logic until the first page is usable

- **Old assumptions from Plaid sign semantics can leak back in**
  - Mitigation: keep all budget math anchored to canonical storage semantics and avoid per-query sign inversion hacks

- **Budget math can fork between dashboard and budgets page**
  - Mitigation: only expose one summary query and reuse it

## Testing And Verification

Minimum verification for this milestone:

- Typecheck passes
- Targeted lint passes
- Manual check:
  - create budget
  - edit budget
  - delete budget
  - unbudgeted category with spend appears correctly
  - over-budget category renders correctly
  - pending transaction affects actuals
  - inactive-account historical transaction still affects actuals

Suggested seeded scenarios:

- Category with spend and no budget
- Category with budget and no spend
- Category with spend below budget
- Category with spend above budget
- Category with refund reducing spend

## Dependencies

- `src/db/schema.ts`
- `src/server/trpc/routers/_app.ts`
- `src/server/trpc/routers/transactions.ts`
- `src/pages/transactions.tsx`
- `src/pages/dashboard.tsx`
- `docs/spec/budgets.md`

## Estimate

~3–5 working days, single developer:

- Phase 1: 1 day
- Phase 2: ½–1 day
- Phase 3: 1–2 days
- Phase 4: ½ day

If the query logic stays clean, the risk is mostly UI polish rather than backend uncertainty.
