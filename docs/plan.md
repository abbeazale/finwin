# FinWin Plan

## Thesis

FinWin should help users move from raw transaction noise to understandable financial actions, with budgeting clarity first and real-account plus paper-trading tools built on deterministic financial logic.

## Current Direction

- Next.js (Pages Router), Better Auth, Drizzle + Neon, tRPC v11, TanStack Query v5.
- Better Auth now supports email/password, GitHub, Google, passkey sign-in, and TOTP two-factor enrollment.
- Plaid integration is complete — accounts link, transactions sync with auto-categorization, connections managed via `/settings/connections`.
- All app data routes use tRPC. Plaid webhook stays as a plain REST route.
- Routing is Pages Router only. `/` serves a signed-out marketing page with live Finnhub quotes and routes signed-in users into onboarding or the dashboard.
- The paper-trading sandbox is shipped; current work is hardening the existing budgeting, investment, and sandbox surfaces.
- Improve audit findings 1–12 from `docs/ImproveAudit/2026-07-14-codebase-audit.md` are implemented on `improve-audit-batch-1` (auth upgrade, timezone validation, webhook body limits, safe migrate, characterization tests, dashboard currency scoping, ledger pagination, recent strong auth for destructive Plaid mutations, batched Plaid upserts, knip/lint baseline, landing ticker TTFB, and fresh-clone docs). Plaid Link creation and token exchange now require a valid session without the 15-minute freshness guard.
- Pilot-to-paid Batch 2B is implemented. Bank connections use `linked`, `syncing`, `ready`, and `sync_failed`; the first import outcome reaches the dashboard and Connections page, and failed imports can retry the saved connection without creating a duplicate Plaid item.
- Phase 6a implementation is complete through schema, Plaid import, read API/UI, and FX conversion; live Plaid investment-account verification remains.
- Active hardening pass before real-bank rollout: stored Plaid access tokens now move to encrypted-only storage with a disposable-db reset path for rollout/testing.

## Milestone Status

| # | Milestone | Status |
|---|---|---|
| 1 | Auth, schema, and account-link foundations | ✅ Done |
| 2 | Real transaction import and normalization | ✅ Done — Plaid sync + auto-categorization via Plaid PFC map |
| 3 | Transactions page, category reassignment, budgets page, budget-vs-actual | ✅ Done — `/transactions` reassignment, `/budgets`, and dashboard budget progress verified on real synced data |
| 4 | Dashboard analytics wired to real data | ✅ Core shipped — live verification follow-up remains |
| 5 | AI insights | ⏳ Phase 5 |
| 6 | Real investment accounts / portfolio | 🔄 Phase 6a implemented — live Plaid verification remains |
| 7 | Paper-trading sandbox | ✅ Done — deterministic multi-portfolio trading with live Finnhub quotes |

## Phase 6a — Real Investment Accounts

Next tasks in order:

1. **Live Plaid verification** — sync against sandbox/development investment data and confirm holdings replacement, transaction idempotency, inactive-account behavior, and FX exclusions.
2. **Provider data spot-check** — compare `/investments` totals, native currencies, and transaction cash impact against Plaid responses or DB rows.
3. **Production readiness cleanup** — wire the internal OER refresh route to deployment scheduling before production.

### Phase 6a implementation notes

- `bank_accounts.nickname` is nullable and user-owned; Plaid sync continues to own `bank_accounts.name`.
- Investment accounts continue to use `bank_accounts.type = "investment"`.
- `securities`, `investment_holdings`, `investment_transactions`, and `currency_rates` are represented in Drizzle schema and migration `drizzle/0005_vengeful_firelord.sql`.
- Holdings are current snapshots unique by `(account_id, security_id)`, not an append-only ledger.
- Investment transactions store Plaid's raw `plaid_amount`; user-facing cash impact is derived later as `-plaid_amount`.
- User foreign keys use Better Auth's current `text` user IDs.
- New Plaid Link tokens request both `transactions` and `investments`; update-mode Link remains access-token based.
- Investment holdings sync replaces current snapshots per account and removes closed positions.
- Investment transaction sync uses a 730-day first-sync window, 7-day overlap on later syncs, and Plaid pagination.
- `/investments` renders protected live account, holding, and investment transaction data.
- OER-backed FX conversion is server-side. `POST /api/internal/fx/refresh` refreshes cached USD-base rates; production requires `FX_REFRESH_SECRET`.
- Missing price or missing market-value FX excludes holdings from USD market-value totals; missing cost-basis FX suppresses gain/loss without suppressing market value.
- Holding valuation prefers a positive Plaid institution holding price, then falls back to the security close price. Fallback/missing price states are surfaced on `/investments`.

## Phase 3 — Dashboard Analytics Wired To Real Data

Next tasks in order:

1. **Live verification pass** — sanity-check the new dashboard metrics against synced data, especially transfer exclusion, refunds, and inactive-account history.
2. **Keep financial math centralized** — continue reusing `budgets.summary` and shared transaction queries rather than duplicating dashboard calculations.
3. **Keep provisional surfaces out** — AI and unsupported forecasting readouts stay deferred until backed by real implementation.

### Phase 2 completion notes

