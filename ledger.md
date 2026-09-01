# FinWin Ledger

## 2026-08-31

### Pilot-to-paid Batch 2B implemented

- Replaced the ambiguous `active` / `error` connection status with `linked`,
  `syncing`, `ready`, and `sync_failed`, backed by database constraints that
  require an error code only for failed syncs.
- Token exchange now returns a typed first-import outcome. Dashboard and
  Connections messages report failed imports as failures instead of showing a
  successful link above an empty ledger.
- Added retry actions for failed and unfinished imports. Transaction,
  investment, and webhook sync entry points now share the persisted state
  transition wrapper.
- Applied `drizzle/0011_bank_connection_sync_state.sql` to the local Neon
  environment. The retained connection backfilled to `ready`; both constraints
  are present.
- A temporary database probe moved `sync_failed` → `ready`, cleared the error,
  and set `last_synced_at`. A forced `syncConnection` exception separately
  persisted `sync_failed` with `UNKNOWN`. Both probe rows were removed. `bun run
  verify` passed with 68 tests, typecheck, lint, knip, audit, security checks,
  and build.
- The collaborative browser compiled and served `/settings/connections`, then
  redirected to `/login` because it had no authenticated local session.

### Pilot-to-paid Batch 2A implemented

- Narrowed the 15-minute recent-auth guard to destructive Plaid connection
  actions. Creating a Link token and exchanging a public token now require a
  valid session through `protectedProcedure`; unlink and reactivation remain on
  `recentAuthProcedure`.
- Removed the dead "Sign in again" links from bank-link and connection error
  messages. Recent-auth failures now tell the user to log out, sign in, and
  retry because `/login` redirects an existing session without creating a new
  strong-auth timestamp.
- Updated the recent-auth policy spec, project plan, resources map, and README.
- Verified with `bun run verify`: 66 tests passed, followed by typecheck, lint,
  knip, production dependency audit, security checks, and a production build.
- `docs/`, `ledger.md`, and `decisions.tsv` remain local and must not be
  committed under the project working rules. The focused recent-auth test was
  part of the requested Batch 2A change.

## 2026-08-29

### Drop Vercel Cron for Hobby

- Deleted `vercel.json`. The only entry was an hourly cron on
  `/api/internal/plaid/revocations/retry`, which Hobby cannot run.
- Due `pending_provider_revocations` now retry on Plaid webhook traffic,
  `plaid.listConnections`, and `plaid.syncTransactions`. The sweep is
  best-effort on those paths so a Plaid outage cannot fail listing, sync, or
  webhook ack.
- `POST /api/internal/plaid/revocations/retry` remains for a manual sweep
  with `PLAID_REVOCATION_RETRY_SECRET`. GET and `CRON_SECRET` are gone.
- Docs updated in `README.md`, `.env.example`, and `docs/resources.md`.

## 2026-08-06

### Gate 1 G1.2–G1.6 implementation handoff

- Opened one draft PR per Linear issue, with independent work based on `main`
  and dependency-bound work kept as a narrow stack:
  - `DEV-42` / G1.2: PR #21, `agent/dev-42-g1-2-environment-contract`
  - `DEV-43` / G1.3: PR #22, `agent/dev-43-g1-3-dependency-audit-policy`
  - `DEV-44` / G1.4: PR #23, `agent/dev-44-g1-4-provider-error-sanitization`
  - `DEV-45` / G1.5: PR #24, based on PR #21
  - `DEV-46` / G1.6: PR #25, based on PR #24
- All five release gates passed locally with 53 tests, typecheck, lint, knip,
  production audit, and production build. G1.6 also passed a production-mode
  runtime header probe; an untrusted Better Auth callback was rejected with 403.
- The auth runtime probe exposed Better Auth default error logging of OAuth state
  and PKCE verifier values through opaque database error arguments. PR #23 was
  amended with a whitelist auth logger and a regression check for that exact
  leak shape.
- Live-domain discovery: `https://finwin.abbeazale.tech` is a redirect alias;
  `https://finwin.abbeazale.com` is the canonical app and must be the sole
  production OAuth/passkey identity origin. The current `.com` deployment lacks
  CSP and exposes `X-Powered-By`; PR #25 adds the policy and deployed checker.
- Vercel previews for PRs #21, #24, and #25 correctly fail closed. The Vercel
  project currently shares `DATABASE_URL` and `PLAID_ENV` between Preview and
  Production and lacks dedicated auth/FX secrets. Do not bypass the contract by
  relabeling the production database. Provision an isolated Neon preview DB,
  scope Plaid sandbox to Preview, install independent preview secrets, then
  redeploy the stack.
- Operational acceptance still required before closing the issues: rotate the
  Plaid secret for DEV-44; execute the staged auth-secret/OAuth-token migration
  for DEV-45; configure `.com` Google/GitHub callbacks and run the fresh-profile
  auth/passkey/TOTP/recent-auth smoke matrix for DEV-46.
- Ordered merge completion: PRs #21, #22, #23, #24, and #25 are merged into
  `main` with merge commits `ae6c6cc`, `5109fdf`, `68c95c8`, `a1dd254`, and
  `a85aa1e`. Branch protection was restored with strict `Release gate`
  enforcement after the merge workaround.
- Vercel Preview deployments for the merged stack are READY, but the first
  production deployment for `a85aa1e` failed closed because production still
  lacks/has invalid `AUTH_TRUSTED_ORIGINS`, `BETTER_AUTH_SECRET(S)`,
  `FINWIN_CANONICAL_ORIGIN`, `FX_REFRESH_SECRET`, `PLAID_WEBHOOK_URL`, and
  `DATABASE_ENVIRONMENT=local`. Fix those Vercel project variables and redeploy
  before treating production acceptance as complete.
- Linear Gate 1 issues DEV-42 through DEV-46 are Done. Gate 2 started with
  DEV-47 (G2.1) moved to In Progress; the Gate 2 milestone remains at 0%.
- `docs/` remained untouched and uncommitted. The unavailable `update-docs` and
  `session-handoff` skills were represented by README changes and this ledger
  handoff; `ledger.md` remains intentionally uncommitted.

## 2026-07-18

### G1.1 frozen release gate implemented

