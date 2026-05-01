# Investment Accounts — Phase 6a Overview

Companion plan: [Investment Accounts — Phase 6a Plan](../plan/investments-real-accounts.md).

## Goal

Let a signed-in FinWin user connect real investment accounts through the
existing Plaid Link flow and view a read-only portfolio surface.

This phase should answer:

"What do I actually own, what is it worth right now, and what have I been doing
with my investment accounts?"

## Product Shape

The investments surface is factual and read-only:

- holdings and securities come from Plaid Investments
- portfolio value comes from institution-reported prices on the last sync
- cost basis comes from the institution where available
- gain/loss is derived on read, never stored
- investment transaction history is imported from Plaid and shown separately
  from regular bank transactions
- the user controls data freshness by syncing

Phase 6a does not execute trades, recommend investments, or simulate
hypotheticals. Paper trading and richer market-data surfaces remain Phase 6b.

## Split Specs

Build this in smaller slices:

1. [Investment Schema and Accounts](./investments-schema-accounts.md)
   - account nickname model
   - securities table
   - holdings snapshot table
   - investment transaction table
   - retained inactive-account behavior

2. [Investment Plaid Sync](./investments-plaid-sync.md)
   - Plaid Link product enablement
   - holdings sync
   - investment transactions sync
   - webhook dispatch
   - investment transaction sign semantics

3. [Investment FX Rates](./investments-fx-rates.md)
   - USD base-currency decision for Phase 6a
   - Open Exchange Rates cache
   - conversion rules
   - unavailable/stale FX behavior

4. [Investment API and UI](./investments-api-ui.md)
   - tRPC procedure contracts
   - authorization rules
   - `/investments` page structure
   - empty states and edge cases

## Phase Order

### 6a.1 — Schema and Account Labels

Add the investment tables and account nickname support without changing Plaid
sync behavior yet.

Done when:

- `bank_accounts.nickname` exists and is never overwritten by sync
- `securities`, `investment_holdings`, `investment_transactions`, and
  `currency_rates` are represented in Drizzle schema and migrations
- user IDs match the current Better Auth schema: `text` FKs to `user.id`

### 6a.2 — Plaid Investment Import

Enable the `investments` Plaid product and import holdings, securities, and
investment transactions for investment accounts.

Done when:

- investment accounts can be linked through the existing Plaid Link flow
- holdings sync replaces the current snapshot atomically per account
- investment transactions sync by date range and pagination
- Plaid investment webhooks dispatch to the correct sync path
- regular transaction sign normalization is not applied to investment
  transactions

### 6a.3 — Read API

Add the protected tRPC procedures needed by the read-only page.

Done when:

- accounts, holdings, and investment transactions are scoped by `ctx.userId`
- account and connection inputs are ownership checked
- gain/loss suppresses cleanly when cost basis is missing
- inactive accounts are hidden by default and available via an explicit toggle

### 6a.4 — FX Normalization

Add cached daily FX rates and convert aggregate portfolio values to USD.

Done when:

- OER rates can be refreshed and cached
- non-USD holdings preserve native values
- USD aggregates exclude rows with unavailable FX and report the exclusion count
- stale FX rates surface in the API/UI

### 6a.5 — Investments Page

Ship `/investments` as the read-only portfolio surface.

Done when:

- portfolio totals, holdings, and investment transactions render from live data
- last-synced and price staleness are visible
- missing cost basis and missing FX are communicated without showing fake zeroes
- empty states work for unlinked, unsynced, and zero-holding cases

## Out of Scope

- simulated portfolio and paper trading
- real-time prices or intraday streaming
- TradingView charts
- external market data beyond Plaid-reported investment data
- stock search or asset discovery
- tax lots
- options/derivatives-specific UI
- crypto-specific handling
- performance attribution or time-weighted returns
- dividend reinvestment tracking
- per-user configurable investment base currency
- historical FX rates

## Cross-Cutting Rules

- Prioritize deterministic, explainable financial math.
- Store provider raw values where signs or currencies are provider-specific.
- Derive user-facing values on read.
- Keep unlink behavior consistent with the existing model: delete the Plaid pipe,
  keep historical account data.
- Do not use institution name as the user-facing account label. Use
  `nickname ?? provider account name`.
