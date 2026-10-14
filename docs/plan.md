# FinWin Plan

## Thesis

FinWin should help users move from raw transaction noise to understandable financial actions, with budgeting clarity first and real-account plus paper-trading tools built on deterministic financial logic.

## Current Direction

- The [stock screener design](spec/stock-screener.md) was accepted on 2026-09-16 after questions 1 through 34 and final shared-understanding confirmation. Stock/ETF research is a main FinWin workflow alongside budgeting and paper trading, without mandatory bank linking. The signed-in replay currently covers five instruments; the working tree includes independently optional SMA, RSI, relative volume, price range, daily change, historical news and shares metadata. News depends on Finnhub; shares metadata currently uses outstanding shares, not accepted public float. All enabled conditions must match, with missing-data exclusions and provenance visible. See the [calculation contract](spec/screener-replay-calculations.md) for the original numerical slice and [current chart plan](plan/screener-charts.md) for the next increment. Existing raw-data/indicator checks and typecheck pass; new UI controls need signed-in browser acceptance. The prior full release gate stopped at this checkout's Next.js dependency audit; the separate login checkout's repair is not proof that this branch passes. Next work is the selected-stock chart, followed by larger historical replay coverage. Live budget and full-universe coverage remain open.
- The design includes all-condition saved screens, one-minute/five-minute/daily completed-candle indicators, SMA presets 9/20/200, RSI and same-time relative volume, research/news panels, named watchlists and existing paper-trade handoff. Regular-session results refresh every 60 seconds while visible, with explicit stale and closed-market states.
- FMP is provisional and replaceable. Prefer free access or credits, with a $50 USD/month data ceiling. The user accepts a clearly labeled historical-replay prototype if suitable live access does not fit; the full-market live one-minute target remains unverified. No subscription or annual commitment is selected.
- Roll out to the owner first, then an invited group after five trading sessions of personal acceptance plus live-data and display-rights checks. Desktop-first editing with mobile results/research/watchlists is accepted. Paid public pricing and billing remain deferred; draggable panels are a v2 direction.

- Next.js (Pages Router), Better Auth, Drizzle + Neon, tRPC v11, TanStack Query v5.
- Better Auth now supports email/password, GitHub, Google, passkey sign-in, and TOTP two-factor enrollment.
- Plaid integration is complete — accounts link, transactions sync with auto-categorization, connections managed via `/settings/connections`.
- All app data routes use tRPC. Plaid webhook stays as a plain REST route.
- Routing is Pages Router only. `/` serves a signed-out marketing page with live Finnhub quotes and routes signed-in users into onboarding or the dashboard.
- The paper-trading sandbox is shipped; current work is hardening the existing budgeting, investment, and sandbox surfaces.
- Improve audit findings 1–12 from `docs/ImproveAudit/2026-07-14-codebase-audit.md` are implemented on `improve-audit-batch-1` (auth upgrade, timezone validation, webhook body limits, safe migrate, characterization tests, dashboard currency scoping, ledger pagination, recent strong auth for bank mutations, batched Plaid upserts, knip/lint baseline, landing ticker TTFB, and fresh-clone docs).
- Phase 6a implementation is complete through schema, Plaid import, read API/UI, and FX conversion; live Plaid investment-account verification remains.
- Active hardening pass before real-bank rollout: stored Plaid access tokens now move to encrypted-only storage with a disposable-db reset path for rollout/testing.

## Screener scope clarification — 2026-09-20

- User selected all US exchange-listed common stocks for the market expansion. Retain ETFs as a separate option; keep regular trading hours. Other countries, OTC and other asset classes remain deferred.
- All filters should be independently optional. Prioritize optional SMA, price range and daily change while retaining RSI and relative volume. Float and recent-news filters require additional data integrations.
- The runtime still supports only its pinned five-symbol replay cache. Verify a maintained listing universe, historical coverage, minute/daily data, same-time volume history, corporate actions and costs before claiming full-market support. Existing $50 USD/month ceiling remains unchanged; no new subscription or download was authorized by this scope note.
- See [screener design](spec/stock-screener.md) for the updated filter and coverage requirements. This is a planning update, not a completed implementation.