- `/transactions` page now exists in `src/pages/transactions.tsx`.
- Ledger view now includes inline category reassignment via `transactions.setCategory`.
- Ledger view includes account/date/category/pending filters, inactive-account toggle, pending badge, and uncategorized nudge.
- Server data comes from `transactions.list` in `src/server/trpc/routers/transactions.ts`.
- `budgets.summary`, `budgets.upsertMonthlyBudget`, and `budgets.deleteMonthlyBudget` now exist in `src/server/trpc/routers/budgets.ts`.
- `/budgets` now exists in `src/pages/budgets.tsx`, using shadcn UI composition plus Recharts via the shadcn `chart` component.
- Dashboard Budget Progress now reads from live `budgets.summary` data instead of hardcoded rows.
- Manual verification is complete for create/edit/delete budgets, unbudgeted rows, pending handling, and inactive-account historical spend.

### Phase 3 implementation notes

- Added `dashboardRouter` in `src/server/trpc/routers/dashboard.ts` with:
  - `dashboard.overview`
  - `dashboard.cashflow`
  - `dashboard.spendingByCategory`
  - `dashboard.recentTransactions`
- `/dashboard` now reads live transaction-backed data for:
  - overview KPI strip
  - daily cashflow chart
  - recent ledger card
  - spending-by-category panel
- Dashboard KPI strip remains intentionally limited to 3 cards:
  - inflow
  - outflow
  - net cashflow
- `Savings rate` remains available as a derived metric for secondary copy, not a primary card.
- Watchlist and rotating AI insight placeholders were removed from the dashboard.
- Shared domain constants now live in:
  - `src/server/lib/category-taxonomy.ts` for category/group names and seed taxonomy
  - `src/lib/budget-status.ts` for budget status labels
- Onboarding profile completion now uses `onboarding.complete` tRPC instead of a separate REST API route.
- Build verification complete:
  - `bunx tsc --noEmit`
  - `bunx eslint src/pages/dashboard.tsx src/server/trpc/routers/dashboard.ts src/server/trpc/routers/_app.ts`

### Current spec reference

- Budgeting spec: `docs/spec/budgets.md`
- Budgeting implementation plan: `docs/plan/budgets.md`
- Dashboard analytics spec: `docs/spec/dashboard-analytics.md`
- Dashboard analytics implementation plan: `docs/plan/dashboard-analytics.md`
- Plaid token encryption spec: `docs/spec/plaid-token-encryption.md`
- Investment accounts overview: `docs/spec/investments-real-accounts.md`
- Investment accounts plan: `docs/plan/investments-real-accounts.md`
- Investment schema/accounts spec: `docs/spec/investments-schema-accounts.md`
- Investment schema/accounts plan: `docs/plan/investments-schema-accounts.md`
- Investment Plaid sync spec: `docs/spec/investments-plaid-sync.md`
- Investment Plaid sync plan: `docs/plan/investments-plaid-sync.md`
- Investment API/UI spec: `docs/spec/investments-api-ui.md`
- Investment API/UI plan: `docs/plan/investments-api-ui.md`
- Investment FX spec: `docs/spec/investments-fx-rates.md`
- Investment FX plan: `docs/plan/investments-fx-rates.md`

### Security hardening notes

- Auth MFA baseline is in place:
  - passkeys use Better Auth's `@better-auth/passkey` plugin
  - WebAuthn user verification is required so passkey sign-in can stand alone
  - TOTP two-factor is available as the second factor for password sign-in
  - `/settings/security` is the first enrollment surface
- Plaid token storage now targets encrypted-only DB columns:
  - `access_token_encrypted`
  - `access_token_key_version`
- Current rollout assumption is disposable data:
  - `bun run dbreset`
  - `bun run seed`
  - create a fresh account and reconnect Plaid
- This avoids preserving plaintext-token rows while the product is still in pre-rollout mode.

### Key design decisions (locked)
- Budget period: monthly, 1st of month. Custom start day → `docs/future.md`.
- Canonical transaction semantics are account-based: money in positive, money out negative. Provider amounts should be normalized on sync.
- Pending included in budget math. Posted/pending filter toggle → `docs/future.md`.
- Transfers: `defaultBudgetable=true`. Credit Card Payment: `defaultBudgetable=false`.
- Uncategorized: `defaultBudgetable=false`, excluded from budget math until reassigned.
- Inactive accounts hidden by default in tx page; "include inactive" toggle.
- Category reassignment does not persist merchant rules yet.
- The root marketing surface is live for signed-out users and uses Finnhub quotes with a static fallback ticker.
- Investment transaction semantics preserve Plaid raw cash amount as `plaid_amount`; display cash impact is derived as `-plaid_amount`.

## Success Signals

- Users can sign in, connect accounts, import transactions, and see budget vs actual on real data.
- Core financial views no longer depend on placeholders or demo-only assumptions.

## Deferred Items

See `docs/future.md` for the full list. Notable ones:
- Custom budget period start day (settings)
- Merchant-rule persistence on category reassignment
- Posted/pending filter toggle on transactions page
- Recurring-spend detection on dashboard
- Custom dashboard ranges beyond calendar-month view
