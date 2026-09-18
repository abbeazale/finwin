# FinWin Resources

## Key Files

- `scripts/databento-probe.py` — bounded historical sample evaluation; `python3 scripts/databento-probe.py --offline` rechecks cached data without credentials. Online estimates/downloads use `DATABENTO_API_KEY` from the environment. Raw data is ignored under `.local/databento-probe/`.
- `docs/databento-feasibility.md` — measured sample coverage, estimated costs, validation and remaining live-data/volume limitations.
- `README.md`
- `src/db/schema.ts` — full Drizzle schema (transactions, budgets, investments, categories, bank accounts/connections, auth tables)
- `src/server/trpc/routers/_app.ts` — tRPC root router; add new routers here
- `src/server/trpc/routers/onboarding.ts` — profile completion mutation used by `/onboarding`
- `src/server/trpc/routers/budgets.ts` — monthly budget summary + upsert/delete mutations
- `src/server/trpc/routers/dashboard.ts` — dashboard overview, cashflow, spending-by-category, and recent transaction queries
- `src/server/trpc/routers/investments.ts` — protected investment account, holding, transaction, and sync procedures
- `src/server/trpc/routers/plaid.ts` — all Plaid procedures
- `src/server/trpc/routers/sandbox.ts` — protected paper-trading portfolio, trade, quote, and search procedures
- `src/server/trpc/routers/transactions.ts` — transaction listing query plus category reassignment mutation for `/transactions`
- `src/server/lib/category-taxonomy.ts` — canonical category/group names, default category constants, and seed taxonomy
- `src/server/investments/values.ts` — investment display math, gain/loss suppression, and cash-impact helpers
- `src/server/investments/fx.ts` — Open Exchange Rates refresh/cache helper and USD FX lookup
- `src/server/market/quotes.ts` — Finnhub quote/search client with cache and stale fallback
- `src/server/sandbox/values.ts` — deterministic trade replay, cash, holdings, and P&L calculations
- `src/server/lib/category-map.ts` — Plaid PFC → our category name mapping (TS const)
- `src/server/plaid/crypto.ts` — application-layer AES-256-GCM encryption/decryption for Plaid access tokens
- `src/server/plaid/sync.ts` — Plaid bank transaction sync and stable investment-sync re-exports
- `src/server/plaid/sync-investments.ts` — Plaid security, holding, and investment transaction sync
- `src/lib/budget-status.ts` — shared budget status type and labels
- `src/lib/name.ts` — shared name normalization helper
- `src/components/dashboard/nav.ts` — shared dashboard nav items and active-route helper
- `src/components/dashboard/metrics.tsx` — dashboard metric cards, formatting, and deterministic signal copy
- `src/components/budgets/budget-components.tsx` — budget category cards, add-category UI, chart modal, and presentation helpers
- `src/server/dashboard/initial-month.ts` — server-only initial dashboard month selection
- `src/styles/globals.css` — global theme tokens and reusable CSS primitives
- `src/pages/index.tsx` — signed-out marketing page with live stock ticker and signed-in routing
- `src/pages/dashboard.tsx` — main dashboard; Budget Progress now reads from `budgets.summary`
- `src/pages/budgets.tsx` — monthly budgets desk with Recharts via the retained shadcn chart wrapper
- `src/pages/investments.tsx` — read-only real investment accounts surface
- `src/pages/sandbox.tsx` — multi-portfolio paper-trading sandbox
- `src/pages/transactions.tsx` — production transaction ledger view with filters, uncategorized nudge, and inline category reassignment
- `src/pages/settings/security.tsx` — passkey enrollment and TOTP setup surface
- `src/pages/two-factor.tsx` — TOTP / backup-code challenge page for password sign-in when 2FA is enabled
- `docs/spec/budgets.md` — monthly budgets product spec and query rules
- `docs/plan/budgets.md` — phased implementation plan for the first budgets milestone
- `docs/spec/dashboard-analytics.md` — Phase 3 dashboard analytics spec
- `docs/plan/dashboard-analytics.md` — Phase 3 implementation plan for replacing dashboard placeholders with live data
- `docs/spec/plaid-token-encryption.md` — focused security spec for replacing plaintext Plaid access-token storage
- `docs/spec/investments-real-accounts.md` — Phase 6a real investment accounts overview and order
- `docs/plan/investments-real-accounts.md` — Phase 6a implementation order and final verification
- `docs/spec/investments-schema-accounts.md` — investment account nickname and storage schema spec
- `docs/plan/investments-schema-accounts.md` — completed schema/accounts implementation plan
- `docs/spec/investments-plaid-sync.md` — Plaid Investments import behavior, signs, and webhooks
- `docs/plan/investments-plaid-sync.md` — completed implementation plan for holdings and investment transaction sync
- `docs/spec/investments-api-ui.md` — protected investment API and `/investments` page contract
- `docs/plan/investments-api-ui.md` — investment read API/UI implementation plan
- `docs/spec/investments-fx-rates.md` — USD aggregation and FX cache rules
- `docs/plan/investments-fx-rates.md` — investment FX implementation plan
- `src/pages/settings/connections.tsx` — bank connection management
- `docs/future.md` — deferred ideas and known gaps
- `docs/plan/plaid-integration.md` — Plaid integration phased plan (complete)
- `docs/spec/plaid-integration.md` — Plaid integration spec (complete)
- `drizzle/` — migration files

