# Plaid Sync Hardening — Plan

Companion to [spec/plaid-sync-hardening.md](../spec/plaid-sync-hardening.md). This milestone narrows Phase 4 to one job: make sync failures visible and recoverable without touching anything that is already working.

## Goal

Ship a production-safe sync layer where:
- sync errors flip connection status and store the error code
- the connections page surfaces broken connections with a re-link CTA
- the dashboard header shows targeted error copy when a sync fails
- the local ledger stays consistent regardless of Plaid error type

## What Not To Touch

- Cursor-based sync loop — working, do not change the loop structure
- Idempotent upsert path — working, do not change conflict targets
- DB transaction wrapping upsert + delete + cursor advance — working
- Token encryption — working, do not touch crypto helpers
- Webhook signature verification — working
- Update-mode Link token creation — working

## Delivery Order

1. Schema migration (`last_synced_at`, `sync_error_code`)
2. Sync error classification in `syncConnection`
3. Cursor reset handling in `syncConnection`
4. `plaid.syncTransactions` response — add `errorReason`
5. `plaid.listConnections` response — add `lastSyncedAt`, `syncErrorCode`
6. Connections page error state UI
7. Dashboard header error banner
8. Verify end-to-end with a sandbox expired-token scenario

---

## Phase 1 — Schema Migration (half day)

Add two nullable columns to `bank_connections`:

```sql
ALTER TABLE bank_connections
  ADD COLUMN last_synced_at timestamptz,
  ADD COLUMN sync_error_code text;
```

Update `src/db/schema.ts` to reflect both columns.

Run: `bun run dbreset` (DB is still disposable) or generate a new Drizzle migration.

**Exit**: columns exist, TypeScript types are updated, build passes.

---

## Phase 2 — `syncConnection` Hardening (1 day)

File: `src/server/plaid/sync.ts`

### Error classification

Wrap the `transactionsSync` loop in a try/catch that reads `err.response?.data?.error_code`.

```
ITEM_LOGIN_REQUIRED
ITEM_LOCKED
INSUFFICIENT_CREDENTIALS
  → flip status = "error", set sync_error_code
  → write outside the main DB transaction so the status persists even if the sync data rolls back
  → rethrow so the caller knows sync failed

PRODUCT_NOT_READY
  → catch and continue; do not flip status

cursor stale (INVALID_CURSOR or equivalent)
  → null lastCursor in memory
  → restart the sync loop from scratch
  → if it succeeds, proceed normally

anything else
  → flip status = "error", set sync_error_code = error_code ?? "UNKNOWN"
  → rethrow
```

### On success

At the end of the successful DB transaction, also write `last_synced_at = NOW()` and clear `sync_error_code = null`.

### `SyncResult` type change

```ts
export type SyncResult = {
  added: number
  modified: number
  removed: number
  cursor: string | null
  errorReason: "login_required" | "locked" | "cursor_reset" | "unknown" | null
}
```

**Exit**: `syncConnection` persists error state on failure, clears it on success, handles cursor reset without losing data.

---

## Phase 3 — tRPC Router Updates (half day)

File: `src/server/trpc/routers/plaid.ts`

### `plaid.syncTransactions`

Surface `errorReason` from each `SyncResult` in the response:

```ts
return {
  results: results.map(r => ({
    connectionId: ...,
    added: r.added,
    modified: r.modified,
    removed: r.removed,
    errorReason: r.errorReason,
  }))
}
```

### `plaid.listConnections`

Add `lastSyncedAt` and `syncErrorCode` to each row in the query and return shape.

### `plaid.reactivateConnection`

After flipping status to `"active"`, also clear `sync_error_code = null`.

**Exit**: API surface exposes error state; client can read `errorReason` and `syncErrorCode`.

---

## Phase 4 — Connections Page UI (half day)

File: `src/pages/settings/connections.tsx`

### Active connection row

Replace `updatedAt` display with `lastSyncedAt` (formatted). Show `updatedAt` only as a fallback if `lastSyncedAt` is null.

### Error connection row

