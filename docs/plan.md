# FinWin Plan

## Thesis

FinWin should help users move from raw transaction noise to understandable financial actions, starting with budgeting clarity and only later expanding into investing simulation.

## Current Direction

- Next.js (Pages Router), Better Auth, Drizzle + Neon, tRPC v11, TanStack Query v5.
- Better Auth now supports email/password, GitHub, Google, passkey sign-in, and TOTP two-factor enrollment.
- Plaid integration is complete — accounts link, transactions sync with auto-categorization, connections managed via `/settings/connections`.
- All app data routes use tRPC. Plaid webhook stays as a plain REST route.
- Phase 3 (Dashboard analytics wired to real data) is the active milestone.
- Active hardening pass before real-bank rollout: stored Plaid access tokens now move to encrypted-only storage with a disposable-db reset path for rollout/testing.

## Milestone Status

| # | Milestone | Status |
|---|---|---|
| 1 | Auth, schema, and account-link foundations | ✅ Done |
| 2 | Real transaction import and normalization | ✅ Done — Plaid sync + auto-categorization via Plaid PFC map |
| 3 | Transactions page, category reassignment, budgets page, budget-vs-actual | ✅ Done — `/transactions` reassignment, `/budgets`, and dashboard budget progress verified on real synced data |
| 4 | Dashboard analytics wired to real data | 🔄 In progress (Phase 3) |
| 5 | AI insights | ⏳ Phase 5 |
| 6 | Portfolio / investing simulation | ⏳ Phase 6 |

## Phase 3 — Dashboard Analytics Wired To Real Data

Next tasks in order:

1. **Live verification pass** — sanity-check the new dashboard metrics against synced data, especially transfer exclusion, refunds, and inactive-account history.
2. **Keep financial math centralized** — continue reusing `budgets.summary` and shared transaction queries rather than duplicating dashboard calculations.
3. **Trim any remaining provisional copy** — keep portfolio and AI affordances out of the dashboard until those milestones exist behind real data.

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
- Build verification complete:
  - `bunx tsc --noEmit`
  - `bunx eslint src/pages/dashboard.tsx src/server/trpc/routers/dashboard.ts src/server/trpc/routers/_app.ts`

### Current spec reference

- Budgeting spec: `docs/spec/budgets.md`
- Budgeting implementation plan: `docs/plan/budgets.md`
- Dashboard analytics spec: `docs/spec/dashboard-analytics.md`
- Dashboard analytics implementation plan: `docs/plan/dashboard-analytics.md`
- Plaid token encryption spec: `docs/spec/plaid-token-encryption.md`

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