## Commands

- `bun install`
- `bun run dev`
- `bun run build`
- `bun run lint`
- `bun run knip` — unused-file/export scan; Tailwind and shadcn tooling are intentionally ignored in `knip.json`
- `bunx madge --circular --extensions ts,tsx --ts-config tsconfig.json src` — circular dependency scan
- `bun test` — Bun unit/characterization suite
- `bun run db:migrate` — non-destructive Drizzle migrator; apply pending migrations and verify journal completeness
- `bun run dbreset` — drops and remigrates the DB (non-production only)
- `bun run seed` — idempotent category seed; run once against a fresh DB before testing sync

## Integrations

- Better Auth — email/password + GitHub + Google social login, passkeys, and TOTP two-factor
- Better Auth Passkey — `@better-auth/passkey` plugin with WebAuthn user verification required
- Neon / Postgres — serverless WebSocket pool (`drizzle-orm/neon-serverless`)
- Drizzle ORM and drizzle-kit
- Plaid — account linking, cursor-based transaction sync, webhook verification (ES256 JWT)
- Plaid token encryption — server-side AES-256-GCM with versioned env-provided keys
- Plaid Investments — securities, holdings, and investment transaction import
- Finnhub — landing ticker, sandbox quotes, and symbol search via `FINNHUB_API_KEY`
- Open Exchange Rates — investment FX cache for USD aggregation via `OER_KEY`; internal refresh route uses optional `FX_REFRESH_SECRET`
- tRPC v11 + TanStack Query v5 — all app data routes; webhook stays as plain Next API route
- Zod v4 — tRPC input validation
- shadcn/ui via `components.json`; only actively imported generated components are kept in `src/components/ui`

## Router Conventions

- Product pages → `src/pages/` (Pages Router). New pages go here.
- Root route → `src/pages/index.tsx`, marketing for signed-out visitors and routing for signed-in users.
- tRPC API → `src/pages/api/trpc/[trpc].ts`
- Plaid webhook → `src/pages/api/plaid/webhook.ts` (REST, raw body required)
- Internal FX refresh → `src/pages/api/internal/fx/refresh.ts` (`POST`, bearer `FX_REFRESH_SECRET` required in production)
- Internal Plaid revocation retry → `src/pages/api/internal/plaid/revocations/retry.ts` (`POST`, bearer `PLAID_REVOCATION_RETRY_SECRET` required outside local). Due rows also retry on connection-list, transaction-sync, and webhook traffic because Hobby cannot schedule Vercel Cron.
- App data mutations/queries → add procedures to `src/server/trpc/routers/`
- Current product pages include `/dashboard`, `/transactions`, `/budgets`, `/investments`, `/sandbox`, `/settings/connections`, `/settings/security`, and `/two-factor`.
- `/investments` is the read-only real investment accounts page.

## Notes

### Screener data research, 2026-09-15