- Implemented Linear `DEV-41` / G1.1 locally:
  - pinned `packageManager` to Bun 1.3.14
  - added `typecheck`, critical production `audit:prod`, and the composed `verify` command
  - added `.github/workflows/release-gate.yml` for PRs and `main` with frozen install and the full gate
  - kept production database migrations out of CI as a separately approved release stage
  - documented release ownership, migration approval, rollback criteria, and post-deploy smoke checks in `README.md`
- Verified with Bun 1.3.14 in both the working tree and an isolated clean-copy install:
  - `bun install --frozen-lockfile`
  - `bun run verify`
  - 53 tests passed, and typecheck, lint, knip, critical production audit, and production build all passed
- The audit threshold is intentionally critical until `DEV-43` / G1.3 remediates the known high-severity findings and tightens policy.
- Acceptance completed on 2026-08-06: merged GitHub PR #20, then configured `main` branch protection to strictly require the GitHub Actions `Release gate` check with administrator enforcement.

### Session handoff

- `DEV-41` is Done in Linear. The implementation is on `main` at merge commit `32ff2f88dbe3769867bed346d267caa80365d76c`; local `bun run verify` and the earlier Bun 1.3.14 clean-copy verification passed.
- Existing personal `docs/` files remain untouched and `ledger.md` remains intentionally uncommitted.
- The dedicated `update-docs` and `session-handoff` skills were unavailable; this README and ledger update records the equivalent documentation and handoff.

### Deployment-prep audit organized in Linear

- Read the Notion `deployment prep` audit dated July 17, 2026 and translated it into the existing Linear `Finwin` project.
- Created 28 issues (`DEV-41` through `DEV-68`) with explicit acceptance criteria, priorities, Notion source links, and blocker relations.
- Organized the work into five Linear milestones:
  - Gate 1 — Secure, reproducible staging (6 issues)
  - Gate 2 — Financial data integrity & recovery (8 issues)
  - Gate 3 — Operable private pilot (5 issues)
  - Gate 4 — Public launch sign-off (8 issues)
  - Post-launch — Scale & performance (1 backlog issue)
- The first unblocked work package is `DEV-41` through `DEV-44`: CI/runtime pinning, typed environment isolation, dependency triage, and provider-log sanitization.
- The final public-launch decision is `DEV-67`; post-launch performance follow-up is intentionally blocked behind it in `DEV-68`.

### Session handoff

- Linear project: https://linear.app/devkettlelabs/project/finwin-ae2404235ea1
- No application code or docs were changed for this planning pass.
- The dedicated `session-handoff` skill was unavailable, so this ledger entry records the equivalent handoff.

## 2026-07-14

### Improve audit fully implemented

- Completed remaining audit findings 5–12 on `improve-audit-batch-1` after the first batch (1–4, 7):
  - dashboard aggregates scoped to profile currency with excluded-row notice
  - transaction ledger offset pagination with previous/next
  - recent strong-auth middleware for Plaid link/exchange/unlink/reactivate (+ `docs/spec/recent-auth.md`)
  - chunked Plaid bank/investment upserts
  - knip + lint zero-exit baseline restored
  - landing ticker stale-while-revalidate + provider timeouts
  - README fresh-clone setup, required/optional env tables, and verification sequence
- Verified: `bunx tsc --noEmit`, `bun run lint`, `bun run knip`, `bun test` (53 pass).
- Direction options from the audit (merchant rules, recurring detection, WorkOS) remain deferred product choices, not defects.

### Session handoff

- Branch `improve-audit-batch-1` holds the full audit implementation; not pushed.
- Recommended human smoke: sign-in freshness for Connect bank, dashboard currency banner, ledger page 2+, cold `/` without waiting on Finnhub.
- Personal docs outside the audit touch (ImproveAudit source, deslop notes, sandbox plan/spec) may still be uncommitted.

### Improve audit batch 1 implemented

- Implemented the recommended first planning batch from `docs/ImproveAudit/2026-07-14-codebase-audit.md` on branch `improve-audit-batch-1` (5 commits, no co-authored trailers):
  1. Better Auth upgrade past GHSA-g38m-r43w-p2q7
  2. Onboarding timezone correction and validation
  3. Plaid webhook body limit
  4. Non-destructive `bun run db:migrate`
  5. Critical-path characterization suite
- Follow-on findings 5–12 were completed later the same day (see entry above).

### Deslop implementation complete

- Implemented the four recommended passes from `docs/deslop.md` in order, with one commit per pass:
  - `1642430` — stop tracking the real ngrok configuration, ignore local tunnel credentials, and add a safe example
  - `7187a3f` — remove stale agent product plans and `CLAUDE.md`, refresh repository truth, and clean configuration/dependency residue
  - `ee76d0a` — centralize protected-page session handling, month/decimal helpers, profile-currency budgets, and sandbox JSX formatting
  - `dfe18e7` — split budget/dashboard presentation responsibilities and investment Plaid sync from bank transaction sync
- Budget totals now use the profile currency, exclude other-currency transactions without implying FX conversion, and surface the excluded count. The initial month uses the saved profile timezone.
- Protected client pages share `useRequireSession()` and suppress protected queries until a session exists.
- `src/server/plaid/sync.ts` retains stable investment-sync re-exports while implementation lives in `sync-investments.ts`.
- Updated `README.md`, `docs/plan.md`, and `docs/resources.md`; `docs/` changes remain uncommitted by project policy.
- Verification was intentionally limited to compilation and runtime startup per request: `bunx tsc --noEmit`, `bun run build`, production server startup, and `GET /` returning 200.
- Account-side ngrok token rotation remains required. The repository copy is removed, but the dashboard browser was unavailable and the local CLI has no ngrok API key configured.

### Session handoff

- Four ordered deslop commits are complete on branch `Deslop`.
- Personal `docs/` files and pre-existing ledger notes remain uncommitted.
- Recommended human verification: budget month/currency behavior, protected-page redirects, sandbox modals/tables, dashboard panels, and both Plaid bank and investment sync paths.

## 2026-07-11

### Sandbox listPortfolios 500 fixed

- Diagnosed `sandbox.listPortfolios` returning 500: the configured database migration journal stopped at `0005`, so `sandbox_portfolios` and `sandbox_trades` did not exist even though the earlier CLI migration command appeared to run.
- Applied pending migrations `0006` and `0007` through Drizzle's runtime migrator.
- Verified both sandbox tables, all cash/side/quantity/price check constraints, and migration journal rows now exist; a direct empty portfolio query succeeds.
- No application code change was required. Refresh `/sandbox` (or restart the dev server if it retained the prior error state).

