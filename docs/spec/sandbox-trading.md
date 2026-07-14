# Sandbox Trading

## Purpose

Give users a paper-trading sandbox: manually add stocks and record hypothetical
buy/sell trades against a fictional cash balance, with live-quote valuation.
No real money, no broker, no Plaid involvement.

## Product Decisions (locked 2026-07-11)

- Fill price: trade form pre-fills the live Finnhub quote, but the user may
  override both price and execution date. Backdated "what if" trades are a
  first-class use case.
- Portfolios: a user can create multiple named sandbox portfolios, each with
  its own starting cash.
- Cash model: each portfolio has a fixed starting cash amount chosen at
  creation (default 100,000.00). Buys are constrained by available cash.
- USD-only in v1. No FX conversion; `currency_rates` machinery is not used.
  Non-US listings are out of scope until quote coverage is verified.
- No shorting, no margin. Positions and cash can never go negative at any
  point in the trade timeline.
- Fractional shares allowed (quantity is numeric, > 0).

## Relationship to Existing Investing Tables

The Plaid-backed tables (`securities`, `investment_holdings`,
`investment_transactions`) are not reused. They require Plaid identifiers
(`plaid_security_id`, `plaid_investment_transaction_id` are unique NOT NULL)
and a real `bank_accounts` row. Sandbox data lives in its own tables and never
mixes with real portfolio data or dashboard/budget math.

## Derivation Rule

Only portfolios and trades are stored. Everything else is derived on read:

- `cashBalance = startingCash + Σ(sell proceeds) − Σ(buy costs)`
- Holdings: replay trades per symbol ordered by `(executed_at, created_at)`;
  position quantity and average-cost basis fall out of the replay.
- Unrealized gain: `quantity * livePrice − openCostBasis`
- Realized gain: on each sell, `(sellPrice − avgCost) * quantity`, accumulated.

This mirrors the existing rule that spent-so-far is derived from transactions,
never stored on `budgets`. No holdings snapshot table, no stored cash column.

## `sandbox_portfolios`

Columns:

- `id` uuid PK
- `user_id` text FK -> user.id NOT NULL
- `name` text NOT NULL
- `starting_cash` numeric(14,2) NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Constraints and indexes:

- unique `(user_id, name)`
- index on `user_id`

Deleting a portfolio hard-deletes its trades (cascade). Sandbox data is
disposable by definition.

## `sandbox_trades`

Columns:

- `id` uuid PK
- `portfolio_id` uuid FK -> sandbox_portfolios.id ON DELETE CASCADE NOT NULL
- `user_id` text FK -> user.id NOT NULL
- `symbol` text NOT NULL (uppercased ticker, e.g. `AAPL`)
- `side` text NOT NULL (`buy` | `sell`)
- `quantity` numeric(18,8) NOT NULL (> 0)
- `price` numeric(12,4) NOT NULL (>= 0)
- `executed_at` timestamptz NOT NULL (user-editable; defaults to now)
- `note` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

Constraints and indexes:

- index on `(portfolio_id, executed_at)`
- index on `user_id`

No fees in v1 (deferred; add a nullable `fees` column later if wanted).

## Trade Validation (timeline replay)

Because trades can be backdated, point-in-time checks against current state
are insufficient. On every trade insert or delete, the server replays the
portfolio's full trade list ordered by `(executed_at, created_at)` including
the proposed change, and rejects the mutation if at any step:

- cash would go negative (buy exceeding available cash at that moment), or
- any symbol's position quantity would go negative (selling shares not held
  at that moment).

Replay happens inside the tRPC mutation; trade volumes per portfolio are small
enough that this stays cheap.

Trades are deletable (sandbox = freely editable history), guarded by the same
replay validation so removing an old buy cannot strand a later sell.

## Quotes and Symbol Lookup

Extend `src/server/market/quotes.ts` (Finnhub, `FINNHUB_API_KEY`):

- `getQuote(symbol)` — single-symbol `/quote` fetch reusing the existing
  5-minute in-memory cache and stale-serve behavior; no longer limited to the
  static top-20 list.
- `searchSymbols(query)` — Finnhub `/search` for the add-stock flow, filtered
  to common stock results; short in-memory cache keyed by query.

A quote returning price `0` (unknown symbol) fails symbol validation at trade
time. Valuation of existing holdings degrades gracefully: positions with no
available quote show cost basis and a missing-price notice, matching the
`/investments` pattern.

## API Surface (tRPC `sandbox` router)

All `protectedProcedure`, all portfolio access checked against `ctx.userId`:

- `sandbox.listPortfolios` — portfolios with derived cash/market-value summary
- `sandbox.createPortfolio({ name, startingCash })`
- `sandbox.renamePortfolio({ id, name })`
- `sandbox.deletePortfolio({ id })`
- `sandbox.getPortfolio({ id })` — derived holdings (quantity, avg cost,
  live price, market value, unrealized gain), cash balance, realized gain,
  total return vs starting cash
- `sandbox.listTrades({ portfolioId })`
- `sandbox.placeTrade({ portfolioId, symbol, side, quantity, price, executedAt, note? })`
- `sandbox.deleteTrade({ id })`
- `sandbox.searchSymbols({ query })`
- `sandbox.getQuote({ symbol })` — for pre-filling the trade form

## UI

- New page `src/pages/sandbox.tsx`, modeled on `src/pages/investments.tsx`:
  - portfolio switcher + create-portfolio dialog
  - summary tiles: market value, cash, total value, total return ($ and %)
  - holdings table: symbol, quantity, avg cost, live price, market value,
    unrealized gain, day change where available
  - trade history table with delete action
  - "New trade" flow: symbol search → live quote shown → side/quantity/price
    (pre-filled, editable)/date (pre-filled now, editable) → cost preview →
    confirm; server validation errors surface inline
- Nav: enable a "Sandbox" item in `src/components/dashboard/nav.ts`.
- Visual language follows the existing token system (ink/bone/brass/sage/oxide)
  and shadcn primitives. A clear "paper trading — not real money" marker on
  the page.

## Explicitly Deferred

- Fees/commissions and dividends
- Shorting, margin, options
- Non-USD listings and FX conversion
- Portfolio performance time-series chart (needs historical prices, a
  different Finnhub endpoint and cache strategy)
- Comparing sandbox performance against a benchmark (SPY etc.)
- Any interaction between sandbox data and real dashboard/budget/investment
  surfaces
