# Investment Accounts — Phase 6a Plan

Companion to [spec/investments-real-accounts.md](../spec/investments-real-accounts.md).

Order: 0 — overview and final verification.

Status: implemented through Phase 6a.4 as of 2026-04-30; final live-data verification remains.

## Goal

Ship a read-only real investment accounts surface in small, verifiable slices.

## Delivery Order

1. [Investment Schema and Accounts](./investments-schema-accounts.md)
2. [Investment Plaid Sync](./investments-plaid-sync.md)
3. [Investment API and UI](./investments-api-ui.md)
4. [Investment FX Rates](./investments-fx-rates.md)
5. final live-data verification pass

FX is listed after API/UI because the first useful version can render native
values and USD-only accounts before mixed-currency aggregation is complete.

## Milestone Checks

### 6a.1 — Schema

- Drizzle schema and migration exist.
- Account nickname is available for all account types.
- Investment tables preserve raw Plaid values.

### 6a.2 — Import

- Existing Plaid Link can connect investment accounts.
- Holdings and securities sync from Plaid.
- Investment transactions sync from Plaid without bank-transaction sign
  inversion.

### 6a.3 — Read Surface

- Protected tRPC procedures return accounts, holdings, and transactions.
- `/investments` renders live data.
- Empty states and inactive-account toggle work.

### 6a.4 — FX

- Non-USD native values are preserved.
- USD aggregates convert through cached FX rates.
- Missing/stale FX is visible and does not produce fake totals.

## Final Verification

- `bunx tsc --noEmit`
- `bun run lint`
- targeted unit tests for gain/loss suppression and FX exclusion
- manual sync against Plaid sandbox/development investment accounts
- re-sync confirms closed holdings disappear and transactions do not duplicate
