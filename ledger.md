# FinWin Ledger

## 2026-04-16

### Phase 3 implementation pass shipped

- Added `src/server/trpc/routers/dashboard.ts` and wired it into `_app.ts`.
- New dashboard queries shipped:
  - `dashboard.overview`
  - `dashboard.cashflow`
  - `dashboard.spendingByCategory`
  - `dashboard.recentTransactions`
- Replaced remaining `/dashboard` placeholders with live data:
  - KPI strip now reads real inflow / outflow / net cashflow
  - cashflow panel uses real daily month data
  - recent ledger card uses real transactions
  - watchlist replaced with real spending-by-category pressure
  - rotating AI insight card replaced with deterministic summary copy
- Kept the overview strip at 3 cards by product decision; `savingsRate` stays derived but secondary.
- Dashboard month switching is now real calendar-month navigation instead of the fake `W / M / Q / YTD` picker.
- Build verification complete:
  - `bunx tsc --noEmit`
  - `bunx eslint src/pages/dashboard.tsx src/server/trpc/routers/dashboard.ts src/server/trpc/routers/_app.ts`
- **Next**: do the live-data verification pass against synced transactions, focusing on transfer exclusion, refund treatment, and inactive-account month totals.

### Phase 2 complete — budgets verified

- Closed the budgets polish loop after branch review:
  - removed the `AddCategorySection` lint blocker
  - aligned budget detail queries with inactive-account history
  - fixed "Top spends this month" to use server-side amount ordering instead of a newest-rows slice
- Manually verified the first budgets milestone against synced data:
  - create / edit / delete monthly budgets
  - unbudgeted rows
  - pending handling
  - inactive-account historical spend
- Phase 2 is now complete: `/transactions` category reassignment, `/budgets`, and dashboard budget progress all work against the same live transaction and budget data model.
- **Next**: move to Phase 3 and replace the remaining placeholder dashboard analytics with real transaction-backed queries.

### Phase 3 spec drafted — dashboard analytics

- Drafted `docs/spec/dashboard-analytics.md` and `docs/plan/dashboard-analytics.md` as the Phase 3 source of truth.
- Locked the first dashboard analytics milestone to a real month-scoped surface:
  - live overview cards
  - live cashflow chart
  - live recent ledger
  - live spending-by-category panel
  - continued `budgets.summary` reuse for Budget Progress
- Locked metric rules before implementation:
  - canonical transaction signs only, no provider-side reinversion
  - pending included
  - inactive-account history included
  - `Transfer` and `Credit Card Payment` excluded from overview/cashflow to avoid internal-movement distortion
  - refunds reduce category spend through net category totals
- Follow-up product decision: keep the dashboard KPI strip at 3 cards (`Inflow`, `Outflow`, `Net cashflow`). `Savings rate` stays as a derived metric in the query contract, but not as a primary card in Phase 3.
- Explicitly deferred recurring-spend detection, custom date ranges, AI insight copy, and watchlist / portfolio dashboard surfaces until later phases.

### Phase 2 — budgets first pass wired

- Added `src/server/trpc/routers/budgets.ts` with `budgets.summary`, `budgets.upsertMonthlyBudget`, and `budgets.deleteMonthlyBudget`.
- Wired the router into `src/server/trpc/routers/_app.ts`.
- Added `/budgets` in `src/pages/budgets.tsx` as the first budgeting desk: month switching, grouped category rows, inline monthly target editing, and a supporting Recharts bar chart through the shadcn `chart` component.
- Dashboard Budget Progress in `src/pages/dashboard.tsx` now reads from live `budgets.summary` data instead of hardcoded placeholder rows.
- Added shadcn UI pieces for the budgeting surface: `chart`, `badge`, `progress`, `skeleton`.
- Fixed the disposable Neon reset path while doing the sign-convention work: `scripts/db-reset.ts` now drops the `drizzle` schema too, so `bun run dbreset` actually reapplies migrations before `bun run seed`.
- Verified clean: `bunx tsc --noEmit` and `bunx eslint src/server/trpc/routers/budgets.ts src/server/trpc/routers/_app.ts src/pages/budgets.tsx src/pages/dashboard.tsx` both pass.

### Canonical transaction semantics locked

- FinWin now treats `transactions.amount` as canonical account movement: positive = money in, negative = money out.
- Plaid provider amounts must be normalized on sync before persistence; the inversion belongs in `src/server/plaid/sync.ts`, not in downstream query math.
- This keeps budgets, cashflow, balances, and future holdings work on one coherent sign convention while the DB is still disposable.
- **Next**: refresh disposable transaction data after the sync normalization change, then build `/budgets` against the canonical storage rule.

### Phase 2 — transactions page read-only pass shipped

