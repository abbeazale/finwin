## Ideal Implementation Design (v0.1)

This section keeps the project practical and lightweight. It is not heavy system design. It is the minimum implementation design needed so a solo builder can move quickly without creating a mess later.

---

# Build Philosophy

FinWin should be built as a series of small vertical slices.

Core rules:

- Keep financial calculations deterministic.
- Keep AI as an explanation layer, not a source of truth.
- Put Plaid setup at the foundation so the first real dashboard uses real data.
- Prefer simple server-side query logic over premature abstractions.
- Keep schema design stable before adding advanced features.
- Do not build investing features before transactions and budgets feel solid.
- Use default category seeds only, not seeded demo financial accounts or demo transactions.

Repo alignment rule:

- Use **Pages Router** (`src/pages/*`) for v0.1 in this repo.
- Do not plan App Router-only paths (`src/app/*`) unless you explicitly schedule a migration.

---

# Recommended Build Order

## Phase 0, Repo Baseline + Plaid Readiness

Goal: lock in conventions and real-data plumbing before product code starts.

Build:

1. Confirm Pages Router baseline (`src/pages/*`)
2. Add typed env validation (`src/lib/env.ts`)
3. Add db-level uniqueness/index constraints for idempotent Plaid sync paths
4. Add minimal CI checks (typecheck, lint, build)
5. Add Plaid env vars and validation
6. Add a thin Plaid client wrapper in `src/lib/plaid/*`
7. Finalize schema shape for `bank_connections`, `bank_accounts`, and `transactions` around Plaid data contracts
8. Decide encrypted storage strategy for Plaid-sensitive tokens and metadata
9. Scaffold `plaidRouter` with the first core procedures

Definition of done:

- Team can run one command to validate the app (`lint` + `build`)
- Env and secret handling are explicit and validated
- Data model constraints prevent obvious duplicate financial records
- Plaid configuration is wired and type-safe
- The codebase is ready for a real-data import path immediately in Phase 1

## Phase 1, Foundation + First Real Data Import

Goal: get the app running with auth, database, Plaid link flow, and the first imported transactions.

Build:

1. Next.js app structure
2. better-auth authentication
3. Neon database connection
4. Drizzle schema files
5. First migration
6. Seed script for default categories only
7. Plaid Link token creation
8. Public token exchange
9. Store bank connection and account metadata locally
10. First transactions import into the local ledger
11. Normalize imported transaction data into your app’s typed transaction shape

Definition of done:

- A user can sign in
- Database tables exist
- Default categories are seeded
- A user can link a sandbox or real bank account
- Imported accounts and transactions are stored locally
- Dashboard and transaction queries can read from real imported data

---

## Phase 2, Transactions + Budgeting Core

Goal: make the first real financial product loop work on imported data.

Build:

1. Transactions page
2. Category assignment flow
3. Budgets page
4. Monthly spending queries
5. Budget vs actual queries
6. Handling for uncategorized imported transactions
7. Pending vs posted transaction treatment rules
8. Account-aware transaction filtering

Definition of done:

- User can view imported transactions
- Transactions can be categorized
- User can create monthly budgets by category
- User can see actual spending against each budget
- Transaction views handle real imported account and status data correctly

---

## Phase 3, Dashboard Analytics

Goal: create a useful financial dashboard powered entirely by deterministic backend logic using real imported transaction data.

Build:

1. Monthly overview cards
2. Spending by category chart
3. Income vs expenses chart
4. Savings rate calculation
5. Recurring spending or subscription detection
6. Transaction normalization rules for dashboard-safe aggregation
7. Clear rules for how to treat pending items, transfers, refunds, and partial-history users

Definition of done:

- Dashboard shows real aggregated values from the database
- Charts are backed by typed queries
- No dashboard metric depends on AI to exist
- Imported Plaid data is normalized consistently enough that monthly numbers are trustworthy

---

## Phase 4, Plaid Hardening + Sync Reliability

Goal: make the Plaid integration production-safe after the first real-data loop works.

Build:

1. Incremental sync with cursor support
2. Re-sync and refresh flows
3. Revoked or broken connection handling
4. Duplicate prevention and idempotent retry validation
5. Better sync error states in the UI
6. Optional background sync later if it becomes necessary

Definition of done:

- User can re-sync without duplicate transactions
- Sync is idempotent
- Connection problems are visible and recoverable
- The local ledger remains consistent across repeated imports and updates

---

## Phase 5, AI Insights

Goal: add useful explanations after the deterministic system is trustworthy.

Build:

1. Insight prompt input model
2. Structured summary payload from backend
3. AI-generated insight cards or summaries
4. Optional explanation history table later if needed

Definition of done:

- AI explains actual backend-calculated metrics
- AI does not invent balances, spending totals, or investment performance

---

## Phase 6, Simulated Investing

Goal: add the second major product surface after the budgeting system is stable, starting virtual-first.

