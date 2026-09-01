# Plaid Sync Hardening — Spec

> Status vocabulary in the original milestone below is historical. Pilot-to-paid
> Batch 2B replaced `active` / `error` with `linked`, `syncing`, `ready`, and
> `sync_failed` in `drizzle/0011_bank_connection_sync_state.sql`. Every sync path
> now persists the transition, and `/settings/connections` retries failed or
> unfinished imports against the saved connection.

## Goal

Make the Plaid sync integration production-safe after the first real-data loop is working.

This milestone answers:

"When a sync fails, a token expires, or Plaid revokes access, does the user know, can they fix it, and does the local ledger stay consistent?"

## What Is Already Working

These items are in place and do not need to be re-implemented:

- Cursor-based incremental sync via `lastCursor` on `bank_connections`
- Idempotent upsert on `providerTransactionId` unique index
- Multi-statement DB transactions wrapping upsert + delete + cursor advance
- Initial sync at tail of token exchange
- Manual re-sync from the dashboard header (`plaid.syncTransactions`)
- Token exchange update mode via `createLinkToken` with `connectionId`
- Webhook delivery of `TRANSACTIONS_SYNC_UPDATES_AVAILABLE` → `syncConnection`
- Webhook delivery of `ITEM_*` codes → `bankConnections.status` flip

## What Is Missing

### 1 — Error state is not persisted on sync failure

When `syncConnection` throws (e.g. Plaid returns `ITEM_LOGIN_REQUIRED`, `ITEM_LOCKED`, or a network error), the connection stays `status = "active"` in the database. The user has no visibility into the failure.

Fix: catch known Plaid error types in `syncConnection` and flip `status` to `"error"` with a stored error code before re-throwing or swallowing.

### 2 — No dedicated last-sync timestamp

`bank_connections.updated_at` is bumped on cursor advance, but it is also bumped by status changes and reactivations. There is no explicit `last_synced_at` for UI display on the connections page.

Fix: add `last_synced_at` to `bank_connections` and write it only on successful sync completion.

### 3 — No stored error code for UI

When status flips to `"error"`, the connections page has no Plaid error code or message to show the user. The UI cannot distinguish between a login expiry, a locked account, and a transient network error.

Fix: add `sync_error_code` to `bank_connections` and write it when status flips to `"error"`. Clear it when status returns to `"active"`.

### 4 — Connections page does not surface error states

The connections list shows `status` but has no distinct UI treatment for `"error"` connections. There is no re-link CTA triggered by the error state.

Fix: render a visible degraded state for error connections, with a "Reconnect" action that launches update-mode Link.

### 5 — Cursor reset path is unhandled

Plaid can signal that a cursor has become invalid (e.g. via `SYNC_UPDATES_AVAILABLE` after a long gap or a provider migration). If the cursor is stale, `transactionsSync` will return an error. The sync path does not handle a cursor reset by nulling `lastCursor` and retrying from scratch.

Fix: on a cursor-related Plaid error, null `lastCursor` and retry the sync from the beginning before surfacing the error.

### 6 — Sync error copy in the UI is generic

`plaid.syncTransactions` currently surfaces "Sync failed." regardless of the cause. The dashboard header and connections page should show actionable copy when the error is fixable by the user (e.g. "Your Chase connection needs to be re-linked").

Fix: return a structured error reason from `syncTransactions` so the UI can show targeted messages.

## Out of Scope

- Background / scheduled sync (deferred, no job runner in v0.1)
- Multi-item recovery (more than one connection erroring at the same time)
- Automatic re-link without user interaction
- Token rotation or key re-encryption
- Webhook signature expiry handling changes
- Investing or balance sync

## Schema Changes

### `bank_connections` additions

```
last_synced_at   timestamp with time zone   nullable
sync_error_code  text                       nullable
```

- `last_synced_at` is set to `NOW()` at the end of a successful `syncConnection` call
- `last_synced_at` is not updated on partial or failed syncs
- `sync_error_code` is set when `status` flips to `"error"`, cleared when status returns to `"active"`

Migration: `drizzle/0003_plaid_sync_hardening.sql`

## Sync Error Classification

Plaid errors returned in `err.response.data` carry a `error_code` field.

