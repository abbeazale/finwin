# Investment FX Rates

## Purpose

Normalize investment aggregates to a single base currency for Phase 6a while
preserving native provider values.

## Phase 6a Decision

Use USD as the hardcoded investment aggregation currency for Phase 6a.

Per-user configurable investment base currency is deferred. Historical FX rates
are also deferred.

## Provider

Use Open Exchange Rates (OER).

Environment variable:

- `OER_KEY`

OER's USD-base response fits the Phase 6a base-currency decision.

## Refresh Policy

- Refresh `currency_rates` once per day from the server.
- One OER response returns all currencies.
- If refresh fails, keep the previous cached rates.
- If rates are older than 7 days, surface a stale-rate warning on the
  investments page.

## Conversion Rules

Store native provider amounts exactly as Plaid reports them:

- holding cost basis
- holding institution price
- investment transaction amount
- investment transaction price and fees

Server procedures convert values for API responses. The UI receives both native
and converted values.

Aggregations:

- convert each non-USD value to USD before summing
- exclude rows that cannot be converted
- return `excludedHoldingCount` when holdings are excluded from aggregate totals

Cost basis:

- convert cost basis at the current cached FX rate
- suppress gain/loss if cost basis is missing
- show a caveat for non-USD gain/loss because historical FX is not yet
  supported

## Failure Modes

- no `OER_KEY`: non-USD rows remain visible but are excluded from USD
  aggregation
- OER quota exhausted: use last cached rates, or exclude non-USD rows if no
  usable cache exists
- currency missing from rates response: exclude affected rows from aggregates
  and report the exclusion count

## Done

- Rates can be fetched and cached.
- Conversion math runs server-side.
- Native values are preserved.
- Missing/stale FX is visible to the user.
