# Plaid Integration — Plan

Companion to [spec/plaid-integration.md](../spec/plaid-integration.md). Phased delivery — each phase lands behind a flag or in a dev-only route until the next one backs it.

## Phase 0 — Setup (½ day)

- Create Plaid dashboard account; grab sandbox `PLAID_CLIENT_ID` / `PLAID_SECRET`.
- Add env vars to `.env.local` and `.env.example`: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`, `PLAID_WEBHOOK_URL`.
- `bun add plaid react-plaid-link`.
- Create `src/server/plaid/client.ts` — singleton `PlaidApi` configured from env.

**Exit:** plaid client imports and `/accounts/get` against a fake token returns the expected auth error.

## Phase 1 — Link token + exchange (1 day)

- `POST /api/plaid/link-token` route. Scope `client_user_id` to session user id.
- Client: "Connect bank" button on dashboard that calls the route, opens `usePlaidLink`.
- `POST /api/plaid/exchange` route: calls `/item/public_token/exchange`, then `/accounts/get`, writes `bankConnections` + `bankAccounts` in a transaction.

**Exit:** sandbox user (`user_good` / `pass_good`) connects, DB shows one connection + N accounts.

## Phase 2 — Transaction sync (1–2 days)

- `src/server/plaid/sync.ts`: `syncConnection(connectionId)` — loops `/transactions/sync` (pass `cursor` = stored `lastCursor`, omit on first run) until `has_more=false`, upserts `added`/`modified` via `providerTransactionId`, deletes `removed` by id, persists `next_cursor` as `lastCursor`.
- Call it at the tail of Phase 1 exchange for initial hydration.
- `POST /api/plaid/sync` route: authenticated manual trigger.
- Add "Refresh transactions" button on dashboard.

**Exit:** transactions table populated from sandbox; re-running sync is a no-op (cursor advanced).

## Phase 3 — Webhooks (1 day)

- `POST /api/plaid/webhook` — read raw body (needed for `request_body_sha256` check), verify ES256 JWT via `/webhook_verification_key/get` with JWK caching by `kid`, reject if `iat` > 5 min old.
- Handle `TRANSACTIONS` webhook codes: `SYNC_UPDATES_AVAILABLE` (primary for `/transactions/sync`), plus `INITIAL_UPDATE` / `HISTORICAL_UPDATE` / `DEFAULT_UPDATE` as fallback signals → enqueue `syncConnection`.
- Handle `ITEM` webhooks: `ERROR` (inspect `error_code` e.g. `ITEM_LOGIN_REQUIRED`), `PENDING_EXPIRATION`, `LOGIN_REPAIRED` → flip `status`.
- Use ngrok (already in repo — `ngrok.yml`) for local webhook delivery during dev.

**Exit:** sandbox `/sandbox/item/fire_webhook` triggers a sync without user action.

## Phase 4 — Management UI (½–1 day)

- `/settings/connections` page: list `bankConnections` with account count, status, last synced.
- Unlink button → `DELETE /api/plaid/connections/:id` → `/item/remove` + status flip.
- Surface reconnect CTA when `status="error"`.

**Exit:** user can add, view, and remove a connection end-to-end in sandbox.

## Phase 5 — Schema trim + reliability pass

Now that fields have real callers, revisit the audit from the previous session:
- Drop any `bankAccounts` / `bankConnections` / `transactions` fields still unused.
- Decide on `categoryConfidence`, `authorizedDate`, `merchantName`, `notes` based on what the UI actually reads.
- Generate drizzle migration.
- **Swap `drizzle-orm/neon-http` → `drizzle-orm/neon-serverless` (WebSocket pool)** so multi-statement DB transactions work. Wrap Phase 1's exchange (connection + accounts insert) and Phase 2's sync (upsert + cursor advance) in `db.transaction(...)` to eliminate orphan-row and half-synced states. Update `src/index.ts` and audit any code relying on http-driver semantics.
- **Rework unlink to "delete pipe, keep data" model.** Currently soft-revokes (`status="revoked"`). Plan:
  1. Make `bank_accounts.connection_id` nullable; drop `ON DELETE CASCADE` from the FK.
  2. On unlink: hard-delete the `bank_connections` row, set `bank_accounts.connection_id = NULL`, flip `bank_accounts.is_active = false`.
  3. `is_active` earns its keep — budget/transaction queries filter by it. Re-adding the same bank creates fresh active accounts; the old ones stay as inactive history.
  4. Remove the `status = "revoked"` handling from `/settings/connections` filter once the model changes (nothing will ever be revoked anymore).

## Risks & Mitigations

- **Webhook delivery in dev** → ngrok config already present; document the exact tunnel command in `resources.md`.
- **Access token leak** → never log full token; redact in error paths; plan encryption-at-rest pre-production.
- **Sandbox drift from production data shape** → run against Plaid development tier before shipping.
- **Sync running concurrently for same item** → per-connection advisory lock (Postgres `pg_advisory_xact_lock(hash(connectionId))`).

## Dependencies

- Auth is already wired (better-auth) — assumed stable.
- Neon + Drizzle schema already in place; no DDL needed for Phases 1–4.
- Category seeding deferred until after Phase 2 so we can shape categories around Plaid's `personal_finance_category` values.

## Estimate

~4–6 working days end-to-end, single developer. Phases 1–2 unlock the dashboard from demo data; 3–4 make it feel real.