### Sandbox trading shipped

- Implemented the paper-trading sandbox end to end from `docs/spec/sandbox-trading.md` and `docs/plan/sandbox-trading.md`.
- Added dedicated portfolio/trade tables, ownership indexes, cascade deletion, numeric constraints, and migrations `0006`/`0007`; migrations apply without schema drift.
- Added arbitrary Finnhub quotes and cached common-stock search while preserving the landing ticker behavior.
- Added deterministic timeline replay with average-cost positions, cash enforcement, no shorting, realized/unrealized P&L, and replay validation for inserts and deletes.
- Added the protected `sandbox` tRPC router for portfolio CRUD, trades, live quotes/search, and derived portfolio summaries.
- Added `/sandbox` with multi-portfolio selection, portfolio creation/rename/delete, summary metrics, holdings, missing-quote handling, trade history, and a live-quote-prefilled editable/backdated trade flow. Enabled Sandbox in dashboard navigation.
- Verified `drizzle-kit generate` reports no drift, migrations apply, focused replay scenarios pass, live Finnhub `AAPL` quote/search pass, `bunx tsc --noEmit`, `bun run lint`, `bun run knip`, and `bun run build`.
- Browser automation was unavailable (no browser backend exposed), so a signed-in local click-through remains recommended.

### Session handoff

- Sandbox implementation is complete and available at `/sandbox`.
- No code or docs were committed. Existing personal `docs/` changes and the pre-existing `ledger.md` edit remain in the worktree.
- Recommended final human smoke test: sign in, create a portfolio, buy AAPL, backdate a sell, verify P&L, try an over-cash/over-position trade, and delete a trade that would strand a later sell.

### Sandbox trading spec + plan drafted

- Drafted `docs/spec/sandbox-trading.md` and `docs/plan/sandbox-trading.md` for a paper-trading sandbox (manual stocks + hypothetical trades).
- Product decisions locked with the user:
  - trade form pre-fills the live Finnhub quote, price and execution date editable (backdated what-if trades supported)
  - multiple named portfolios per user, each with its own starting cash (default 100k)
  - buys constrained by available cash; no shorting/margin; fractional shares allowed; USD-only in v1
- Storage: new `sandbox_portfolios` + `sandbox_trades` tables only — Plaid investing tables are not reusable (NOT NULL Plaid IDs, require `bank_accounts`). Holdings, cash, and P&L are always derived by replaying trades, never stored; mutations validated by full timeline replay (no negative cash/position at any point).
- Reuse plan: extend `src/server/market/quotes.ts` for arbitrary-symbol quotes + Finnhub `/search`; new `sandbox` tRPC router; `src/pages/sandbox.tsx` modeled on `/investments`; enable a Sandbox nav item.
- No code written yet — implementation starts at plan Phase 1 (schema).

### Landing page stock ticker shipped

- Replaced the landing page marquee's hardcoded personal-finance stats with a live top-20 US stock ticker (symbol, price, green/red arrow with percent change).
- Added `src/server/market/quotes.ts`: Finnhub `/quote` fetch per symbol with a 5-minute in-memory cache, zod validation, and stale-serve on provider failure. Static top-20 symbol list by market cap.
- `src/pages/index.tsx` fetches quotes in `getServerSideProps` (logged-out path only) and falls back to the old stats marquee when quotes are unavailable (missing key, provider down on cold cache).
- Added `FINNHUB_API_KEY` to `.env` (gitignored) and `.env.example`. No Finnhub webhooks needed — REST polling only.
- Verified:
  - `bunx tsc --noEmit`
  - `bunx eslint src/pages/index.tsx src/server/market/quotes.ts`
  - live Finnhub calls for `AAPL` and `BRK.B` return real quotes with the configured key
  - rendered `/` shows 20 quotes with correct up/down arrows (AAPL down rendered `▼ 0.28%` in oxide)
  - `bun run build`

## 2026-05-06

### Code quality cleanup pass refreshed

- Coordinated eight focused cleanup passes across duplication, shared types, unused code, circular dependencies, weak types, defensive error handling, legacy/fallback code, and stale comments/copy.
- Consolidated category domain constants:
  - `src/server/lib/category-taxonomy.ts` now owns category/group names, default category constants, and seed taxonomy.
  - `scripts/seed-categories.ts`, `src/server/lib/category-map.ts`, `src/server/plaid/sync.ts`, and dashboard analytics now use those constants instead of repeated strings.
- Consolidated budget status labels/types in `src/lib/budget-status.ts` and reused them from server budget summaries and UI surfaces.
- Removed unused assets:
  - `public/github.svg`
  - `public/githubinverted.svg`
- Removed App Router route files and the old marketing/root surface:
  - `src/app/layout.tsx`
  - `src/app/page.tsx`
  - moved global CSS to `src/styles/globals.css`
  - added `src/pages/index.tsx` as the root redirect into `/login`, `/onboarding`, or `/dashboard`
- Replaced legacy REST onboarding write path with `onboarding.complete` tRPC:
  - removed `src/pages/api/onboarding.ts`
  - added `src/server/trpc/routers/onboarding.ts`
  - updated `/onboarding` to call tRPC directly
