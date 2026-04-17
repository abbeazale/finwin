# FinWin Plan

## Thesis

FinWin should help users move from raw transaction noise to understandable financial actions, starting with budgeting clarity and only later expanding into investing simulation.

## Current Direction

- Next.js (Pages Router), Better Auth, Drizzle + Neon, tRPC v11, TanStack Query v5.
- Plaid integration is complete — accounts link, transactions sync with auto-categorization, connections managed via `/settings/connections`.
- All app data routes use tRPC. Plaid webhook stays as a plain REST route.
- Phase 3 (Dashboard analytics wired to real data) is the active milestone.

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

1. **Replace dashboard placeholders** — wire the KPI strip, cashflow panel, and recent ledger card to real transaction-backed queries instead of static demo values.
2. **Keep financial math centralized** — continue reusing `budgets.summary` and shared transaction queries rather than duplicating dashboard calculations.
3. **Trim provisional surfaces** — keep watchlist / simulator affordances clearly secondary until the portfolio milestone exists behind real data.

### Phase 2 completion notes

- `/transactions` page now exists in `src/pages/transactions.tsx`.
- Ledger view now includes inline category reassignment via `transactions.setCategory`.
- Ledger view includes account/date/category/pending filters, inactive-account toggle, pending badge, and uncategorized nudge.
- Server data comes from `transactions.list` in `src/server/trpc/routers/transactions.ts`.
- `budgets.summary`, `budgets.upsertMonthlyBudget`, and `budgets.deleteMonthlyBudget` now exist in `src/server/trpc/routers/budgets.ts`.
- `/budgets` now exists in `src/pages/budgets.tsx`, using shadcn UI composition plus Recharts via the shadcn `chart` component.
- Dashboard Budget Progress now reads from live `budgets.summary` data instead of hardcoded rows.
- Manual verification is complete for create/edit/delete budgets, unbudgeted rows, pending handling, and inactive-account historical spend.

### Current spec reference

- Budgeting spec: `docs/spec/budgets.md`
- Budgeting implementation plan: `docs/plan/budgets.md`

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