- Added `/transactions` in `src/pages/transactions.tsx` as the first production ledger surface: user-scoped transaction list, newest-first, limited to 100 rows for now.
- Added `transactions.list` tRPC query in `src/server/trpc/routers/transactions.ts` and wired it in `_app.ts`.
- Filters shipped in this pass: account, category, pending status, date-from, date-to, plus "include inactive accounts".
- Pending badge shipped on transaction rows. Inactive accounts remain hidden by default and can be included explicitly.
- Uncategorized nudge shipped on page load with count of visible uncategorized transactions; CTA focuses the list on uncategorized rows.
- Dashboard now links into `/transactions` from the Ledger nav item and recent-ledger card.
- Verified clean: `bunx tsc --noEmit` and `bunx eslint src/pages/transactions.tsx src/server/trpc/routers/transactions.ts src/server/trpc/routers/_app.ts src/pages/dashboard.tsx` both pass.
- **Next**: `transactions.setCategory` mutation + minimal per-row reassignment UI, then move to `/budgets`.

### Phase 2 kickoff — decisions locked + tRPC migration shipped

**Decisions locked (transactions + budgeting core):**
- Category taxonomy: 6 groups, 18 categories (Income, Essentials, Lifestyle, Financial, Transfers, Other). Curated list mapped from Plaid's `personal_finance_category` via a TS const in `src/server/trpc/category-map.ts`.
- Auto-categorize on sync using `detailed` → category name, fallback to `primary` → category name, fallback to "Uncategorized". User-assigned categories survive re-syncs (excluded from `onConflictDoUpdate`).
- Transfers: `defaultBudgetable=true` (external spend counts). Credit Card Payment category is `defaultBudgetable=false` to avoid double-counting when CC is also linked.
- Pending transactions included in budget math. Pending badge shown in tx list.
- Budgets are monthly, start 1st of month. Custom period start deferred → `docs/future.md`.
- Uncategorized: `defaultBudgetable=false`, nudge shown in tx page when any exist.
- Inactive accounts (post-unlink): hidden by default in tx page, "include inactive" toggle.
- tRPC for all app data routes. Plaid webhook stays REST (raw body required for signature check).
- Dashboard Budget Progress section wired to real data in Phase 2 once `budgets.summary` exists.
- Pages Router for all new product pages (`src/pages/`).