- Tightened weak-type boundaries with runtime narrowing for Plaid webhook payloads, Plaid/JWT errors, Better Auth 2FA redirect detection, Recharts payload config lookup, and transaction pending filter values.
- Kept justified defensive handling around external APIs, webhook verification, encryption-key parsing, auth flows, and CLI entrypoints. Removed redundant tRPC error-message fallbacks.
- Untangled dashboard nav ownership by extracting shared nav items/active-state logic to `src/components/dashboard/nav.ts`.
- Removed fake/forward-looking copy and disabled future nav items for investments, analytics, portfolio, scenario, forecast, and AI surfaces until those milestones are backed by real code.
- Verified:
  - `git diff --check`
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run knip`
  - `bunx madge --circular --extensions ts,tsx --ts-config tsconfig.json src`
  - `bun run build`
- Build note: Next still warns that it inferred `/Users/abbe` as the workspace root because `/Users/abbe/package-lock.json` exists above the project; build otherwise passes.
- **Next**: live-test the root redirect, onboarding completion, login/social sign-in, and Plaid connect/sync flows in the browser against configured env credentials.

## 2026-05-01

### Dashboard cashflow zero-state fix

- Diagnosed `/dashboard` KPI zeroes with connected accounts:
  - local synced transactions were in April 2026 while the dashboard defaulted to May 2026
  - all local rows were categorized as `Transfer`, which the overview/cashflow query previously excluded
- Updated dashboard server-side initial month selection to use the current profile timezone month when it has transactions, otherwise fall back to the latest month with imported transactions.
- Updated dashboard overview/cashflow inclusion so generic `Transfer` rows count as visible ledger movement; `Credit Card Payment` remains excluded to avoid linked-card double counting.
- Updated `docs/spec/dashboard-analytics.md` and `docs/plan/dashboard-analytics.md` to reflect the revised transfer treatment.
- Verified:
  - local dashboard month fallback resolves May 2026 to April 2026 for the current synced user because May has no transaction rows
  - local April dashboard KPI inputs now return inflow `2755.25`, outflow `0.00`, net `2755.25`
  - `bunx tsc --noEmit`
  - `bunx eslint src/pages/dashboard.tsx src/server/trpc/routers/dashboard.ts`
  - `bun run build`
- Build note: Next still warns that it inferred `/Users/abbe` as the workspace root because `/Users/abbe/package-lock.json` exists above the project; build otherwise passes.

### Session handoff

- `/dashboard` should now open on the latest imported transaction month when the current month is empty.
- Generic `Transfer` rows are now part of overview/cashflow KPI math; `Spend lanes` still excludes the `Transfers` group.
- Existing unrelated worktree changes from the investment/FX pass remain untouched.

### Investment FX and price fallback fix

- Added `POST /api/internal/fx/refresh` to refresh Open Exchange Rates into `currency_rates`.
  - Local development can call it without a secret.
  - Production fails closed unless `FX_REFRESH_SECRET` is configured and supplied as a bearer token.
- Refreshed local OER cache successfully with the configured `OER_KEY`; 172 USD-base rates were cached.
- Updated investment valuation so market value and cost basis convert independently:
  - market value uses the resolved price currency
  - cost basis uses the holding/account reporting currency
  - missing price or market-value FX excludes a holding from USD market-value totals
  - missing cost-basis FX suppresses gain/loss without suppressing market value
- Resolved zero Plaid institution holding prices by falling back to `securities.close_price`.
- Updated `/investments` to show fallback close-price and missing-price states instead of rendering zero as a real price.
- Updated `.env.example`, `docs/plan.md`, `docs/resources.md`, and `docs/plan/investments-fx-rates.md`.
- Verified:
  - local FX refresh helper returned `{"refreshed":true,"reason":null,"rateCount":172}`
  - `curl -X POST http://localhost:3000/api/internal/fx/refresh` returned the same successful refresh result
  - local holding sanity check showed USD close-price market values and CAD cost basis converted via OER
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run build`
- Build note: Next still warns that it inferred `/Users/abbe` as the workspace root because `/Users/abbe/package-lock.json` exists above the project; build otherwise passes.

### Session handoff

- Dev server remains available at `http://localhost:3000`.
- `/investments` should now show nonzero market values for USD holdings whose Plaid holding price is `0.0000` when `securities.close_price` exists.
- Before production, set `FX_REFRESH_SECRET` and wire `POST /api/internal/fx/refresh` to a scheduled job or controlled admin/manual trigger.

## 2026-04-30

### Investment Phase 6a implementation pass

- Implemented the remaining ordered Phase 6a plans after the schema/accounts slice:
  - `docs/plan/investments-plaid-sync.md`
  - `docs/plan/investments-api-ui.md`
  - `docs/plan/investments-fx-rates.md`
- Plaid Link now requests `Products.Investments` for new connections while keeping update-mode Link access-token based.
- Added investment import paths in `src/server/plaid/sync.ts`:
  - shared securities upsert by `plaid_security_id`
  - holdings snapshot replacement per active investment account
  - closed holding removal on re-sync
  - paginated investment transaction import with 730-day first sync and 7-day overlap
  - raw Plaid `plaid_amount` persistence without regular bank transaction sign inversion
- Added Plaid investment webhook dispatch in `src/pages/api/plaid/webhook.ts`:
  - `HOLDINGS` + `DEFAULT_UPDATE`
  - `INVESTMENTS_TRANSACTIONS` + `DEFAULT_UPDATE`
- Added `investmentsRouter` in `src/server/trpc/routers/investments.ts` and registered it in `_app.ts`.
- Added investment math helpers:
  - `src/server/investments/values.ts`
  - `src/server/investments/fx.ts`
- Added `/investments` as the read-only portfolio surface with:
  - sync button
  - account selector
  - inactive-account toggle
  - portfolio summary
  - holdings table
  - investment transaction history
  - missing cost basis, stale price, missing FX, and stale FX notices
- Added `OER_KEY` to `.env.example` and documented Open Exchange Rates in `docs/resources.md`.
- Updated `docs/plan.md`, `docs/resources.md`, and the investment plan files to reflect implementation status.
- Verified:
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run build` with network access for `next/font` Google font fetches
  - `curl -I http://localhost:3000/investments` returned `200 OK`
- Verification limitations:
  - Browser-level Playwright check could not run because `playwright` is not installed in the available Node REPL environment.
  - Live Plaid sandbox/development investment-account sync was not run because valid Plaid credentials/data were not available in this session.
- **Next**: run live Plaid investment verification after credentials are fixed, apply migration/reset as appropriate, connect a sandbox/development investment item, and compare `/investments` against Plaid/DB rows.

### Session handoff

- Dev server is running at `http://localhost:3000`.
- Disposable database was reset with `bun run dbreset` and seeded with `bun run seed`; migration `0005_vengeful_firelord.sql` has been applied locally.
- Existing Plaid credential issue from earlier still matters: replace local `PLAID_CLIENT_ID` / `PLAID_SECRET` / `PLAID_ENV` with a matching valid pair before testing Link.
- The Investments sidebar/mobile-nav item now links to `/investments`.
- Suggested next live-testing flow:
  - create/sign in to a fresh user
  - connect a Plaid sandbox/development investment account
  - inspect `/investments`
- Watch areas during verification:
  - holdings re-sync removes closed positions
  - investment transactions do not duplicate across overlap syncs
  - `plaid_amount` remains raw and UI cash impact is inverted
  - missing/non-USD FX rows stay visible while excluded from USD totals

### Investment schema/accounts milestone complete

