# FinWin Plan

## Thesis

FinWin should help users move from raw transaction noise to understandable financial actions, starting with budgeting clarity and only later expanding into investing simulation.

## Current Direction

- Next.js (Pages Router), Better Auth, Drizzle + Neon, tRPC v11, TanStack Query v5.
- Plaid integration is complete — accounts link, transactions sync with auto-categorization, connections managed via `/settings/connections`.
- All app data routes use tRPC. Plaid webhook stays as a plain REST route.
- Phase 2 (Transactions + Budgeting Core) is the active milestone.

## Milestone Status

| # | Milestone | Status |
|---|---|---|
| 1 | Auth, schema, and account-link foundations | ✅ Done |
| 2 | Real transaction import and normalization | ✅ Done — Plaid sync + auto-categorization via Plaid PFC map |
| 3 | Transactions page, category reassignment, budgets page, budget-vs-actual | 🔄 In progress (Phase 2) |
| 4 | Dashboard analytics wired to real data | ⏳ Phase 3 — after Phase 2 |
| 5 | AI insights | ⏳ Phase 5 |
| 6 | Portfolio / investing simulation | ⏳ Phase 6 |

## Phase 2 — Transactions + Budgeting Core

Next tasks in order:

1. **`/transactions` page** — list imported transactions with account, date, category, pending filters. Pending badge on unposted rows. Nudge when uncategorized count > 0.
2. **Category reassignment** — inline or modal, `transactions.setCategory` tRPC mutation. One-at-a-time for now (merchant-rule persistence deferred).
3. **`/budgets` page** — create/edit monthly budget per category. Only `defaultBudgetable=true` categories appear as budget targets.
4. **Budget-vs-actual query** — `budgets.summary` tRPC query: budget + spent (pending + posted) + remaining per category for a given month.
5. **Wire dashboard Budget Progress** — replace hardcoded `budgetRows` with `budgets.summary` data.

### Key design decisions (locked)
- Budget period: monthly, 1st of month. Custom start day → `docs/future.md`.
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