## Project review and next steps — 2026-10-04

- User clarified that the requested charts are stock charts in `/screener`, and selected a larger historical replay universe before current market data. Implementation order below is proposed, not yet implemented or separately accepted.
- The working tree already includes independently optional SMA, price range, daily change, RSI, relative volume, historical news and a shares-based filter. Earlier next-step notes about implementing optional SMA/price/change are superseded by this code review. News depends on Finnhub access; the local SEC cache contains outstanding shares, not the public float required by the spec. Correct that filter's claim or source before calling public-float support complete.
- The review initially recommended a candlestick/volume chart with SMA and RSI and one-minute/five-minute/daily views. The subsequent planning below supersedes that proposal: user corrected SMA to EMA, selected full-width below results, and daily candles now require a distinct source check. Preserve raw OHLCV and no-lookahead rules; no additional download is needed for the first intraday charts.
- Recommended second increment: replace the hardcoded five-symbol contract with a validated instrument catalog and dataset manifest. Estimate a representative 100–500-stock batch, then ingest after an explicit download budget is set; verify daily warmup, 20-session volume history, sparse-symbol exclusions, symbol eligibility, memory and query times before moving to full US common-stock coverage. ETFs remain a separate option. Downloads, subscriptions and provider selection are not authorized by this planning review.
- Saved screens and watchlists remain useful after the chart/data increments. Replay-to-paper-trade handoff needs a historical execution and valuation decision because the existing sandbox uses current quotes for valuation.
- Verification performed on the actual working tree: `bun run typecheck` passed; `bun scripts/check-screener-replay.ts` passed 50 raw SMA comparisons and 45 independent indicator cases, plus temporal/gap/calendar/auth checks. No browser acceptance or full release-gate run was performed in this review.

## Screener chart planning — 2026-10-04

- User selected charts next, full-width below results, independent controls, EMA rather than SMA, separate EMA 9/20/200 toggles, intervals including 1m/10m/daily, and regular-hours daily data with shorter history. [Chart specification](spec/screener-charts.md) and [implementation plan](plan/screener-charts.md) define the draft. Proposed interval set is 1m/5m/10m/15m/30m/1h/Daily; chart-native presets follow it while inherited indicators can retain labeled fixed overrides.
- Chart candles and indicators derive from verified MINI minute bars, including regular-session daily aggregation. No SUMMARY substitution; daily EMA 200 initially lacks history. Existing daily screen context uses its actual SUMMARY source and cannot be equated with chart daily values across feeds. The coordinated SMA-to-EMA screening change is proposed with new independent proof; source changes are not incidental.
- Preserve OHLCV and add shared EMA/RSI semantics first, coordinate the screener EMA correction, expose the bounded authenticated chart query, then integrate/verify the panel. No new download, key, database migration or subscription is needed.
- Implemented 2026-10-04 after the user accepted all three open proposals (EMA in screening, 5m/15m/30m/1h, lines follow the chart interval). The screen filter is now EMA; the chart panel, `screener.chart` query and checks are in the working tree, uncommitted. Desk restyle and momentum filters were committed first as e28221d and f53acbb. Next recommended increment: the validated instrument catalog and a bounded larger replay universe.

## Screener market data — 2026-10-12

- User wants the screener on several devices, for personal use only, with data up to the last session, and chose to store history on an always-on Linux laptop instead of Neon. Massive replaces the Databento sample. See the [service spec](spec/market-data-service.md) and [plan](plan/market-data-service.md).
- Implemented on branch `market-data-service` and running on the Mac: `market-data/` service (Postgres, daily Massive ingest, float change log, read-only token API), NYSE calendar with early closes and winter time, and the screener reading the API with fixed 60-session intraday and 300-session daily windows. Two years of minute and daily bars for the five symbols are stored locally.
- Next: set up the Linux laptop (systemd units, Tailscale Funnel) and add `MARKET_DATA_URL` and `MARKET_DATA_TOKEN` in Vercel. No owner gate: the user is the only account holder, and Massive's free plan is for individual use.

## Milestone Status

