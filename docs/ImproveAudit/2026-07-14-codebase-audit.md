# FinWin Improve Audit

**Date:** 2026-07-14  
**Decision review:** 2026-07-14  
**Audit depth:** Standard  
**Audited commit:** `dfe18e7`  
**Mode:** Read-only source audit; no application code was changed

## Executive Summary

FinWin has a healthy compilation baseline and clear domain intent, but several
high-leverage risks should be addressed before broader product expansion:

1. The installed Better Auth version is affected by a confirmed high-severity
   account-takeover advisory under FinWin's exact email/password plus OAuth
   configuration.
2. One onboarding timezone option stores an invalid IANA identifier and can make
   the dashboard fail during server rendering.
3. The unauthenticated Plaid webhook buffers an unlimited request body before
   signature verification.
4. There is no safe, non-destructive migration command even though migration
   drift has already caused a runtime outage.
5. Dashboard totals combine mixed currencies and label the result as the user's
   profile currency.
6. The transaction ledger stops at 100 rows without pagination while claiming
   it has reached the end.
7. Plaid security boundaries and core financial calculations have almost no
   automated characterization coverage.
8. Sensitive bank-linking, unlinking, and security operations verify that a
   session exists but do not require a recent strong authentication event.

The recommended first planning batch is findings **1, 2, 3, 4, and 7** below.
Findings **5 and 6** should follow the characterization work in finding 7.
Finding **8** should begin as a design spike after the Better Auth upgrade.

### Authentication provider decision

Keep Better Auth for the current consumer personal-finance product and harden the
existing integration. Do not migrate to WorkOS AuthKit now.

FinWin already owns a complete Better Auth integration with email/password,
GitHub, Google, passkeys, TOTP, local sessions, and stable local user IDs used by
every financial table. WorkOS would move identity to an external service and
require a local-to-WorkOS user mapping, session/callback changes, and an auth UI
decision. Its current Next.js SDK documentation targets App Router, while FinWin
uses Pages Router. WorkOS passkeys are currently hosted-UI-only, and WorkOS
recommends configuring a custom domain before production passkey enrollment;
the custom-domain add-on is currently paid.

Reconsider WorkOS when FinWin has a concrete need for organizations, enterprise
SSO, directory sync, organization-level auth policies, or managed B2B user
administration. Relevant references:

- [WorkOS AuthKit overview](https://workos.com/docs/authkit/overview)
- [WorkOS passkeys](https://workos.com/docs/authkit/passkeys)
- [WorkOS Next.js SDK](https://workos.com/docs/sdks/authkit-nextjs)
- [WorkOS migration model](https://workos.com/docs/migrate/other-services)
- [WorkOS pricing](https://workos.com/pricing)

## Scope and Method

The audit covered all nine Improve categories:

- correctness and bugs
- security
- performance
- test coverage
- technical debt and architecture
- dependencies and migrations
- developer experience and tooling
- documentation
- product direction

The review included the source tree, schema and migrations, package metadata,
repository guidance, recent Git history, current intent/spec documents, and
the highest-churn financial and integration paths. Candidate findings were
checked directly against the cited code before inclusion.

The following were not audited:

- live Plaid, Finnhub, or Open Exchange Rates behavior
- signed-in browser flows
- deployed Vercel configuration and production infrastructure
- production database state beyond the repository's migration journal and
  recorded ledger history
- a line-by-line audit of vendored dependencies

## Verification Baseline

| Command | Result | Notes |
|---|---|---|
| `bunx tsc --noEmit` | Pass | No TypeScript errors |
| `bun run build` | Pass | Build warns that Next inferred `/Users/abbe` as the workspace root because of an ancestor lockfile |
| `bun run lint` | Pass with warning | One unused `ChartConfig` import in `src/pages/budgets.tsx` |
| `bun test` | Pass | 7 tests, all in `src/server/sandbox/values.test.ts` |
| `bun run knip` | Fail | Unused direct dependency, unlisted dependency, and unused exports/types |
| `bunx madge --circular --extensions ts,tsx --ts-config tsconfig.json src` | Pass | No circular dependencies |
| `bunx drizzle-kit check` | Pass | Migration metadata is internally consistent |
| `bun audit --json` | Fail | Multiple advisories; only the demonstrably reachable Better Auth issue is ranked as a confirmed security finding below |

## Vetted Findings

### 1. Upgrade the Better Auth package set

- **Category:** Security / dependencies
- **Impact:** High
- **Effort:** S
- **Fix risk:** Medium
- **Confidence:** High
- **Evidence:** [`package.json`](../../package.json) installs `better-auth`
  1.6.7. [`src/lib/auth.ts`](../../src/lib/auth.ts) enables email/password and
  both GitHub and Google OAuth without disabling implicit account linking.
- **Impact detail:** Better Auth's reviewed high-severity advisory
  [GHSA-g38m-r43w-p2q7](https://github.com/advisories/GHSA-g38m-r43w-p2q7)
  identifies this exact configuration as affected by pre-account hijacking and
  account takeover. The issue is fixed in Better Auth 1.6.11. The current npm
  release checked during the decision review is 1.6.23.
- **Fix sketch:** Upgrade `better-auth` and `@better-auth/passkey` together to
  1.6.23, remove the unused direct `@better-auth/sso` dependency, and explicitly
  review `@better-auth/infra` compatibility because the installed 0.1.8 release
  brings beta auth internals. Regenerate the lockfile and smoke-test password,
  GitHub, Google, passkey, TOTP, session, and dashboard-plugin flows. Do not mix
  Better Auth core/plugin patch versions.

### 2. Correct and validate onboarding timezones

- **Category:** Correctness
- **Impact:** High
- **Effort:** S
- **Fix risk:** Low
- **Confidence:** High
- **Evidence:** [`src/pages/onboarding.tsx`](../../src/pages/onboarding.tsx)
  labels an option as Shanghai but stores `Asia/Philippines`, which is not a
  valid IANA timezone. [`src/server/trpc/routers/onboarding.ts`](../../src/server/trpc/routers/onboarding.ts)
  accepts any non-empty timezone string. [`src/lib/date.ts`](../../src/lib/date.ts)
  passes the stored value directly to `Intl.DateTimeFormat`.
- **Impact detail:** Selecting that option saves successfully, but subsequent
  dashboard server rendering throws `RangeError` while computing the user's
  current month.
- **Fix sketch:** Replace the invalid option with the intended valid IANA zone,
  share locale constants between client and server, and validate stored timezone
  values at the tRPC boundary.

### 3. Bound Plaid webhook request bodies

- **Category:** Security
- **Impact:** High
- **Effort:** S
- **Fix risk:** Low
- **Confidence:** High
- **Evidence:** [`src/pages/api/plaid/webhook.ts`](../../src/pages/api/plaid/webhook.ts)
  disables Next's body parser and concatenates every incoming chunk before
  signature verification, without enforcing a maximum byte count.
- **Impact detail:** An unauthenticated request can force the process to allocate
  an arbitrarily large buffer before the request is rejected.
- **Fix sketch:** Enforce a small explicit byte limit while streaming the raw
  body, stop reading immediately when exceeded, and return HTTP 413. Preserve
  the exact accepted bytes for Plaid's body-hash verification.

### 4. Add a safe, non-destructive migration path

- **Category:** Dependencies and migrations
- **Impact:** High
- **Effort:** S
- **Fix risk:** Medium
- **Confidence:** High
- **Evidence:** [`package.json`](../../package.json) exposes only `dbreset` and
  `seed`. [`scripts/db-reset.ts`](../../scripts/db-reset.ts) drops both schemas
  before applying migrations. [`ledger.md`](../../ledger.md) records a previous
  runtime failure where the journal stopped at migration 0005 and the sandbox
  tables were absent.
- **Impact detail:** There is no repeatable safe path for applying schema changes
  to retained or production data, and schema drift has already caused a 500.
- **Fix sketch:** Add a dedicated non-destructive Drizzle migrator, document its
  deployment ordering and recovery behavior, and add a smoke check that confirms
  the journal reached the expected migration.

### 5. Stop aggregating mixed currencies on the dashboard

- **Category:** Correctness
- **Impact:** High
- **Effort:** M
- **Fix risk:** Medium
- **Confidence:** High
- **Evidence:** [`src/server/trpc/routers/dashboard.ts`](../../src/server/trpc/routers/dashboard.ts)
  sums all qualifying transaction amounts without grouping or filtering by
  currency. [`src/pages/dashboard.tsx`](../../src/pages/dashboard.tsx) formats
  those totals using the user's profile currency.
- **Impact detail:** For example, CAD and USD amounts can be added numerically and
  displayed as if the entire result were CAD. This affects overview, cashflow,
  month-over-month deltas, savings rate, and spending-by-category.
- **Fix sketch:** Until general transaction FX conversion is deliberately added,
  scope dashboard aggregates to the profile currency and return an excluded-row
  count, matching the established budgets behavior.

### 6. Make the transaction ledger pageable

- **Category:** Correctness / product completeness
- **Impact:** High
- **Effort:** M
- **Fix risk:** Low
- **Confidence:** High
- **Evidence:** [`src/server/trpc/routers/transactions.ts`](../../src/server/trpc/routers/transactions.ts)
  accepts a limit but no offset or cursor. [`src/pages/transactions.tsx`](../../src/pages/transactions.tsx)
  always requests 100 rows and renders “End of tape” even when `totalCount` is
  larger.
- **Impact detail:** Older transactions cannot be inspected or recategorized,
  directly undermining the project's transaction-clarity priority.
- **Fix sketch:** Add deterministic cursor or offset pagination, keep filters and
  sorting stable across pages, and add accessible previous/next or load-more
  controls. Do the same for investment transactions if the shared pattern is
  cheap to reuse, but do not broaden the initial plan unnecessarily.

### 7. Characterize Plaid and core financial rules with tests

- **Category:** Test coverage
- **Impact:** High
- **Effort:** M
- **Fix risk:** Low to medium
- **Confidence:** High
- **Evidence:** [`src/server/sandbox/values.test.ts`](../../src/server/sandbox/values.test.ts)
  contains the repository's only seven tests. The following critical paths have
  no automated coverage:
  - Plaid webhook JWT and body verification
  - token encryption, tamper detection, and key-version behavior
  - Plaid sync ownership, idempotency, and error transitions
  - dashboard inclusion and currency rules
  - budget sign, currency exclusion, and threshold behavior
  - investment price fallback, FX exclusion, and cash-impact signs
- **Impact detail:** Regressions in authentication-adjacent integration code or
  displayed financial totals can ship without an automated signal.
- **Fix sketch:** Add deterministic unit and boundary characterization before
  changing dashboard aggregation or Plaid persistence. The maintainer should
  explicitly authorize committing this narrowly scoped critical-path suite;
  leaving it local and uncommitted would not create a durable regression gate.

### 8. Require recent strong authentication for sensitive operations

- **Category:** Security / authentication architecture
- **Impact:** Medium to high
- **Effort:** M
- **Fix risk:** Medium
- **Confidence:** High
- **Evidence:** [`src/server/trpc/context.ts`](../../src/server/trpc/context.ts)
  reduces the auth session to `userId` only, and
  [`src/server/trpc/trpc.ts`](../../src/server/trpc/trpc.ts) checks only that the
  ID exists. Sensitive Plaid mutations in
  [`src/server/trpc/routers/plaid.ts`](../../src/server/trpc/routers/plaid.ts),
  including link-token creation, token exchange, and unlink, use that same
  session-presence check. The earlier MFA design discussion recommended fresh
  authentication for bank and security operations, but the baseline
  implementation did not add it.
- **Impact detail:** A stolen but otherwise valid long-lived session can connect
  or unlink bank data and reach security-management flows without proving recent
  possession of a passkey, password plus TOTP, or another strong factor.
- **Fix sketch:** Start with a design spike that defines which operations require
  step-up, what counts as recent authentication, how passkey and password-plus-
  TOTP users satisfy it, and how the server verifies freshness. Then add a
  dedicated recent-auth procedure or middleware; do not rely on a client-only
  timestamp or modal.

### 9. Batch Plaid persistence

- **Category:** Performance
- **Impact:** Medium
- **Effort:** M
- **Fix risk:** Medium
- **Confidence:** High
- **Evidence:** [`src/server/plaid/sync.ts`](../../src/server/plaid/sync.ts) awaits
  one transaction upsert per imported row. [`src/server/plaid/sync-investments.ts`](../../src/server/plaid/sync-investments.ts)
  repeats the pattern for securities, holdings, and investment transactions,
  including histories fetched 500 rows per Plaid page.
- **Impact detail:** Initial sync and cursor reset perform O(imported rows) remote
  Neon round trips after all provider data is already in memory, increasing
  latency and timeout risk.
- **Fix sketch:** After characterization tests land, chunk bulk upserts to a safe
  statement size while preserving conflict targets, user ownership, modified-row
  semantics, closed-position deletion, and transaction atomicity.

### 10. Restore the Knip verification gate

- **Category:** Developer experience
- **Impact:** Medium
- **Effort:** S
- **Fix risk:** Low
- **Confidence:** High
- **Evidence:** `bun run knip` currently reports:
  - unused direct dependency `@better-auth/sso`
  - unlisted `postcss` dependency
  - one unused export
  - four unused exported types

  Lint additionally reports an unused `ChartConfig` import in
  [`src/pages/budgets.tsx`](../../src/pages/budgets.tsx).
- **Impact detail:** A documented verification command exits nonzero, training
  contributors to ignore the gate and making future dead-code findings less
  trustworthy.
- **Fix sketch:** Vet each finding, remove the unused direct dependency and
  exports where confirmed, configure or declare intentional dependencies, clear
  the lint warning, and return Knip to a zero-exit baseline.

### 11. Remove live ticker calls from landing-page TTFB

- **Category:** Performance
- **Impact:** Low to medium
- **Effort:** M
- **Fix risk:** Low
- **Confidence:** High
- **Evidence:** [`src/pages/index.tsx`](../../src/pages/index.tsx) awaits ticker
  quotes during every signed-out server render. [`src/server/market/quotes.ts`](../../src/server/market/quotes.ts)
  fans out to 20 Finnhub requests, uses only process-local caching, and sets no
  explicit fetch timeout.
- **Impact detail:** A cold instance consumes 20 provider calls and keeps landing
  TTFB open on the slowest response, making a marketing embellishment part of
  the availability path for `/`.
- **Fix sketch:** Serve a shared stale-while-revalidate snapshot or move refresh
  off the request-critical path. Retain the existing static fallback and add
  bounded provider timeouts.

### 12. Document a reproducible fresh-clone setup

- **Category:** Documentation / developer experience
- **Impact:** Medium
- **Effort:** S
- **Fix risk:** Low
- **Confidence:** High
- **Evidence:** [`README.md`](../../README.md) lists commands but not environment
  setup, safe encryption-key generation, required versus optional integration
  variables, or a normal non-destructive migration path. It also omits
  `bun test` from the verification sequence.
- **Impact detail:** A fresh clone cannot follow the README to a running app
  without discovering requirements through runtime errors, and the destructive
  reset command is the only documented migration route.
- **Fix sketch:** Document environment-file creation, required variables, safe
  key generation, disposable reset/seed behavior, the new migration command,
  and a single aggregate verification sequence.

## Direction Options

These are product choices, not defects, and should not outrank correctness or
security work.

### Merchant-rule persistence

[`docs/future.md`](../future.md) explicitly defers remembering a user's merchant
category corrections. The current transaction mutation updates only one row,
while future imports continue to use Plaid taxonomy. This is strongly aligned
with FinWin's transaction-clarity and budgeting-first thesis.

**Coarse effort:** M-L.  
**Trade-off:** Broad merchant matching can silently miscategorize future rows.
A design spike should define normalized merchant identity, rule precedence,
future-only versus retroactive application, and a management UI before buildout.

### Deterministic recurring-spend detection

The schema already contains dates, merchant/name, amount, currency, and pending
state. An explainable recurring-spend surface would add budget value without
introducing speculative AI behavior.

**Coarse effort:** M.  
**Trade-off:** Pending/posted duplicates, variable billing dates, and changing
amounts require conservative cadence and amount tolerances.

### Complete investment production validation

[`docs/plan.md`](../plan.md) already prioritizes live Plaid verification,
provider data spot-checking, and OER scheduling. Completing these tasks is safer
than expanding the investment feature set while provider and FX contracts remain
implemented but not fully validated.

**Coarse effort:** M.  
**Trade-off:** Live discrepancies may require contract or migration changes, but
resolving them now contains the blast radius.

## Dependency Order

1. Upgrade and align Better Auth, remove the unused SSO package, and verify the
   dashboard plugin's stable compatibility. Correct the invalid timezone and
   bound webhook bodies as independent small plans.
2. Add the safe migration command before any new schema change or production
   rollout.
3. Explicitly authorize a committed critical-path test suite, then establish
   characterization coverage for core financial and Plaid rules.
4. Fix dashboard currency handling and ledger pagination.
5. Design and implement recent strong-authentication requirements for sensitive
   bank and security operations after the Better Auth upgrade is stable.
6. Batch Plaid writes only after sync idempotency and snapshot behavior are
   characterized.
7. Restore the verification baseline before broad structural refactoring.
8. Address landing-page caching, onboarding documentation, and lower-priority
   structural work afterward.

## Considered and Rejected or Deferred

- **Sandbox full-history replay:** Retained as an intentional low-volume design
  required for backdated validation, not reported as a performance bug.
- **Plaid webhook returns 200 after sync failure:** Explicitly documented in code
  as a no-durable-queue retry trade-off. Revisit when a job runner is introduced,
  but do not report it as an accidental bug now.
- **Connection-list `1 + 2N` queries:** Real, but expected connection counts are
  small and the current leverage is below sync batching and correctness work.
- **Split the 1,068-line sandbox page:** Reasonable when the area is next changed,
  but a standalone refactor has medium regression risk and should follow better
  characterization coverage.
- **Feature-specific Next.js and transitive dependency advisories:** Not elevated
  without evidence that FinWin uses the affected feature or data path. They should
  be re-evaluated during the dependency refresh rather than copied wholesale from
  audit output.
- **Stale `docs/future.md` posted/pending note:** The transaction page already has
  this filter. Correct it during the next docs refresh; it is too low impact for a
  standalone plan.
- **Move authentication to WorkOS now:** Deferred. WorkOS is credible if FinWin
  becomes organization- or enterprise-oriented, but the current product would
  pay migration, identity-mapping, Pages Router, hosted-login, and passkey-domain
  costs without using the main B2B benefits. Re-evaluate when enterprise SSO,
  directory sync, or organization-level policy is a real roadmap requirement.

## Recommended Planning Selection

Write self-contained implementation plans for:

1. Better Auth upgrade
2. Onboarding timezone correction and validation
3. Plaid webhook body limit
4. Non-destructive migration command
5. Committed critical-path characterization coverage

Then plan dashboard currency handling and transaction pagination after the test
baseline is agreed. Follow the Better Auth upgrade with a design-spike plan for
recent strong authentication on sensitive operations. WorkOS migration is
explicitly not part of this implementation sequence.