Build:

1. Portfolio tables
2. Manual virtual cash contribution flow
3. Buy and sell flow
4. Position tracking
5. Portfolio value charts
6. Optional phase 6.5: bank-informed contribution suggestions derived from deterministic cashflow surplus

Definition of done:

- User can simulate investing with virtual money
- Trades affect positions and value consistently
- Portfolio logic is isolated from budgeting logic
- No real-money movement or brokerage execution in v0.1 investing

---

# Suggested Initial App Structure

```txt
src/
  pages/
    _app.tsx
    _document.tsx
    index.tsx
    dashboard.tsx
    transactions.tsx
    budgets.tsx
    settings.tsx
    api/
      trpc/[trpc].ts

  components/
    ui/
    dashboard/
    transactions/
    budgets/
    shared/

  features/
    transactions/
    budgets/
    dashboard/
    shared/

  server/
    db/
      index.ts
      schema/
        users.ts
        categories.ts
        banking.ts
        budgets.ts
      seed/
        default-categories.ts
    trpc/
      root.ts
      routers/
        transactions.ts
        budgets.ts
        dashboard.ts
        plaid.ts
        ai.ts

  lib/
    auth/
    plaid/
    ai/
    utils/
    constants/

  types/
```

Notes:

- Keep Drizzle schema files grouped by domain, not one giant schema file.
- Keep tRPC routers grouped by business feature.
- Keep feature-specific UI in `features/*/components` and shared primitives in `components/*`.
- Keep third-party SDK wrappers inside `lib/`.

---

# Recommended First Routes

Start with only the routes needed for the first vertical slice.

## Public

- `/`
- `/sign-in`
- `/sign-up`

## Private app

- `/dashboard`
- `/transactions`
- `/budgets`
- `/settings`

Reasoning:

- `/transactions` proves the ledger works
- `/budgets` proves the budget system works
- `/dashboard` proves aggregation works
- `/settings` is where Plaid connection management should live early

Pages Router file mapping:

- `src/pages/dashboard.tsx` -> `/dashboard`
- `src/pages/transactions.tsx` -> `/transactions`
- `src/pages/budgets.tsx` -> `/budgets`
- `src/pages/settings.tsx` -> `/settings`
- `src/pages/api/trpc/[trpc].ts` -> `/api/trpc/*`

---

# Recommended First tRPC Routers

Create only the routers needed to support the first product loop.

## `transactionsRouter`

Suggested procedures:

- `listByMonth`
- `getById`
- `updateCategory`
- `updateNotes`

## `budgetsRouter`

Suggested procedures:

- `listByMonth`
- `upsertMonthlyBudget`
- `deleteBudget`
- `getBudgetVsActual`

## `dashboardRouter`

Suggested procedures:

- `getMonthlyOverview`
- `getSpendingByCategory`
- `getCashflow`
- `getSavingsRate`
- `getRecentTransactions`

## `plaidRouter`

Suggested procedures:

- `createLinkToken`
- `exchangePublicToken`
- `syncTransactions`
- `listConnections`
- `disconnectConnection`

## `aiRouter`

Suggested procedures:

- `getMonthlyInsights`

---

# First Deterministic Queries to Implement

These should exist before any AI work starts.

## 1. Monthly overview

Return:

- total income
- total expenses
- net cashflow
- savings rate

## 2. Spending by category

Return:

- category id
- category name
- group name
- total spent for selected month

## 3. Budget vs actual

Return:

- category id
- category name
- budget amount
- spent so far
- remaining amount
- percent used

## 4. Recent transactions list

Return:

- transaction basics for UI display
- category metadata
- account metadata
- pending or posted status

These queries form the backbone of the dashboard and budgeting experience.

---

# Data Strategy

Use real imported Plaid data as the main path from the start.

Seed only:

- category groups
- categories

Do not seed:

- demo user financial records
- demo bank accounts
- demo transactions
- demo budgets
- demo income events

Use local imported data as the single source for:

- transactions
- dashboard calculations
- budget comparisons
- future insight generation inputs

This makes the first working product loop reflect real provider data contracts and real application typing.

---

# Guardrails for v0.1

To avoid scope creep, keep these boundaries:

- No microservices
- No background workers yet unless Plaid sync truly needs it
- No advanced investing engine in v0.1
- No tax lot logic yet
- No stock price ingestion pipeline yet
- No user-created category hierarchy yet
- No AI-generated financial math
- No App Router migration during v0.1 delivery
- No real-money investing execution in v0.1

---

# What Success Looks Like for v0.1

A successful v0.1 means:

- a signed-in user can connect a bank account
- imported transactions populate the local ledger
- the user can categorize imported transactions
- the user can create budgets
- the user can see budget vs actual on real data
- the dashboard shows monthly financial summaries from real imported data
- AI can explain the numbers without being responsible for calculating them

That is enough to prove the core product direction before expanding into simulated investing in a serious way.