- Implemented Phase 6a.1 storage foundation from `docs/plan/investments-schema-accounts.md`.
- Added `bank_accounts.nickname` as nullable, user-owned display metadata. Plaid account sync does not write this field, so provider account names remain sync-owned.
- Added Drizzle schema and migration `drizzle/0005_vengeful_firelord.sql` for:
  - `securities`
  - `investment_holdings`
  - `investment_transactions`
  - `currency_rates`
- Preserved the investment sign contract by naming the transaction cash column `plaid_amount`; FinWin display `cashImpact = -plaid_amount` remains a read-time/API concern.
- Updated `docs/plan.md`, `docs/resources.md`, and `docs/plan/investments-schema-accounts.md` to show Phase 6a as active and schema/accounts as complete.
- Verified:
  - `bunx tsc --noEmit`
  - `bunx eslint src/db/schema.ts`
- **Next**: implement `docs/plan/investments-plaid-sync.md` in order, starting with Plaid `Products.Investments` enablement and shared securities upsert support.

### Investment real-accounts spec split

- Reviewed `docs/spec/investments-real-accounts.md` for the Phase 6a real investment accounts goal.
- Corrected investment transaction sign language: store Plaid raw `plaid_amount`, derive FinWin display `cashImpact = -plaid_amount`, and keep security quantity semantics separate.
- Corrected investment webhook naming to Plaid's `webhook_type` + `webhook_code` shape.
- Kept user FKs aligned with the current Better Auth schema (`text` IDs), rather than introducing UUID user IDs inside the investment spec.
- Replaced institution-name-as-label with a user-owned `bank_accounts.nickname` model; provider account name remains sync-owned.
- Split the oversized spec into focused docs:
  - `docs/spec/investments-real-accounts.md` — Phase 6a overview and order
  - `docs/spec/investments-schema-accounts.md`
  - `docs/spec/investments-plaid-sync.md`
  - `docs/spec/investments-fx-rates.md`
  - `docs/spec/investments-api-ui.md`
- Added matching implementation plans:
  - `docs/plan/investments-real-accounts.md`
  - `docs/plan/investments-schema-accounts.md`
  - `docs/plan/investments-plaid-sync.md`
  - `docs/plan/investments-fx-rates.md`
  - `docs/plan/investments-api-ui.md`
- Marked the plan files with explicit order numbers: overview/final verification `0`, schema/accounts `1`, Plaid sync `2`, API/UI `3`, FX rates `4`.

### Dashboard mobile navigation restored

- Diagnosed the dashboard sidebar disappearing on narrower screens: `DashboardSidebar` was explicitly `hidden` below the `lg` breakpoint and there was no mobile navigation replacement.
- Added a compact `lg:hidden` navigation dropdown to `DashboardHeader` so dashboard navigation remains available on tablet/mobile widths.
- Shared nav item definitions between the desktop sidebar and mobile header menu, and made active-state detection path-based instead of hardcoded to Desk.
- Verified:
  - `bunx eslint src/components/dashboard/sidebar.tsx src/components/dashboard/header.tsx src/pages/dashboard.tsx`
  - `bunx tsc --noEmit`
  - `bun run build`
- Browser automation note: direct Chrome control was blocked by macOS automation permissions (`Apple event error -1743`), so visual verification was limited to deterministic class inspection and build/type checks.

### Plaid link-token 500 diagnosed

- Reproduced the Plaid `plaid.createLinkToken` failure by calling the tRPC procedure locally with a synthetic user context.
- Root cause from Plaid: `INVALID_API_KEYS` (`invalid client_id or secret provided`) for the configured `PLAID_ENV=production`; the same local credentials also failed against sandbox.
- Updated `src/server/trpc/routers/plaid.ts` so `INVALID_API_KEYS` now surfaces an actionable tRPC message that points at `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` instead of the generic "Failed to create link token."
- Verified:
  - `bunx tsc --noEmit`
  - `bunx eslint src/server/trpc/routers/plaid.ts`
- **Next**: replace the local Plaid credentials with a matching `client_id`/secret/environment pair, restart the dev server, then retry Connect bank.

## 2026-04-29

### Code quality cleanup pass shipped

- Coordinated eight focused cleanup passes across duplication, shared types, unused code, circular dependencies, weak types, defensive error handling, legacy code, and stale comments.
- Added Knip as repo tooling with `bun run knip` and `knip.json`; current scan passes with Tailwind/shadcn tooling intentionally ignored.
- Removed unused generated UI wrappers and orphan files:
  - `src/components/ui/badge.tsx`
  - `src/components/ui/button-group.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/field.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/label.tsx`
  - `src/components/ui/progress.tsx`
  - `src/components/ui/separator.tsx`
  - `src/components/ui/skeleton.tsx`
  - `src/features/connections/plaid/plaid.ts`
  - `src/login/page.jsx`
  - `src/server/db/schema.ts`
- Moved Plaid category mapping from `src/server/trpc/category-map.ts` to `src/server/lib/category-map.ts` so Plaid sync no longer depends on a tRPC module.
- Consolidated reusable server helpers:
  - month input validation/date math in `src/server/lib/month.ts`
  - money serialization in `src/server/lib/money.ts`
  - Plaid encrypted-token row decryption in `src/server/plaid/crypto.ts`
  - Plaid API error extraction in `src/server/plaid/errors.ts`
- Tightened type contracts by deriving client page shapes from `RouterOutputs` and replacing unsafe Plaid error/JWK casts with guarded helpers.
- Removed stale/noisy comments and preserved comments only where they explain integration contracts or non-obvious financial behavior.
- Verified:
  - `bunx tsc --noEmit`
  - `bun run lint`
  - `bun run knip`
  - `bunx madge --circular --extensions ts,tsx --ts-config tsconfig.json src`
  - `bun run build`
- Build note: Next still warns that it inferred `/Users/abbe` as the workspace root because `/Users/abbe/package-lock.json` exists above the project; build otherwise passes.

## 2026-04-22

### Better Auth passkey + TOTP MFA baseline shipped

- Upgraded Better Auth from `1.5.4` to `1.6.7` and installed `@better-auth/passkey`.
- Added Better Auth plugins:
  - `passkey` with FinWin RP metadata and `userVerification: "required"` so passkey sign-in can stand alone
  - `twoFactor` with issuer `FinWin` and passwordless-account management allowed for social/passkey users
  - existing Better Auth dashboard plugin kept in place
- Added MFA schema support:
  - `user.twoFactorEnabled`
  - `passkey` table
  - `twoFactor` table
  - migration `drizzle/0004_auth_mfa.sql`