| Plaid error code | FinWin action |
|---|---|
| `ITEM_LOGIN_REQUIRED` | flip status → `"error"`, store code, surface reconnect CTA |
| `ITEM_LOCKED` | flip status → `"error"`, store code, surface reconnect CTA |
| `INSUFFICIENT_CREDENTIALS` | flip status → `"error"`, store code, surface reconnect CTA |
| `PRODUCT_NOT_READY` | retry silently, do not flip status |
| cursor stale / `INVALID_CURSOR` | null cursor, retry from scratch, then continue normally |
| transient network / 5xx | do not flip status, surface generic retry message |

For any other error code, flip status to `"error"` and store the code. Better to show the user a fixable degraded state than to silently hide the failure.

## Connection Status Model

```
active   — sync is working normally
error    — last sync or webhook signaled a problem; user action needed
```

The `"revoked"` value was removed in the earlier unlink rework. It should not be reintroduced.

Status transitions:

```
initial exchange   →  active
sync succeeds      →  stays active, last_synced_at updated
sync fails (user)  →  error, sync_error_code set
webhook ITEM error →  error, sync_error_code set
reactivate / re-link complete → active, sync_error_code cleared
```

## Sync Flow After Changes

```
syncConnection(connectionId)
  ├── fetch connection row
  ├── decrypt access token
  ├── loop: plaid.transactionsSync
  │     ├── on INVALID_CURSOR → null cursor, retry loop from scratch
  │     └── on user-action errors → flip status + store code, throw
  ├── db.transaction: upsert + delete + cursor advance + last_synced_at
  └── return SyncResult
```

If any Plaid call throws a user-action error class, the DB transaction should still attempt to persist the status flip and error code in a separate write (outside the main transaction, so it is not rolled back with the sync data).

## API Surface

### `plaid.syncTransactions` — response change

Add `errorReason` to the per-connection result:

```ts
{
  results: Array<{
    connectionId: string
    added: number
    modified: number
    removed: number
    cursor: string | null
    errorReason: "login_required" | "locked" | "cursor_reset" | "unknown" | null
  }>
}
```

`errorReason` is `null` on success. The UI uses this to show targeted copy.

### `plaid.listConnections` — response change

Add `lastSyncedAt` and `syncErrorCode` to each connection row:

```ts
{
  id: string
  status: string
  syncErrorCode: string | null
  lastSyncedAt: string | null   // ISO string
  createdAt: string
  updatedAt: string
  accounts: { name, mask, type }[]
  lastTransactionDate: string | null
}
```

## UI Surface

### `/settings/connections`

**Active connection row**: show `lastSyncedAt` in place of or alongside `updatedAt`.

**Error connection row**: show a distinct visual treatment:
- amber or oxide border/pill
- display `syncErrorCode` in readable form (e.g. "Login expired" for `ITEM_LOGIN_REQUIRED`)
- "Reconnect" button that calls `plaid.createLinkToken` with `connectionId` (update mode)

No changes to the happy-path UI layout.

### Dashboard header / refresh button

On sync, if any connection returns `errorReason !== null`:
- show a targeted banner: e.g. "Chase needs to be re-linked — visit Connections."
- link the banner to `/settings/connections`

On full success, keep the existing count summary: `+N · ~N · -N`.

## Idempotency Guarantee

The existing `providerTransactionId` unique index guarantees no duplicate rows from repeated syncs. No changes are needed here.

The new `last_synced_at` is not part of any uniqueness constraint. Double-writing it is harmless.

## Edge Cases

- `syncConnection` called while connection is already `"error"`:
  - allow the sync to attempt; if it succeeds, flip back to `"active"` and clear the error code
- Cursor null after a reset:
  - full re-sync from scratch is equivalent to the initial sync; idempotency handles duplicates
- User re-links while status is `"error"`:
  - `exchangeToken` → `reactivateConnection` path should clear `sync_error_code` and set `status = "active"`
- Webhook fires ITEM error before user sees the UI:
  - same status/error-code write path as the sync failure path

## Non-Goals

This milestone does not:
- detect duplicate connections to the same institution
- merge transaction histories across re-linked connections
- auto-sync on a schedule
- send notifications outside the app