Add a distinct visual treatment for `status === "error"`:
- amber pill or oxide border on the row
- human-readable label derived from `syncErrorCode`:
  - `ITEM_LOGIN_REQUIRED` → "Login expired"
  - `ITEM_LOCKED` → "Account locked"
  - `INSUFFICIENT_CREDENTIALS` → "Credentials invalid"
  - anything else → "Sync error"
- "Reconnect" button that calls `plaid.createLinkToken` with `connectionId`

The "Reconnect" button reuses the existing update-mode Link flow already wired in `ConnectBank`.

**Exit**: error connections are visually distinct and actionable without any layout changes to active connections.

---

## Phase 5 — Dashboard Header Error Banner (half day)

File: `src/pages/dashboard.tsx` and `src/components/dashboard/header.tsx`

When `plaid.syncTransactions` returns any result with `errorReason !== null`:
- show the existing banner with targeted copy
- link the banner to `/settings/connections`

Example copy: "One or more connections need attention — visit Connections to re-link."

Keep the existing success banner copy unchanged: `+N · ~N · -N`.

**Exit**: sync failures surface to the user from the dashboard, not just from the settings page.

---

## Phase 6 — Verification (half day)

### Build checks

```
bunx tsc --noEmit
bunx eslint src/server/plaid/sync.ts src/server/trpc/routers/plaid.ts src/pages/settings/connections.tsx src/pages/dashboard.tsx
```

### Manual verification scenarios

- **Happy path**: sync succeeds → `last_synced_at` updated, `sync_error_code` null, connections page shows last sync time
- **Expired login (sandbox)**: use Plaid sandbox `ITEM_LOGIN_REQUIRED` error simulation → status flips to `"error"`, error code stored, connections page shows "Login expired" with Reconnect button
- **Cursor reset**: manually null `last_cursor` in the DB and re-sync → sync completes from scratch without duplicate rows
- **Re-link after error**: click Reconnect, complete Link update flow → status back to `"active"`, `sync_error_code` cleared
- **Dashboard sync failure banner**: trigger a failing sync from the dashboard header → banner shows targeted copy with link to connections

**Exit**: all five scenarios pass.

---

## Suggested Implementation Shape

### Server changes

- `src/server/plaid/sync.ts` — error classification, cursor reset, `last_synced_at` write
- `src/server/trpc/routers/plaid.ts` — `errorReason` in sync response, `lastSyncedAt` + `syncErrorCode` in list response, clear error on reactivate
- `src/db/schema.ts` — two new columns on `bankConnections`
- `drizzle/0003_plaid_sync_hardening.sql` — migration

### Client changes

- `src/pages/settings/connections.tsx` — error state row UI, last sync time
- `src/pages/dashboard.tsx` or `src/components/dashboard/header.tsx` — error banner on sync mutation result

---

## Risks and Mitigations

**Risk**: status flip write fails while sync data is rolling back.
**Mitigation**: write the status + error code in a separate `db.update` call outside the main DB transaction. It runs after the transaction fails and is not rolled back with the sync rows.

**Risk**: cursor reset triggers full re-sync on every error.
**Mitigation**: cursor reset only happens on `INVALID_CURSOR` or equivalent. All other error types leave the cursor intact.

**Risk**: `last_synced_at` is null for existing connections after migration.
**Mitigation**: null is handled in the UI as "Never" or "Unknown". No backfill needed.

**Risk**: Plaid sandbox does not easily simulate `ITEM_LOGIN_REQUIRED`.
**Mitigation**: can test error-path code via direct DB manipulation (set `status = "error"`, `sync_error_code = "ITEM_LOGIN_REQUIRED"`) to verify the UI path independently.

---

## Dependencies

- `src/db/schema.ts`
- `src/server/plaid/sync.ts`
- `src/server/trpc/routers/plaid.ts`
- `src/pages/settings/connections.tsx`
- `src/pages/dashboard.tsx`
- `docs/spec/plaid-sync-hardening.md`

## Follow-On Work

Defer until after this milestone:
- Background / scheduled sync
- Sync history log table
- Push notifications for connection errors
- Multi-item batch error recovery