| # | Milestone | Status |
|---|---|---|
| 1 | Auth, schema, and account-link foundations | ✅ Done |
| 2 | Real transaction import and normalization | ✅ Done — Plaid sync + auto-categorization via Plaid PFC map |
| 3 | Transactions page, category reassignment, budgets page, budget-vs-actual | ✅ Done — `/transactions` reassignment, `/budgets`, and dashboard budget progress verified on real synced data |
| 4 | Dashboard analytics wired to real data | ✅ Core shipped — live verification follow-up remains |
| 5 | AI insights | ⏳ Phase 5 |
| 6 | Real investment accounts / portfolio | 🔄 Phase 6a implemented — live Plaid verification remains |
| 7 | Paper-trading sandbox | ✅ Done — deterministic multi-portfolio trading with live Finnhub quotes |

## Phase 6a — Real Investment Accounts

Next tasks in order:

1. **Live Plaid verification** — sync against sandbox/development investment data and confirm holdings replacement, transaction idempotency, inactive-account behavior, and FX exclusions.
2. **Provider data spot-check** — compare `/investments` totals, native currencies, and transaction cash impact against Plaid responses or DB rows.
3. **Production readiness cleanup** — wire the internal OER refresh route to deployment scheduling before production.

### Phase 6a implementation notes

- `bank_accounts.nickname` is nullable and user-owned; Plaid sync continues to own `bank_accounts.name`.
- Investment accounts continue to use `bank_accounts.type = "investment"`.
- `securities`, `investment_holdings`, `investment_transactions`, and `currency_rates` are represented in Drizzle schema and migration `drizzle/0005_vengeful_firelord.sql`.
- Holdings are current snapshots unique by `(account_id, security_id)`, not an append-only ledger.
- Investment transactions store Plaid's raw `plaid_amount`; user-facing cash impact is derived later as `-plaid_amount`.
- User foreign keys use Better Auth's current `text` user IDs.
- New Plaid Link tokens request both `transactions` and `investments`; update-mode Link remains access-token based.
- Investment holdings sync replaces current snapshots per account and removes closed positions.
- Investment transaction sync uses a 730-day first-sync window, 7-day overlap on later syncs, and Plaid pagination.
- `/investments` renders protected live account, holding, and investment transaction data.
- OER-backed FX conversion is server-side. `POST /api/internal/fx/refresh` refreshes cached USD-base rates; production requires `FX_REFRESH_SECRET`.
- Missing price or missing market-value FX excludes holdings from USD market-value totals; missing cost-basis FX suppresses gain/loss without suppressing market value.
- Holding valuation prefers a positive Plaid institution holding price, then falls back to the security close price. Fallback/missing price states are surfaced on `/investments`.

## Phase 3 — Dashboard Analytics Wired To Real Data

Next tasks in order:

1. **Live verification pass** — sanity-check the new dashboard metrics against synced data, especially transfer exclusion, refunds, and inactive-account history.
2. **Keep financial math centralized** — continue reusing `budgets.summary` and shared transaction queries rather than duplicating dashboard calculations.
3. **Keep provisional surfaces out** — AI and unsupported forecasting readouts stay deferred until backed by real implementation.

### Phase 2 completion notes

- `/transactions` page now exists in `src/pages/transactions.tsx`.
- Ledger view now includes inline category reassignment via `transactions.setCategory`.
- Ledger view includes account/date/category/pending filters, inactive-account toggle, pending badge, and uncategorized nudge.
- Server data comes from `transactions.list` in `src/server/trpc/routers/transactions.ts`.
- `budgets.summary`, `budgets.upsertMonthlyBudget`, and `budgets.deleteMonthlyBudget` now exist in `src/server/trpc/routers/budgets.ts`.
- `/budgets` now exists in `src/pages/budgets.tsx`, using shadcn UI composition plus Recharts via the shadcn `chart` component.
- Dashboard Budget Progress now reads from live `budgets.summary` data instead of hardcoded rows.
- Manual verification is complete for create/edit/delete budgets, unbudgeted rows, pending handling, and inactive-account historical spend.

### Phase 3 implementation notes