- Updated Drizzle migration journal to include existing `0003_plaid_sync_hardening` and new `0004_auth_mfa`.
- Added client plugin wiring in `src/lib/auth-client.ts`.
- Added passkey sign-in to the login form, including WebAuthn conditional UI autocomplete attributes.
- Added `/settings/security` as the first enrollment surface for passkeys and TOTP setup.
- Added `/two-factor` for TOTP and backup-code verification after password sign-in.
- Product policy locked: passkey sign-in is sufficient by itself; TOTP is the additional challenge for password sign-in and backup access.
- Verified:
  - `bunx tsc --noEmit`
  - `bunx eslint src/lib/auth.ts src/lib/auth-client.ts src/db/schema.ts src/components/auth/loginForm.tsx src/pages/settings/connections.tsx src/pages/settings/security.tsx`
- **Next**: apply the new migration, then browser-test passkey enrollment/sign-in on the real app origin.

## 2026-04-21

### Plaid connect JSON parse failure fixed

- Reproduced the `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` error on `plaid.createLinkToken`.
- Root cause: the tRPC API route imported Plaid crypto at module load, and malformed `PLAID_TOKEN_ENCRYPTION_KEYS` caused Next.js to return an HTML 500 error page before tRPC could serialize JSON.
- Normalized local Plaid token encryption env shape to versioned JSON (`current version` + key map).
- Made `src/server/plaid/crypto.ts` load encryption keys lazily so invalid encryption config fails inside Plaid token use paths instead of breaking the entire tRPC route import.
- Converted `src/lib/trpc.ts` to `src/lib/trpc.tsx` to satisfy React provider children typing and lint rules.
- Updated `.env.example` to show the required versioned encryption-key shape.
- Verified:
  - `bunx tsc --noEmit`
  - `bunx eslint src/server/plaid/crypto.ts src/lib/trpc.tsx src/components/connect-bank.tsx 'src/pages/api/trpc/[trpc].ts'`
  - `POST /api/trpc/plaid.createLinkToken?batch=1` now returns JSON instead of an HTML error page.
- Dev server is running at `http://localhost:3000`.

## 2026-04-16

### Plaid token encryption implementation pass shipped

- Replaced plaintext `bank_connections.access_token` usage with encrypted-only storage:
  - `access_token_encrypted`
  - `access_token_key_version`
- Added `src/server/plaid/crypto.ts` with server-side `AES-256-GCM` encrypt/decrypt helpers backed by versioned env keys.
- Updated Plaid token consumers to decrypt only at call time:
  - `plaid.createLinkToken` update mode
  - `plaid.exchangeToken` persistence path
  - `syncConnection`
  - `plaid.unlinkConnection`
- Added env placeholders:
  - `PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION`
  - `PLAID_TOKEN_ENCRYPTION_KEYS`
- Added migration `drizzle/0002_plaid_token_encryption.sql`.
- Validated the disposable rollout path the user requested:
  - `bun run dbreset`
  - `bun run seed`
- Build verification complete:
  - `bunx tsc --noEmit`
  - `bunx eslint src/server/plaid/crypto.ts src/server/plaid/sync.ts src/server/trpc/routers/plaid.ts src/db/schema.ts`
- **Next**: put real encryption keys in env, create a fresh account, connect Plaid again, and verify link → sync → unlink on the rebuilt DB.

### Plaid token encryption spec drafted

- Drafted `docs/spec/plaid-token-encryption.md` to close the current plaintext `bank_connections.access_token` gap before real-bank rollout.
- Locked the implementation direction to application-layer `AES-256-GCM` encryption with:
  - versioned env-provided keys
  - encrypted payload stored in Postgres
  - server-side decrypt-only-at-call-site behavior
  - staged migration from plaintext to encrypted columns
- Explicitly scoped this as a narrow Plaid-token hardening pass, not a full app-wide secrets platform.
- **Next**: implement the schema change, crypto helper, read/write path cutover, and backfill flow.

### Phase 3 implementation pass shipped

- Added `src/server/trpc/routers/dashboard.ts` and wired it into `_app.ts`.
- New dashboard queries shipped:
  - `dashboard.overview`
  - `dashboard.cashflow`
  - `dashboard.spendingByCategory`
  - `dashboard.recentTransactions`
- Replaced remaining `/dashboard` placeholders with live data:
  - KPI strip now reads real inflow / outflow / net cashflow
  - cashflow panel uses real daily month data
  - recent ledger card uses real transactions
  - watchlist replaced with real spending-by-category pressure
  - rotating AI insight card replaced with deterministic summary copy
- Kept the overview strip at 3 cards by product decision; `savingsRate` stays derived but secondary.
- Dashboard month switching is now real calendar-month navigation instead of the fake `W / M / Q / YTD` picker.
- Build verification complete:
  - `bunx tsc --noEmit`
  - `bunx eslint src/pages/dashboard.tsx src/server/trpc/routers/dashboard.ts src/server/trpc/routers/_app.ts`
- **Next**: do the live-data verification pass against synced transactions, focusing on transfer exclusion, refund treatment, and inactive-account month totals.

### Phase 2 complete — budgets verified

- Closed the budgets polish loop after branch review:
  - removed the `AddCategorySection` lint blocker
  - aligned budget detail queries with inactive-account history
  - fixed "Top spends this month" to use server-side amount ordering instead of a newest-rows slice
- Manually verified the first budgets milestone against synced data:
  - create / edit / delete monthly budgets
  - unbudgeted rows
  - pending handling
  - inactive-account historical spend
- Phase 2 is now complete: `/transactions` category reassignment, `/budgets`, and dashboard budget progress all work against the same live transaction and budget data model.
- **Next**: move to Phase 3 and replace the remaining placeholder dashboard analytics with real transaction-backed queries.

### Phase 3 spec drafted — dashboard analytics

- Drafted `docs/spec/dashboard-analytics.md` and `docs/plan/dashboard-analytics.md` as the Phase 3 source of truth.
- Locked the first dashboard analytics milestone to a real month-scoped surface:
  - live overview cards
  - live cashflow chart
  - live recent ledger
  - live spending-by-category panel
  - continued `budgets.summary` reuse for Budget Progress
- Locked metric rules before implementation:
  - canonical transaction signs only, no provider-side reinversion
  - pending included
  - inactive-account history included
  - `Transfer` and `Credit Card Payment` excluded from overview/cashflow to avoid internal-movement distortion
  - refunds reduce category spend through net category totals
