# FinWin Ledger

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
