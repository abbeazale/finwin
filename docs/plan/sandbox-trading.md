# Sandbox Trading — Plan

Companion to [spec/sandbox-trading.md](../spec/sandbox-trading.md).

Status: implemented as of 2026-07-11.

## Goal

Ship a paper-trading sandbox: multiple named portfolios per user, manual
buy/sell trades at live-but-editable prices, derived holdings and P&L, no
contact with Plaid-backed investing data.

## Phase 1 — Schema

Status: complete.

- Add `sandbox_portfolios` and `sandbox_trades` to `src/db/schema.ts` per spec.
- Generate migration with `bunx drizzle-kit generate`.
- Apply via `bunx drizzle-kit migrate` (or `bun run dbreset` if local data is
  disposable).

Exit: migration applies cleanly; `bunx tsc --noEmit` passes.

## Phase 2 — Quote Extensions

Status: complete.

- Refactor `src/server/market/quotes.ts` so the per-symbol fetch + 5-minute
  cache + stale-serve path works for arbitrary symbols, keeping
  `getTickerQuotes()` (landing page) behavior unchanged.
- Add `getQuote(symbol)` and `searchSymbols(query)` (Finnhub `/search`).

Exit: live Finnhub check — `getQuote("AAPL")` returns a real quote,
`searchSymbols("apple")` returns AAPL; landing page ticker still renders.

## Phase 3 — tRPC Router

Status: complete.

- Add `src/server/trpc/routers/sandbox.ts`; register in `_app.ts`.
- Implement portfolio CRUD, `getPortfolio` derivation (holdings, avg cost,
  cash, realized/unrealized gain), `listTrades`, `placeTrade`, `deleteTrade`,
  `searchSymbols`, `getQuote`.
- Implement the timeline-replay validator shared by `placeTrade` and
  `deleteTrade` (no negative cash or position at any point).
- Money/derivation helpers in `src/server/sandbox/values.ts`; reuse
  `src/server/lib/money.ts` serialization.

Exit: `bunx tsc --noEmit` + targeted lint pass; replay validator covers:
buy over cash, sell over position, backdated buy enabling a later sell,
deleting a buy that strands a later sell.

## Phase 4 — UI

Status: complete. The production route compiles and responds; browser automation
was unavailable in the implementation environment, so a signed-in click-through
remains a recommended local smoke test.

- Add `src/pages/sandbox.tsx` modeled on `src/pages/investments.tsx`:
  portfolio switcher/create, summary tiles, holdings table, trade history,
  new-trade flow with symbol search and pre-filled editable price/date.
- Enable "Sandbox" nav item in `src/components/dashboard/nav.ts`.

Exit: full flow works in the browser against the dev server — create
portfolio → search symbol → buy → holdings/cash update → sell → realized
gain shown → delete trade → state recomputes.

## Phase 5 — Verification

Status: complete for migration, deterministic replay checks, live Finnhub quote
and search, typecheck, lint, Knip, and production build. Browser automation was
unavailable in the implementation environment.

- `bunx tsc --noEmit`, `bun run lint`, `bun run build`.
- Manual pass: validation errors surface inline for over-cash buy and
  over-position sell; unknown symbol rejected; missing-quote holding shows
  cost basis with a notice instead of zero.

## Files

- `src/db/schema.ts`, `drizzle/*.sql`
- `src/server/market/quotes.ts`
- `src/server/sandbox/values.ts`
- `src/server/trpc/routers/sandbox.ts`, `src/server/trpc/routers/_app.ts`
- `src/pages/sandbox.tsx`
- `src/components/dashboard/nav.ts`
