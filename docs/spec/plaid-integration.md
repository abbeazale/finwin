# Plaid Integration — Spec

## Goal

Let a signed-in FinWin user link one or more bank logins via Plaid, persist the resulting accounts, and sync transactions into the app. This is the first real data feed into FinWin and unseats all demo/placeholder transaction flows.

## Scope

**In scope**
- Plaid Link (frontend) for account connection.
- Token exchange + item persistence (`bankConnections`).
- Account enumeration + persistence (`bankAccounts`).
- Transaction sync using the `/transactions/sync` cursor-based endpoint.
- Webhook endpoint for `SYNC_UPDATES_AVAILABLE` and item-error events.
- Basic item management: list connections, unlink (revoke).

**Out of scope (for this milestone)**
- Balance history, investments endpoints, liabilities.
- Multi-currency normalization beyond passthrough.
- Category remap / ML; we store Plaid's `personal_finance_category` raw and map to our categories in a later pass.
- Recurring transactions, enrich, income endpoints.

## User Flows

1. **Connect bank**
   - User clicks "Connect bank" on dashboard.
   - Server issues a Plaid link token (`/link/token/create`) scoped to the user.
   - Plaid Link UI opens; user authenticates at their bank.
   - On success, client sends `public_token` to server.
   - Server exchanges for `access_token` + `item_id`, writes a `bankConnections` row, enumerates accounts, writes `bankAccounts` rows, kicks off initial transaction sync.

2. **Sync transactions (on demand + webhook)**
   - Server calls `/transactions/sync` with `cursor` (stored as `lastCursor` per connection; omit on first call).
   - Response yields `added`, `modified`, `removed`, `has_more`, `next_cursor`. Loop while `has_more=true`.
   - Upsert added/modified, delete by id for removed, persist `next_cursor` as the new `lastCursor`.

3. **Webhook-driven sync**
   - Plaid posts to `/api/plaid/webhook` on new data.
   - Server verifies signature, queues sync for the affected item.

4. **Unlink**
   - User removes a connection; server calls `/item/remove`, marks `bankConnections.status = "revoked"`, soft/cascade-deletes dependent rows per product decision.

## Data Contracts

Current schema in [schema.ts](src/db/schema.ts) already models this. Fields used by the integration:

- `bankConnections`: `userId`, `provider="plaid"`, `providerItemId`, `accessToken`, `status`, `lastCursor`.
- `bankAccounts`: `connectionId`, `providerAccountId`, `name`, `type`, `subtype`, `mask`, `currency`.
- `transactions`: `accountId`, `providerTransactionId`, `date`, `authorizedDate`, `name`, `merchantName`, `amount`, `currency`, `pending`, (later) `categoryId`.

**Amount sign convention:** Plaid provider amounts may use positive = money out and negative = money in. FinWin canonical transaction semantics should use the opposite account-based convention:
- positive = money in
- negative = money out

The sync layer should normalize Plaid amounts before persistence so the app reasons about balances, cashflow, and budgets using one consistent rule.

## API Surface

Server routes:
- `POST /api/plaid/link-token` → `{ link_token }`
- `POST /api/plaid/exchange` → body `{ public_token }` → `{ connectionId }`
- `POST /api/plaid/sync` → body `{ connectionId? }` (omit = sync all for user)
- `POST /api/plaid/webhook` → Plaid-initiated
- `DELETE /api/plaid/connections/:id` → unlink

All routes (except webhook) require an authenticated session.

## Security

- Plaid `access_token` should not be stored in plaintext. FinWin now targets application-layer encrypted token storage with a versioned env-managed keyring; see `docs/spec/plaid-token-encryption.md`.
- Webhook verified via `Plaid-Verification` header (ES256 JWT). Process: decode JWT header → fetch JWK via `/webhook_verification_key/get` with the `kid` → verify signature → assert `alg="ES256"` → reject if `iat` older than 5 minutes → compare `request_body_sha256` claim against SHA-256 of the raw request body. Use a vetted JWT/JWK lib; do not roll your own.
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` in env; sandbox → development → production progression.
- Never return `accessToken` to the client.

## Error Handling

- `ITEM_LOGIN_REQUIRED` → mark connection `status="error"`, surface reconnect CTA.
- `RATE_LIMIT_EXCEEDED` → exponential backoff on sync worker.
- Duplicate `providerTransactionId` → idempotent upsert (existing unique index).

## Open Questions

- When FinWin stops treating the database as disposable, what is the backfill/rotation path for already-linked tokens?
- On unlink, do we hard-delete transactions or keep them for historical budgets?
- Sync trigger: webhook-only, or also a cron fallback?
