# Budgets — Spec

## Goal

Let a signed-in FinWin user set monthly spending targets by category and compare those targets against real imported transaction activity. This is the first budgeting surface built on top of the synced ledger and should stay fully deterministic.

## Scope

**In scope**
- A `/budgets` page for the selected month.
- One monthly budget per `user + category + month`.
- Budget-vs-actual summary powered by imported transactions.
- Inline create, edit, and delete of category budgets.
- Real-time status for each category: on track, near limit, over budget, or unbudgeted.
- Monthly rollup values: total budgeted, total spent, total remaining, over-budget count.
- Historical transaction data from inactive accounts included in budget actuals.

**Out of scope for this milestone**
- Custom budget periods or non-monthly budgets.
- Rollover logic.
- Per-account budgets.
- Savings goals.
- Forecasting or projected month-end spend.
- AI-generated budget suggestions.
- Merchant rules or automatic budget creation from user behavior.

## Product Definition

Budgets answer one question:

"For this month, what did I plan to spend, what have I actually spent, and how am I tracking?"

The budgets system is category-based, not account-based. A budget is attached to a category for a calendar month. Actual spend is always calculated from transactions and is never stored on the budget row.

## Domain Rules

### Budget period

- Budgets are monthly.
- `budgets.month` is always the first day of the month, e.g. `2026-04-01`.
- Queries use an inclusive month start and exclusive next-month boundary.

### Which categories are budgetable

- Only categories with `categories.default_budgetable = true` are valid budget targets.
- Categories with `defaultBudgetable = false` are excluded from the main budget grid.
- This specifically keeps `Uncategorized` and `Credit Card Payment` out of budget setup and budget math.

### Which transactions count toward actuals

- Only transactions with a non-null `categoryId` count toward budget actuals.
- Only transactions whose category is budgetable count toward budget actuals.
- Pending transactions count toward actuals.
- Transactions from inactive accounts still count if they fall in the selected month.
- Actuals are user-scoped across all linked and historical accounts.

### Amount semantics

- FinWin canonical transaction semantics are account-based:
  - positive = money in / refund / income
  - negative = money out / expense
- Plaid provider amounts may use the opposite sign convention.
- The sync layer is responsible for normalizing provider amounts into FinWin semantics before budgeting logic relies on them.
- Budget actuals use net category spend for the month.
- Refunds reduce spend inside the same category.
- Actual spend shown in the UI is floored at `0.00` so a category never appears to have "negative spending."

Examples:
- Groceries `-100`, refund `+20` => actual spend `80`
- Shopping `-20`, refund `+35` => actual spend `0`

### Categories without a budget

- A category can have actual spend without a budget row.
- These rows should still appear in the summary as `unbudgeted`.
- Categories with neither a budget nor any actual spend may be hidden by default in the UI if the page needs density control, but the backend summary should still be capable of returning all budgetable categories.

## Existing Data Model

The current schema already supports the first budgets milestone.

Relevant tables:
- `categories`
  - `id`
  - `groupId`
  - `name`
  - `defaultBudgetable`
- `transactions`
  - `userId`
  - `date`
  - `amount`
  - `pending`
  - `categoryId`
  - `accountId`
- `budgets`
  - `userId`
  - `categoryId`
  - `month`
  - `amount`

Relevant constraints already present:
- `budgets_user_category_month_unique`

## API Surface

Add a `budgetsRouter` to tRPC.

### `budgets.summary`

**Input**
- `month: string` in `YYYY-MM-DD`
- must be normalized to first-of-month by server validation, or rejected

**Output**
- `month`
- `totals`
  - `totalBudgeted`
  - `totalActual`
  - `totalRemaining`
  - `overBudgetCount`
  - `unbudgetedCount`
- `groups`
  - category group name
  - array of category rows

Each category row should include:
- `categoryId`
- `categoryName`
- `categoryGroupName`
- `budgetAmount: string | null`
- `actualAmount: string`
- `remainingAmount: string | null`
- `percentUsed: number | null`
- `status: "on_track" | "near_limit" | "over" | "unbudgeted" | "no_budget"`