**tRPC migration (complete, build passing):**
- Installed: `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `zod`.
- New infrastructure: `src/server/trpc/trpc.ts` (router + protectedProcedure), `src/server/trpc/context.ts` (better-auth session), `src/server/trpc/routers/_app.ts` + `routers/plaid.ts`, `src/pages/api/trpc/[trpc].ts`, `src/lib/trpc.ts` (React client + TRPCProvider).
- Migrated procedures: `plaid.createLinkToken`, `plaid.exchangeToken`, `plaid.syncTransactions`, `plaid.listConnections`, `plaid.unlinkConnection`, `plaid.reactivateConnection`.
- Deleted old REST routes: `link-token.ts`, `exchange.ts`, `sync.ts`, `connections/[id].ts`. Webhook untouched.
- Components updated: `connect-bank.tsx`, `refresh-transactions.tsx` now use tRPC mutations.
- `settings/connections.tsx` moved from GSSP → `trpc.plaid.listConnections.useQuery()` + client-side auth guard via `useSession`.
- `_app.tsx` wrapped with `<TRPCProvider>`.

**Category seeding:**
- `scripts/seed-categories.ts` — idempotent, run with `bun run seed`.
- `src/server/trpc/category-map.ts` — full `PLAID_CATEGORY_MAP` (detailed) + `PLAID_PRIMARY_FALLBACK_MAP` (primary fallback).
- `src/server/plaid/sync.ts` updated: loads category map on each sync, assigns `categoryId` on INSERT, excluded from conflict updates.
- **Action required**: run `bun run seed` against the live Neon DB to populate `category_groups` + `categories` before any sync will produce categorized transactions.

**Next**: transactions page (`/transactions`) — list with account/date/category/pending filters + category reassignment flow.

## 2026-04-15

- **Phase 5** done: schema trim + neon-serverless swap + unlink rework.
  - Swapped `src/index.ts` and `scripts/db-reset.ts` from `drizzle-orm/neon-http` → `drizzle-orm/neon-serverless` (Pool on WebSocket). Node 25 has global `WebSocket`, no `ws` polyfill needed.
  - Schema trim: dropped `transactions.category_confidence` and `transactions.notes` (never populated, never read). Kept `authorized_date` + `merchant_name` — populated by sync and load-bearing for the upcoming transactions list.
  - `bank_accounts.connection_id` now nullable; FK flipped from `ON DELETE CASCADE` → `ON DELETE SET NULL`. Migration `drizzle/0001_silent_payback.sql`.
  - Unlink rework (delete-pipe-keep-data): `DELETE /api/plaid/connections/:id` now runs `itemRemove`, then a single tx that nulls `bank_accounts.connection_id` + flips `is_active=false` for the affected accounts, then hard-deletes the `bank_connections` row. Soft-revoke / `status="revoked"` removed everywhere (UI pill, list filter, button disabled check).
  - Multi-statement writes wrapped in `db.transaction(...)`: exchange (connection + accounts insert) and sync (upsert + remove + cursor advance). Orphan-row failure mode is gone.
- Cleanup touching the last 4 commits:
  - `src/app/layout.tsx`: fonts (`Sora`, `DM_Sans`) were declared but never applied — landing page silently fell back. Wired both `--font-finwin-heading` and `--font-finwin-body` on `<body>` per `migration.md` §1.
  - `src/server/plaid/sync.ts`: replaced `while (true) { … break }` + stale `eslint-disable` with an explicit `hasMore` loop.
- Verified clean: `bunx tsc --noEmit` and `bunx eslint src` both pass with zero errors/warnings.
- **Next**: apply `drizzle/0001_silent_payback.sql` (either `bunx drizzle-kit migrate` against the live Neon DB, or `bun run dbreset` if sandbox data is disposable), then re-run the sandbox smoke test — connect → sync → unlink — and confirm a reconnect of the same bank spawns *new* active `bank_accounts` rows while the old ones stay as inactive history.

## 2026-04-14 (later)

- Drafted Plaid integration spec + phased plan in `docs/spec/plaid-integration.md` and `docs/plan/plaid-integration.md`; cross-checked against Plaid API docs (corrected cursor param name, webhook JWT verification flow, sign convention).
- **Phase 0** done: env vars (`PLAID_ENV`, `PLAID_WEBHOOK_URL`), `.env.example`, installed `plaid` + `react-plaid-link`, created `src/server/plaid/client.ts` singleton.
- **Phase 1** done + verified: `POST /api/plaid/link-token`, `POST /api/plaid/exchange`, `ConnectBank` component in dashboard header. End-to-end sandbox connect confirmed — `bank_connections` + `bank_accounts` rows written correctly.
- **Phase 2** done + verified: `src/server/plaid/sync.ts` (`syncConnection` + `syncUserConnections`), `POST /api/plaid/sync` (manual trigger, per-connection or all), `RefreshTransactions` dashboard button. Initial hydration runs at tail of `/exchange`. Cursor-based sync: upsert on `providerTransactionId`, delete on `removed`, advance `lastCursor`. Sandbox sync populates `transactions` rows correctly.
- **Phase 4** done + verified: `/settings/connections` page listing user's live connections (account names/masks/types, status, last-sync, last-tx date). `DELETE /api/plaid/connections/:id` calls `/item/remove` + soft-revokes. `PATCH` flips status back to active after Link update-mode reconnect. `link-token` route extended to run update mode when `connectionId` is present. `ConnectBank` component dual-mode (initial link vs reconnect). Settings sidebar nav item now links to the page. Revoked connections filtered out of the list.
- **Phase 5 scope expanded**: in addition to schema trim + neon-serverless swap, rework unlink to the "delete pipe, keep data" model — nullable `bank_accounts.connection_id`, drop cascade, flip `is_active=false` on unlink. Soft-revoke is the current-day hack; clean model deferred to avoid mid-implementation migration.
- **Phase 3** done + verified: `POST /api/plaid/webhook` with ES256 JWT verification via `src/server/plaid/webhook-verify.ts` (JWK cached by `kid`, `iat` freshness, `request_body_sha256` body check on raw body; body parser disabled on route). Routes `TRANSACTIONS` sync codes → `syncConnection`; `ITEM` codes flip `bankConnections.status`. Installed `jose`. Local delivery via ngrok → `PLAID_WEBHOOK_URL` passed to `/link/token/create`. End-to-end: sandbox reconnect triggered `exchange` + two webhook 200s as expected.
- **TODO for Phase 5**: switch `drizzle-orm/neon-http` → `drizzle-orm/neon-serverless` (WebSocket pool) so multi-statement DB transactions work; current exchange + sync paths can leave orphan rows on partial failure.

## 2026-04-14

- Killed the old DB and rebuilt the schema from scratch with a clean single migration (`drizzle/0000_lean_forge.sql`).
- Expanded `src/db/schema.ts` with 6 financial tables: `category_groups`, `categories`, `bank_connections`, `bank_accounts`, `transactions`, `budgets`.
- Auth tables (`user`, `session`, `account`, `verification`) remain untouched — owned by Better Auth. `user_profiles` stays as the app's user data table (1:1 with `user`).
- New financial tables use `uuid` PKs; FKs to `user` use `text` to match Better Auth's PK type.
- `transactions.amount` sign convention: positive = money in, negative = money out. Spent-so-far is always derived from transactions, never stored on `budgets`.
- `income_events` deferred — not needed until investing/forecasting surface.
- `access_token` on `bank_connections` is plain text for now; encryption deferred.
- Applied to Neon via `bun run dbreset`. DB is clean and ready.
- Next: seed default category groups/categories, or wire up the Plaid link flow.

## Thesis

- Build a personal finance app that helps users import transactions, understand budgets, and make smarter decisions before expanding into broader investing workflows.

## Current Focus

- Stabilize the core around auth, linked-account import, normalized transactions, and budget visibility before treating portfolio features as a first-class surface.

## 2026-03-29

- Initialized the cross-agent project scaffold with `AGENTS.md`, `CLAUDE.md`, `ledger.md`, `docs/plan.md`, and `docs/resources.md`.
- Captured the current product direction from the live app and existing planning notes in `.agents/implementationplan.md`.
- Next: audit the implementation plan against the current codebase and turn the active phase into a concrete milestone checklist.
