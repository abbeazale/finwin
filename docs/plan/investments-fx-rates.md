# Investment FX Rates — Plan

Companion to [spec/investments-fx-rates.md](../spec/investments-fx-rates.md).

Order: 4 — implement after the native-value API/UI works.

Status: complete as of 2026-05-01; deployment scheduling remains a production decision.

## Goal

Convert investment aggregates to USD using cached FX rates while preserving
native Plaid values.

## Phase 0 — Dependency and Env

- Add the selected FX math dependency if needed.
- Add `OER_KEY` to `.env.example`.
- Document OER in `docs/resources.md`.

Exit: the app can be configured for FX refresh without code changes.

## Phase 1 — Rate Fetcher

- Add an OER client/helper.
- Fetch USD-base rates.
- Upsert rates into `currency_rates`.
- Preserve `fetched_at` from the provider response when available.

Exit: a server function can refresh rates idempotently.

## Phase 2 — Refresh Entry Point

- Add a server-only refresh path.
- If deploying on Vercel later, wire to cron only when deployment config is
  ready.
- Keep manual/admin refresh internal; do not expose to normal users.

Exit: rates can be refreshed intentionally.

## Phase 3 — Conversion Helpers

- Load latest cached rates.
- Convert native values to USD on the server.
- Return null when a rate is unavailable.
- Return staleness metadata.

Exit: API code can call one conversion helper instead of hand-rolling math.

## Phase 4 — API/UI Integration

- Update investment account and holdings totals to use USD conversion.
- Exclude holdings with missing FX from aggregate totals.
- Return `excludedHoldingCount`.
- Surface stale/missing FX warnings on `/investments`.
- Resolve market value from the security close price when Plaid reports a zero
  institution holding price.

Exit: mixed-currency portfolios render honestly.

## Verification

- unit test: missing FX excludes holding from totals
- unit test: stale FX metadata is detected
- manual check with at least one non-USD fixture/seed row
- `bunx tsc --noEmit`
- `bun run lint`

## Files

- `src/server/investments/fx.ts` or similar
- `src/server/trpc/routers/investments.ts`
- `.env.example`
- `docs/resources.md`
- `src/pages/api/internal/fx/refresh.ts`
- deployment cron config later, if applicable

## Done

- Native values remain unchanged.
- USD aggregates use cached rates.
- Missing or stale FX is visible instead of silently wrong.
- Zero institution holding prices fall back to security close prices.