- Added `dashboardRouter` in `src/server/trpc/routers/dashboard.ts` with:
  - `dashboard.overview`
  - `dashboard.cashflow`
  - `dashboard.spendingByCategory`
  - `dashboard.recentTransactions`
- `/dashboard` now reads live transaction-backed data for:
  - overview KPI strip
  - daily cashflow chart
  - recent ledger card
  - spending-by-category panel
- Dashboard KPI strip remains intentionally limited to 3 cards:
  - inflow
  - outflow
  - net cashflow
- `Savings rate` remains available as a derived metric for secondary copy, not a primary card.
- Watchlist and rotating AI insight placeholders were removed from the dashboard.
- Shared domain constants now live in:
  - `src/server/lib/category-taxonomy.ts` for category/group names and seed taxonomy
  - `src/lib/budget-status.ts` for budget status labels
- Onboarding profile completion now uses `onboarding.complete` tRPC instead of a separate REST API route.
- Build verification complete:
  - `bunx tsc --noEmit`
  - `bunx eslint src/pages/dashboard.tsx src/server/trpc/routers/dashboard.ts src/server/trpc/routers/_app.ts`

### Current spec reference

- Budgeting spec: `docs/spec/budgets.md`
- Budgeting implementation plan: `docs/plan/budgets.md`
- Dashboard analytics spec: `docs/spec/dashboard-analytics.md`
- Dashboard analytics implementation plan: `docs/plan/dashboard-analytics.md`
- Plaid token encryption spec: `docs/spec/plaid-token-encryption.md`
- Investment accounts overview: `docs/spec/investments-real-accounts.md`
- Investment accounts plan: `docs/plan/investments-real-accounts.md`
- Investment schema/accounts spec: `docs/spec/investments-schema-accounts.md`
- Investment schema/accounts plan: `docs/plan/investments-schema-accounts.md`
- Investment Plaid sync spec: `docs/spec/investments-plaid-sync.md`
- Investment Plaid sync plan: `docs/plan/investments-plaid-sync.md`
- Investment API/UI spec: `docs/spec/investments-api-ui.md`
- Investment API/UI plan: `docs/plan/investments-api-ui.md`
- Investment FX spec: `docs/spec/investments-fx-rates.md`
- Investment FX plan: `docs/plan/investments-fx-rates.md`

### Security hardening notes

- Auth MFA baseline is in place:
  - passkeys use Better Auth's `@better-auth/passkey` plugin
  - WebAuthn user verification is required so passkey sign-in can stand alone
  - TOTP two-factor is available as the second factor for password sign-in
  - `/settings/security` is the first enrollment surface
- Plaid token storage now targets encrypted-only DB columns:
  - `access_token_encrypted`
  - `access_token_key_version`
- Current rollout assumption is disposable data:
  - `bun run dbreset`
  - `bun run seed`
  - create a fresh account and reconnect Plaid
- This avoids preserving plaintext-token rows while the product is still in pre-rollout mode.

### Key design decisions (locked)
- Budget period: monthly, 1st of month. Custom start day → `docs/future.md`.
- Canonical transaction semantics are account-based: money in positive, money out negative. Provider amounts should be normalized on sync.
- Pending included in budget math. Posted/pending filter toggle → `docs/future.md`.
- Transfers: `defaultBudgetable=true`. Credit Card Payment: `defaultBudgetable=false`.
- Uncategorized: `defaultBudgetable=false`, excluded from budget math until reassigned.
- Inactive accounts hidden by default in tx page; "include inactive" toggle.
- Category reassignment does not persist merchant rules yet.
- The root marketing surface is live for signed-out users and uses Finnhub quotes with a static fallback ticker.
- Investment transaction semantics preserve Plaid raw cash amount as `plaid_amount`; display cash impact is derived as `-plaid_amount`.

## Success Signals

- Users can sign in, connect accounts, import transactions, and see budget vs actual on real data.
- Core financial views no longer depend on placeholders or demo-only assumptions.

## Deferred Items

See `docs/future.md` for the full list. Notable ones:
- Custom budget period start day (settings)
- Merchant-rule persistence on category reassignment
- Posted/pending filter toggle on transactions page
- Recurring-spend detection on dashboard
- Custom dashboard ranges beyond calendar-month view