- Follow-up product decision: keep the dashboard KPI strip at 3 cards (`Inflow`, `Outflow`, `Net cashflow`). `Savings rate` stays as a derived metric in the query contract, but not as a primary card in Phase 3.
- Explicitly deferred recurring-spend detection, custom date ranges, AI insight copy, and watchlist / portfolio dashboard surfaces until later phases.

### Phase 2 — budgets first pass wired

- Added `src/server/trpc/routers/budgets.ts` with `budgets.summary`, `budgets.upsertMonthlyBudget`, and `budgets.deleteMonthlyBudget`.
- Wired the router into `src/server/trpc/routers/_app.ts`.
- Added `/budgets` in `src/pages/budgets.tsx` as the first budgeting desk: month switching, grouped category rows, inline monthly target editing, and a supporting Recharts bar chart through the shadcn `chart` component.
- Dashboard Budget Progress in `src/pages/dashboard.tsx` now reads from live `budgets.summary` data instead of hardcoded placeholder rows.
- Added shadcn UI pieces for the budgeting surface: `chart`, `badge`, `progress`, `skeleton`.
- Fixed the disposable Neon reset path while doing the sign-convention work: `scripts/db-reset.ts` now drops the `drizzle` schema too, so `bun run dbreset` actually reapplies migrations before `bun run seed`.
- Verified clean: `bunx tsc --noEmit` and `bunx eslint src/server/trpc/routers/budgets.ts src/server/trpc/routers/_app.ts src/pages/budgets.tsx src/pages/dashboard.tsx` both pass.

### Canonical transaction semantics locked

- FinWin now treats `transactions.amount` as canonical account movement: positive = money in, negative = money out.
- Plaid provider amounts must be normalized on sync before persistence; the inversion belongs in `src/server/plaid/sync.ts`, not in downstream query math.
- This keeps budgets, cashflow, balances, and future holdings work on one coherent sign convention while the DB is still disposable.
- **Next**: refresh disposable transaction data after the sync normalization change, then build `/budgets` against the canonical storage rule.

### Phase 2 — transactions page read-only pass shipped

- Added `/transactions` in `src/pages/transactions.tsx` as the first production ledger surface: user-scoped transaction list, newest-first, limited to 100 rows for now.
- Added `transactions.list` tRPC query in `src/server/trpc/routers/transactions.ts` and wired it in `_app.ts`.
- Filters shipped in this pass: account, category, pending status, date-from, date-to, plus "include inactive accounts".
- Pending badge shipped on transaction rows. Inactive accounts remain hidden by default and can be included explicitly.
- Uncategorized nudge shipped on page load with count of visible uncategorized transactions; CTA focuses the list on uncategorized rows.
- Dashboard now links into `/transactions` from the Ledger nav item and recent-ledger card.
- Verified clean: `bunx tsc --noEmit` and `bunx eslint src/pages/transactions.tsx src/server/trpc/routers/transactions.ts src/server/trpc/routers/_app.ts src/pages/dashboard.tsx` both pass.
- **Next**: `transactions.setCategory` mutation + minimal per-row reassignment UI, then move to `/budgets`.

### Phase 2 kickoff — decisions locked + tRPC migration shipped

**Decisions locked (transactions + budgeting core):**
- Category taxonomy: 6 groups, 18 categories (Income, Essentials, Lifestyle, Financial, Transfers, Other). Curated list mapped from Plaid's `personal_finance_category` via a TS const in `src/server/trpc/category-map.ts`.
- Auto-categorize on sync using `detailed` → category name, fallback to `primary` → category name, fallback to "Uncategorized". User-assigned categories survive re-syncs (excluded from `onConflictDoUpdate`).
- Transfers: `defaultBudgetable=true` (external spend counts). Credit Card Payment category is `defaultBudgetable=false` to avoid double-counting when CC is also linked.
- Pending transactions included in budget math. Pending badge shown in tx list.
- Budgets are monthly, start 1st of month. Custom period start deferred → `docs/future.md`.
- Uncategorized: `defaultBudgetable=false`, nudge shown in tx page when any exist.
- Inactive accounts (post-unlink): hidden by default in tx page, "include inactive" toggle.
- tRPC for all app data routes. Plaid webhook stays REST (raw body required for signature check).
- Dashboard Budget Progress section wired to real data in Phase 2 once `budgets.summary` exists.
- Pages Router for all new product pages (`src/pages/`).

**tRPC migration (complete, build passing):**
- Installed: `@trpc/server`, `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query`, `zod`.
- New infrastructure: `src/server/trpc/trpc.ts` (router + protectedProcedure), `src/server/trpc/context.ts` (better-auth session), `src/server/trpc/routers/_app.ts` + `routers/plaid.ts`, `src/pages/api/trpc/[trpc].ts`, `src/lib/trpc.ts` (React client + TRPCProvider).
- Migrated procedures: `plaid.createLinkToken`, `plaid.exchangeToken`, `plaid.syncTransactions`, `plaid.listConnections`, `plaid.unlinkConnection`, `plaid.reactivateConnection`.
- Deleted old REST routes: `link-token.ts`, `exchange.ts`, `sync.ts`, `connections/[id].ts`. Webhook untouched.
- Components updated: `connect-bank.tsx`, `refresh-transactions.tsx` now use tRPC mutations.
- `settings/connections.tsx` moved from GSSP → `trpc.plaid.listConnections.useQuery()` + client-side auth guard via `useSession`.
- `_app.tsx` wrapped with `<TRPCProvider>`.

**Category seeding:**
- `scripts/seed-categories.ts` — idempotent, run with `bun run seed`.
- `src/server/trpc/category-map.ts` — full `PLAID_CATEGORY_MAP` (detailed) + `PLAID_PRIMARY_FALLBACK_MAP` (primary fallback).
- `src/server/plaid/sync.ts` updated: loads category map on each sync, assigns `categoryId` on INSERT, excluded from conflict updates.
- **Action required**: run `bun run seed` against the live Neon DB to populate `category_groups` + `categories` before any sync will produce categorized transactions.

**Next**: transactions page (`/transactions`) — list with account/date/category/pending filters + category reassignment flow.

## 2026-04-15

