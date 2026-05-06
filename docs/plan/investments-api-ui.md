# Investment API and UI — Plan

Companion to [spec/investments-api-ui.md](../spec/investments-api-ui.md).

Order: 3 — implement after Plaid sync, before FX normalization.

Status: complete as of 2026-05-06; live investment UI/data spot-check is complete.

## Goal

Expose imported investment data through protected tRPC procedures and render the
first `/investments` page.

## Phase 0 — API Helpers

- Add shared investment value helpers for:
  - display account name
  - market value
  - gain/loss
  - gain/loss suppression when cost basis is missing
  - cash impact from `plaid_amount`

Exit: financial math is centralized enough to test.

## Phase 1 — `investmentsRouter`

Add `src/server/trpc/routers/investments.ts` and register it.

Build:

- `investments.getAccounts`
- `investments.getHoldings`
- `investments.getTransactions`
- `investments.sync`

Rules:

- all procedures use `protectedProcedure`
- every query scopes by `ctx.userId`
- account/connection inputs are ownership checked
- inactive accounts are hidden unless requested

Exit: API returns live investment data without a page.

## Phase 2 — Focused Tests

Add targeted tests for:

- cost basis missing -> gain/loss is null
- `plaid_amount` -> `cashImpact`
- inactive account filtering

FX-specific exclusion tests can land with the FX plan if FX is not implemented
yet.

Exit: the risky financial transforms are covered.

## Phase 3 — `/investments` Page

Build `src/pages/investments.tsx`.

Core UI:

- page header
- sync button
- last synced timestamp
- account selector
- inactive-account toggle
- portfolio summary
- holdings table
- investment transaction history

Exit: a user can inspect real holdings and investment transactions.

## Phase 4 — Empty and Error States

Add states for:

- no investment accounts linked
- linked but never synced
- synced but no holdings
- missing cost basis
- stale price data

Exit: the page is usable before and after first successful sync.

## Verification

- `bunx tsc --noEmit`
- `bun run lint`
- browser check for `/investments`
- manual data spot-check against Plaid response logs or DB rows

## Files

- `src/server/trpc/routers/investments.ts`
- `src/server/trpc/routers/_app.ts`
- `src/pages/investments.tsx`
- optional investment helper/test files

## Done

- `/investments` renders live data.
- Financial null states do not show fake zeroes.
- Ownership checks are in place.
