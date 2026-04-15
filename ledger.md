# FinWin Ledger

## 2026-04-14 (later)

- Drafted Plaid integration spec + phased plan in `docs/spec/plaid-integration.md` and `docs/plan/plaid-integration.md`; cross-checked against Plaid API docs (corrected cursor param name, webhook JWT verification flow, sign convention).
- **Phase 0** done: env vars (`PLAID_ENV`, `PLAID_WEBHOOK_URL`), `.env.example`, installed `plaid` + `react-plaid-link`, created `src/server/plaid/client.ts` singleton.
- **Phase 1** done + verified: `POST /api/plaid/link-token`, `POST /api/plaid/exchange`, `ConnectBank` component in dashboard header. End-to-end sandbox connect confirmed — `bank_connections` + `bank_accounts` rows written correctly.
- **Phase 2** done + verified: `src/server/plaid/sync.ts` (`syncConnection` + `syncUserConnections`), `POST /api/plaid/sync` (manual trigger, per-connection or all), `RefreshTransactions` dashboard button. Initial hydration runs at tail of `/exchange`. Cursor-based sync: upsert on `providerTransactionId`, delete on `removed`, advance `lastCursor`. Sandbox sync populates `transactions` rows correctly.
- **TODO for Phase 5**: switch `drizzle-orm/neon-http` → `drizzle-orm/neon-serverless` (WebSocket pool) so multi-statement DB transactions work; current exchange + sync paths can leave orphan rows on partial failure.

## 2026-04-14

- Killed the old DB and rebuilt the schema from scratch with a clean single migration (`drizzle/0000_lean_forge.sql`).
- Expanded `src/db/schema.ts` with 6 financial tables: `category_groups`, `categories`, `bank_connections`, `bank_accounts`, `transactions`, `budgets`.
- Auth tables (`user`, `session`, `account`, `verification`) remain untouched — owned by Better Auth. `user_profiles` stays as the app's user data table (1:1 with `user`).
- New financial tables use `uuid` PKs; FKs to `user` use `text` to match Better Auth's PK type.
- `transactions.amount` sign convention: positive = expense (money out), negative = income/refund (money in). Spent-so-far is always derived from transactions, never stored on `budgets`.
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