- [Accepted screener design](spec/stock-screener.md), confirmed 2026-09-16, records the interview decisions, $50 USD/month ceiling, replay fallback, and feasibility/acceptance checks. Provider feasibility remains unverified.
- FMP is provisionally selected for screener design. Subscription tier and permission to display data to customers remain open; alternatives below are research only.
- Owner account check: user reports FMP Basic access at 250 calls/day with EOD historical, profile and reference data. This does not establish access to the designed intraday inputs. Databento historical minute bars are the recommended next evaluation for the accepted replay fallback; live-provider selection is unchanged pending evaluation. Estimate a bounded stock/ETF sample plus daily history before consuming signup credits, and verify the selected feed's volume coverage.
- Budget review 2026-09-16: free preferred, $50 USD/month ceiling. [Databento stocks](https://databento.com/stocks) confirms credits can offset historical or live subscription costs; current US-equities live recurring price under this ceiling has not been established. Its US Equities Mini advertises free redistribution with an active subscription, subject to the specific feed's coverage/terms. FMP free remains EOD; its pricing lists one-minute intraday charting in Ultimate. Neither provider has been demonstrated to meet the full selected screener scope at this budget. Annual-equivalent prices are not month-to-month commitments.
- FMP feasibility check: [cycle times](https://site.financialmodelingprep.com/developer/docs/cycle-times) labels screener and intraday indicators real-time and daily indicators daily, without a numerical 60-second guarantee. [One-minute candles](https://site.financialmodelingprep.com/developer/docs/stable/intraday-1-min) are documented, enabling local indicators in principle; full-universe throughput, timestamp semantics, regular-hours selection, adjustments and ETF completeness need real-data evaluation. No built-in same-time relative-volume endpoint was verified.
- FMP pricing discrepancy: a later official-page fetch displayed Ultimate at $99/month billed annually, differing from $149 in the earlier fetch below. One-minute charting is listed in Ultimate. Recheck selected billing/configuration before any budget decision; neither is a commercial FinWin quote.
- [Databento credits FAQ](https://databento.com/docs/faqs/usage-pricing-and-data-credits): $125 signup credit per team, expires after six months; can cover historical data or first subscription month. This is not a recurring free tier. [Pricing](https://databento.com/pricing) and publisher-specific terms still govern live access and redistribution.
- [FMP pricing](https://site.financialmodelingprep.com/developer/docs/pricing), checked 2026-09-15: free Basic is listed as end-of-day with 250 calls/day and 500 MB per rolling 30 days. Paid Starter/Premium/Ultimate are labeled real-time, showing $22/$59/$149 per month billed annually. Display or redistribution requires a specific agreement. [Stock screener endpoint](https://site.financialmodelingprep.com/developer/docs/stable/search-company-screener) supports price, volume, market-cap and sector filters, but its generic free-real-time copy conflicts with the plan table. Endpoint entitlement, refresh cadence, and commercial price remain unverified.
- [Alpha Vantage documentation](https://www.alphavantage.co/documentation/): candidate combining historical/intraday prices, indicators, fundamentals, news/sentiment, and premium real-time quotes in batches of up to 100 symbols. [Free usage](https://www.alphavantage.co/support/) is 25 requests/day. [Terms](https://www.alphavantage.co/terms_of_service/) default to personal non-commercial use absent written agreement; customer-facing FinWin pricing is unresolved. Bulk quotes do not eliminate per-symbol historical/indicator ingestion requirements.
- [Alpha Vantage premium](https://www.alphavantage.co/premium/), official public pricing form checked 2026-09-15: $49.99/month for 75 requests/minute and 15-minute delayed US data; $99.99/month for 150 requests/minute and real-time US data; $149.99/month for 300 requests/minute and real-time US data. No daily limits; data entitlement steps still apply. These are personal-use prices, not FinWin commercial quotes.
- [Massive pricing](https://massive.com/pricing): individual plans list $0 end-of-day, $29/month 15-minute delayed with five years of history, $79/month with ten years, and $199/month real-time. These are not commercial display quotes.
- [Alpaca market data](https://docs.alpaca.markets/us/docs/about-market-data-api): individual Trading API free real-time feed is IEX-only; $99/month includes all US exchanges. Customer-facing use needs separate entitlement review.
- [Twelve Data business](https://twelvedata.com/pricing-business): Venture advertises external display and shows a $499/month configuration, while the comparison table says from $149/month. Confirm actual configuration and exchange rights before budgeting; neither number is an accepted FinWin quote.
- [Twelve Data usage terms](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage): commercial display remains subject to exchange licensing requirements.

### Engineering notes

- Prefer `bun run db:migrate` for retained databases; reserve `bun run dbreset` for disposable local data.
- Run `bun run seed` after a fresh migrate or `dbreset` — migrations don't seed categories.
- tRPC context carries `userId: string | null`; all protected procedures enforce non-null via `protectedProcedure`.
- Canonical product sign convention: positive = money in, negative = money out.
- Plaid raw provider amounts may use the opposite convention; sync should normalize before persistence.
- Investment transactions are separate from bank transactions and preserve Plaid raw `plaid_amount`; display cash impact is derived on read as `-plaid_amount`.
- `bank_accounts.is_active=false` marks accounts from unlinked connections. Transactions stay for historical budgets.
- `src/app` is intentionally gone; keep routing in Pages Router unless the project deliberately migrates.
- `bank_accounts.nickname` is user-owned display metadata. Plaid sync owns `bank_accounts.name` and should not overwrite nicknames.

### Historical screener implementation, 2026-09-16

- `/screener` uses `src/server/trpc/routers/screener.ts` and pure `src/server/screener/replay.ts`; `src/server/screener/cache.ts` verifies the pinned local minute sample before loading it. All signed-in accounts have access, with no owner environment variable.
- [Replay calculation contract](spec/screener-replay-calculations.md) covers timestamps, SMA, sparse bars, unadjusted prices and the bounded [NYSE calendar](https://www.nyse.com/publicdocs/nyse/ICE_NYSE_2026_Yearly_Trading_Calendar.pdf).
- `bun scripts/check-screener-replay.ts` verifies real sample math and tRPC access. `bun test scripts/screener-page.test.ts` verifies rendered result/error markup. The latter is a local test and must not be committed.
- No data is bundled for deployment. Restore the original ignored `.local/databento-probe/` cache on a local server to run the preview. A deployed cache-distribution solution and customer display rights remain separate work.

### Replay indicators, 2026-09-16

- Daily SMA/RSI read the pinned `summary-daily.jsonl` only when required. One-minute/five-minute SMA/RSI and relative volume use `mini-minute.jsonl`. No new downloads or credentials.
- `scripts/screener-indicator-oracle.py` independently calculates indicators with Python Decimal; `bun scripts/check-screener-replay.ts` runs it and compares actual app results. Python 3.10+ with New York timezone data is required.
- RSI uses Wilder smoothing with explicit gap reseeding and a flat value of 50. Relative volume uses exactly 20 previous MINI session prefixes. Definitions and calendar/TA-Lib reference links are in the [calculation contract](spec/screener-replay-calculations.md).