- **Phase 5** done: schema trim + neon-serverless swap + unlink rework.
  - Swapped `src/index.ts` and `scripts/db-reset.ts` from `drizzle-orm/neon-http` → `drizzle-orm/neon-serverless` (Pool on WebSocket). Node 25 has global `WebSocket`, no `ws` polyfill needed.
  - Schema trim: dropped `transactions.category_confidence` and `transactions.notes` (never populated, never read). Kept `authorized_date` + `merchant_name` — populated by sync and load-bearing for the upcoming transactions list.
  - `bank_accounts.connection_id` now nullable; FK flipped from `ON DELETE CASCADE` → `ON DELETE SET NULL`. Migration `drizzle/0001_silent_payback.sql`.
  - Unlink rework (delete-pipe-keep-data): `DELETE /api/plaid/connections/:id` now runs `itemRemove`, then a single tx that nulls `bank_accounts.connection_id` + flips `is_active=false` for the affected accounts, then hard-deletes the `bank_connections` row. Soft-revoke / `status="revoked"` removed everywhere (UI pill, list filter, button disabled check).
  - Multi-statement writes wrapped in `db.transaction(...)`: exchange (connection + accounts insert) and sync (upsert + remove + cursor advance). Orphan-row failure mode is gone.
- Cleanup touching the last 4 commits:
  - `src/app/layout.tsx`: fonts (`Sora`, `DM_Sans`) were declared but never applied — landing page silently fell back. Wired both `--font-finwin-heading` and `--font-finwin-body` on `<body>` per `migration.md` §1.
  - `src/server/plaid/sync.ts`: replaced `while (true) { … break }` + stale `eslint-disable` with an explicit `hasMore` loop.
- Verified clean: `bunx tsc --noEmit` and `bunx eslint src` both pass with zero errors/warnings.
- **Next**: apply `drizzle/0001_silent_payback.sql` (either `bunx drizzle-kit migrate` against the live Neon DB, or `bun run dbreset` if sandbox data is disposable), then re-run the sandbox smoke test — connect → sync → unlink — and confirm a reconnect of the same bank spawns *new* active `bank_accounts` rows while the old ones stay as inactive history.

## 2026-04-14 (later)

- Drafted Plaid integration spec + phased plan in `docs/spec/plaid-integration.md` and `docs/plan/plaid-integration.md`; cross-checked against Plaid API docs (corrected cursor param name, webhook JWT verification flow, sign convention).
- **Phase 0** done: env vars (`PLAID_ENV`, `PLAID_WEBHOOK_URL`), `.env.example`, installed `plaid` + `react-plaid-link`, created `src/server/plaid/client.ts` singleton.
- **Phase 1** done + verified: `POST /api/plaid/link-token`, `POST /api/plaid/exchange`, `ConnectBank` component in dashboard header. End-to-end sandbox connect confirmed — `bank_connections` + `bank_accounts` rows written correctly.
- **Phase 2** done + verified: `src/server/plaid/sync.ts` (`syncConnection` + `syncUserConnections`), `POST /api/plaid/sync` (manual trigger, per-connection or all), `RefreshTransactions` dashboard button. Initial hydration runs at tail of `/exchange`. Cursor-based sync: upsert on `providerTransactionId`, delete on `removed`, advance `lastCursor`. Sandbox sync populates `transactions` rows correctly.
- **Phase 4** done + verified: `/settings/connections` page listing user's live connections (account names/masks/types, status, last-sync, last-tx date). `DELETE /api/plaid/connections/:id` calls `/item/remove` + soft-revokes. `PATCH` flips status back to active after Link update-mode reconnect. `link-token` route extended to run update mode when `connectionId` is present. `ConnectBank` component dual-mode (initial link vs reconnect). Settings sidebar nav item now links to the page. Revoked connections filtered out of the list.
- **Phase 5 scope expanded**: in addition to schema trim + neon-serverless swap, rework unlink to the "delete pipe, keep data" model — nullable `bank_accounts.connection_id`, drop cascade, flip `is_active=false` on unlink. Soft-revoke is the current-day hack; clean model deferred to avoid mid-implementation migration.
- **Phase 3** done + verified: `POST /api/plaid/webhook` with ES256 JWT verification via `src/server/plaid/webhook-verify.ts` (JWK cached by `kid`, `iat` freshness, `request_body_sha256` body check on raw body; body parser disabled on route). Routes `TRANSACTIONS` sync codes → `syncConnection`; `ITEM` codes flip `bankConnections.status`. Installed `jose`. Local delivery via ngrok → `PLAID_WEBHOOK_URL` passed to `/link/token/create`. End-to-end: sandbox reconnect triggered `exchange` + two webhook 200s as expected.
- **TODO for Phase 5**: switch `drizzle-orm/neon-http` → `drizzle-orm/neon-serverless` (WebSocket pool) so multi-statement DB transactions work; current exchange + sync paths can leave orphan rows on partial failure.

## 2026-04-14

- Killed the old DB and rebuilt the schema from scratch with a clean single migration (`drizzle/0000_lean_forge.sql`).
- Expanded `src/db/schema.ts` with 6 financial tables: `category_groups`, `categories`, `bank_connections`, `bank_accounts`, `transactions`, `budgets`.
- Auth tables (`user`, `session`, `account`, `verification`) remain untouched — owned by Better Auth. `user_profiles` stays as the app's user data table (1:1 with `user`).
- New financial tables use `uuid` PKs; FKs to `user` use `text` to match Better Auth's PK type.
- `transactions.amount` sign convention: positive = money in, negative = money out. Spent-so-far is always derived from transactions, never stored on `budgets`.
- `income_events` deferred — not needed until investing/forecasting surface.
- `access_token` on `bank_connections` is plain text for now; encryption deferred.
- Applied to Neon via `bun run dbreset`. DB is clean and ready.
- Next: seed default category groups/categories, or wire up the Plaid link flow.

## Thesis

- Build a personal finance app that helps users import transactions, understand budgets, and make smarter decisions before expanding into broader investing workflows.

## Current Focus

- Stabilize the core around auth, linked-account import, normalized transactions, and budget visibility before treating portfolio features as a first-class surface.

## 2026-03-29

- Initialized the cross-agent project scaffold with `AGENTS.md`, `CLAUDE.md`, `ledger.md`, `docs/plan.md`, and `docs/resources.md`.
- Captured the current product direction from the live app and existing planning notes in `.agents/implementationplan.md`.
- Next: audit the implementation plan against the current codebase and turn the active phase into a concrete milestone checklist.