Status rules:
- `over`: budget exists and `actualAmount > budgetAmount`
- `near_limit`: budget exists and `actualAmount / budgetAmount >= 0.85` and not over
- `on_track`: budget exists and below near-limit threshold
- `unbudgeted`: no budget and `actualAmount > 0`
- `no_budget`: no budget and no spend

### `budgets.upsertMonthlyBudget`

**Input**
- `categoryId: string`
- `month: string`
- `amount: string` or numeric input normalized to two decimals

**Validation**
- category must exist
- category must be budgetable
- category row belongs to no specific user, but write remains user-scoped through `budgets.userId`
- amount must be `>= 0`

**Behavior**
- insert if missing
- update if existing

### `budgets.deleteMonthlyBudget`

**Input**
- `categoryId: string`
- `month: string`

**Behavior**
- delete the single matching row for the signed-in user

## Query Semantics

### Month boundaries

Given `month = 2026-04-01`:
- include transactions where `date >= 2026-04-01`
- include transactions where `date < 2026-05-01`

### Actual spend aggregation

Aggregate transactions by `categoryId` for the selected month.

Conditions:
- `transactions.user_id = ctx.userId`
- `transactions.category_id IS NOT NULL`
- joined category has `default_budgetable = true`
- month date range applies

Computation:
- `rawActual = sum(transactions.amount)`
- `actualSpend = max(-rawActual, 0)`

### Summary row source of truth

The summary should start from budgetable categories, then left join:
- monthly budget row for selected month
- aggregated actual spend for selected month
- category group metadata

This ensures:
- categories with budgets but no spend still appear
- categories with spend but no budgets still appear
- ordering remains stable by category group and category sort order

Interpretation notes:
- Negative monthly category totals represent net spend.
- Positive monthly category totals represent net inflow or net refund.
- The budget surface converts that monthly total into a spend number via `max(-rawActual, 0)`.

## UI Surface

First page: `src/pages/budgets.tsx`

### Core layout

- Month switcher
- Header summary strip
- Budget groups by category group
- Category rows with inline budget editing

### Category row fields

- category name
- budget amount input
- actual spend
- remaining
- percent used
- progress bar or status marker

### Interaction model

- User can type a monthly amount and save inline.
- Emptying a saved budget and confirming removal deletes that budget row.
- Query invalidation should refresh both category rows and summary totals.
- Errors should be local and readable.

### First-pass display rules

- Show budgetable categories grouped by category group.
- Highlight `unbudgeted` rows when actual spend exists but no budget is set.
- Highlight `over` rows clearly.
- If a category has no budget and no spend, it can render in a quieter visual state.

## Dashboard Reuse

The dashboard Budget Progress section should reuse `budgets.summary` rather than introduce separate budget math. The page and dashboard can format the same data differently, but the financial calculation must come from one backend query path.

## Edge Cases

- User has transactions but no budgets yet:
  - page should still render and show unbudgeted spend
- User has budgets but no transactions this month:
  - actuals show zero
- Refund-heavy month:
  - actual floor remains zero
- Inactive account history:
  - still counted if transaction falls in selected month
- Uncategorized transactions:
  - excluded entirely from budget actuals
- Invalid month input:
  - reject at the API layer

## Implementation Order

1. Add `budgetsRouter` and register it in `src/server/trpc/routers/_app.ts`
2. Implement `budgets.summary`
3. Implement `budgets.upsertMonthlyBudget`
4. Implement `budgets.deleteMonthlyBudget`
5. Build `src/pages/budgets.tsx`
6. Wire the dashboard Budget Progress section to `budgets.summary`

## Definition Of Done

- A signed-in user can open `/budgets`
- The page shows budgetable categories for a selected month
- The user can create, edit, and delete monthly budgets inline
- Actual spend is computed from real imported transactions
- Pending transactions are included
- Uncategorized and non-budgetable categories are excluded from budget math
- Over-budget and unbudgeted states are visible without AI assistance
