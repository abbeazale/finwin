# Investment API and UI

## Purpose

Expose read-only investment data through tRPC and render `/investments`.

## Authorization

All procedures use `protectedProcedure`.

Every query scopes by `ctx.userId`.

Any procedure accepting `accountId` or `connectionId` must verify ownership.
Non-owned IDs return the same not-found response as unknown IDs.

## `investments.getAccounts`

Returns investment accounts with per-account totals.

Input:

- none

Output:

- `accounts`
  - `accountId`
  - `accountName` — `nickname ?? providerAccountName`
  - `providerAccountName`
  - `accountNickname`
  - `accountMask`
  - `accountSubtype`
  - `nativeCurrency`
  - `totalValueUsd`
  - `totalCostBasisUsd`
  - `totalGainLossUsd`
  - `totalGainLossPct`
  - `holdingCount`
  - `excludedHoldingCount`
  - `lastSyncedAt`

## `investments.getHoldings`

Returns holdings with security metadata and calculated values.

Input:

- `accountId?: string`
- `includeInactive?: boolean`, default `false`

Output:

- `totals`
  - `totalValueUsd`
  - `totalCostBasisUsd`
  - `totalGainLossUsd`
  - `totalGainLossPct`
  - `costBasisAvailable`
  - `excludedHoldingCount`
- `holdings`
  - `holdingId`
  - `accountId`
  - `accountName`
  - `providerAccountName`
  - `accountNickname`
  - `securityId`
  - `tickerSymbol`
  - `securityName`
  - `securityType`
  - `isCashEquivalent`
  - `quantity`
  - `nativeCurrency`
  - `costBasisNative`
  - `costBasisUsd`
  - `institutionPriceNative`
  - `institutionPriceAsOf`
  - `marketValueNative`
  - `marketValueUsd`
  - `gainLossUsd`
  - `gainLossPct`
  - `fxConverted`

## `investments.getTransactions`

Returns paginated investment transaction history.

Input:

- `accountId?: string`
- `limit?: number`, default `50`
- `offset?: number`, default `0`

Output:

- `transactions`
  - `transactionId`
  - `date`
  - `name`
  - `type`
  - `subtype`
  - `tickerSymbol`
  - `securityName`
  - `quantity`
  - `price`
  - `plaidAmount`
  - `cashImpact`
  - `cashImpactUsd`
  - `fees`
  - `nativeCurrency`
  - `accountName`
- `totalCount`

## `investments.sync`

Triggers on-demand investment sync.

Input:

- `connectionId?: string`

If omitted, sync all active investment-capable connections owned by the user.

Output:

- `syncedConnections`
- `holdingsUpdated`
- `transactionsUpserted`
- `lastSyncedAt`

## `/investments` Page

Header:

- page title
- sync button
- last-synced timestamp
- account selector
- show inactive accounts toggle

Portfolio summary:

- total market value
- total cost basis
- gain/loss dollars and percent
- FX exclusion/staleness notice when applicable

Holdings table:

- symbol
- name
- type
- shares
- average cost or cost basis
- price as-of
- market value
- gain/loss
- gain/loss percent

Investment transactions:

- date
- description
- type
- symbol
- quantity
- price
- cash impact
- native currency/converted value when applicable

## UI Rules

- Show ticker when available; fall back to security name.
- Cash and money-market rows use `isCashEquivalent`.
- Missing cost basis shows a dash, not zero.
- Missing FX keeps the row visible but excludes it from USD aggregates.
- Inactive accounts are hidden by default.
- Price and FX staleness are visible.

## Empty States

- No investment accounts linked: link to `/settings/connections`.
- Investment accounts linked but never synced: prompt to sync.
- Investment accounts synced but no holdings: show the account with a no-holdings
  message.

## Done

- `/investments` renders live account, holding, and transaction data.
- Ownership checks cover all account and connection inputs.
- Missing cost basis and missing FX are represented honestly.
- Inactive account toggle works with retained historical data.
