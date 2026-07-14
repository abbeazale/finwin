# FinWin Deslop Audit

Date: 2026-07-14

## Purpose

Reduce repository noise and accidental complexity without deleting useful history, weakening financial logic, or performing cosmetic refactors that merely move code around.

This audit combines parallel read-only reviews run through the Cursor `agent` CLI with `cursor-grok-4.5-high`, followed by direct verification against the repository. Conflicting agent claims were resolved from the files and command output rather than copied into this document.

## Executive Summary

The repository is not broadly full of dead application code. `knip`, TypeScript, and the existing tests pass. The highest-value cleanup is concentrated in four areas:

1. **Contain a committed ngrok credential immediately.**
2. **Quarantine stale `.agents/*.md` plans that contradict the live application.**
3. **Refresh canonical docs that lag behind the landing page, investments, and sandbox.**
4. **Consolidate a few duplicated helpers and split only the largest modules along existing boundaries.**

Avoid a mass cleanup. In particular, do not delete Drizzle migrations/metadata, merge every spec with its implementation plan, or remove security-sensitive integration code just because it is verbose.

## Current Verification Baseline

Verified during this audit:

- `bun test` — 7 passing, 0 failing
- `bunx tsc --noEmit` — passing
- `bun run knip` — passing with one configuration hint for `postcss`
- Existing worktree changes were left untouched:
  - deleted `CLAUDE.md`
  - modified `ledger.md`
  - untracked sandbox plan/spec files

---

## P0 — Security Cleanup

### 1. Rotate and remove the committed ngrok authtoken

**Evidence**

- `ngrok.yml:3` contains a non-empty `authtoken` value.
- `ngrok.yml` is tracked by Git.
- The credential entered history in commit `fff8716`.

The token value is intentionally not reproduced here.

**Why this matters**

This is not ordinary clutter. If the repository or commit was ever pushed, copied, backed up, or shared, the credential must be treated as compromised.

**Recommended fix**

1. Revoke/rotate the token in ngrok.
2. Remove the real `ngrok.yml` from Git tracking.
3. Add `ngrok.yml` or `ngrok*.yml` to `.gitignore`.
4. If configuration needs to be documented, commit a redacted `ngrok.yml.example`.
5. If the repository has been shared, purge the credential from Git history after rotation. Rotation comes first; history rewriting alone does not invalidate the old token.

**Validation**

- The old token no longer authenticates.
- `git ls-files ngrok.yml` returns nothing.
- A fresh clone contains only the example file, not a real credential.

### 2. Remove Finnhub tokens embedded in local Claude settings

**Evidence**

- `.claude/settings.local.json:12-13` contains Finnhub URLs with inline `token=` query values.
- The file is ignored globally and is not tracked, so this is a local hygiene issue rather than a repository leak.

**Recommended fix**

- Replace token-bearing command allowlist entries with commands that read `$FINNHUB_API_KEY`.
- Rotate the key if the machine, settings directory, terminal logs, or backups have been shared.

**Validation**

- Searching `.claude/settings.local.json` for `token=` returns no credential-bearing URLs.
- Finnhub calls still work through the environment variable.

---

## P1 — Remove Misleading Repository Material

### 3. Archive or delete stale `.agents/*.md` planning documents

The following files describe an earlier product and architecture:

- `.agents/plan.md`
- `.agents/datamodels.md`
- `.agents/folder-struct.md`
- `.agents/dash.md`
- `.agents/implementationplan.md`

**Verified contradictions**

- `.agents/datamodels.md:11` says positive transaction amounts are expenses. The live convention is positive money-in and negative money-out; see `src/server/plaid/sync.ts:73-76` and the current schema/docs.
- `.agents/folder-struct.md:7` and `.agents/folder-struct.md:48-60` propose Clerk-era structure and routes. The application uses Better Auth and the Pages Router.
- `.agents/folder-struct.md:25` lists `package-lock.json`; the repository uses `bun.lock`.
- `.agents/plan.md:207` still refers to Clerk.
- `.agents/dash.md:37-52` proposes four KPIs, a watchlist, and an AI card that were explicitly removed or deferred.
- `docs/resources.md:6` already labels `.agents/implementationplan.md` reference-only and says the ledger is canonical.

**Why this matters**

These are not harmless duplicates: an agent or contributor following them can invert financial signs, add the wrong auth provider, or rebuild intentionally removed UI.

**Recommended fix**

Preferred: move genuinely useful historical context into one clearly labeled archive document, then delete the five stale files.

Minimum: add a prominent first-line warning to each file:

> Historical only. Do not use for implementation. See `AGENTS.md`, `docs/plan.md`, `docs/resources.md`, and `src/db/schema.ts`.

Do not mix this cleanup with the project-local `.agents/skills/` directory. Those files are agent tooling, not old product plans, and should be evaluated separately before removal.

### 4. Refresh the canonical project docs

The canonical docs do not match the current application.

#### `README.md`

- `README.md:35` says `/` redirects signed-out users to `/login`; `src/pages/index.tsx` now serves a signed-out marketing page with a stock ticker.
- `README.md:33-40` omits `/investments` and `/sandbox`.
- The stack/integration summary omits Finnhub, Plaid Investments, and Open Exchange Rates.

#### `docs/plan.md`

- `docs/plan.md:13` describes `/` as redirect-only.
- `docs/plan.md:14-16` still frames Phase 6a as the active milestone even though the sandbox has shipped.
- `docs/plan.md:59` says investing simulation remains deferred.
- `docs/plan.md:140` says landing/marketing surfaces are removed.
- The milestone table has no sandbox milestone.

#### `docs/resources.md`

- The Key Files section omits `src/pages/sandbox.tsx`, `src/server/trpc/routers/sandbox.ts`, `src/server/sandbox/values.ts`, and `src/server/market/quotes.ts`.
- The Integrations section omits Finnhub.
- `docs/resources.md:86-87` lists current product routes without `/sandbox`.

**Recommended fix**

Update these three living documents in one focused documentation pass. Keep detailed sandbox behavior in the existing sandbox spec and plan rather than copying it into every overview file.

### 5. Resolve the `CLAUDE.md` deletion intentionally

**Evidence**

- `CLAUDE.md` is tracked but deleted in the current worktree.
- `AGENTS.md` remains present and is the stated canonical shared instruction file.
- The deleted `CLAUDE.md` had already drifted behind `AGENTS.md`.

**Recommended fix**

Choose one explicit policy:

- **Compatibility policy:** keep `AGENTS.md` canonical and make `CLAUDE.md` a short, maintained Claude-compatible mirror/pointer.
- **Single-file policy:** remove project `CLAUDE.md` intentionally and verify that workspace-level Claude instructions reliably load `AGENTS.md` expectations.

Do not restore another full duplicate without deciding how it stays synchronized.

### 6. Remove stale configuration residue

Low-risk verified cleanup:

- Remove `postcss` from `knip.json:11`; `bun run knip` explicitly reports that the ignore is unnecessary.
- Remove the unused `clerk` layer name from `src/styles/globals.css:1`. There is no Clerk runtime in the repository.
- Add `!.env.example` after `.env*` in `.gitignore`. The file is already tracked and safe, but the explicit exception makes the intent clear and avoids “tracked ignored file” warnings.
- Move `dotenv` from runtime dependencies to dev dependencies. It is imported only by `drizzle.config.ts:1`, `scripts/db-reset.ts:1`, and `scripts/seed-categories.ts:1`.

Validate with `bun install`, `bun run knip`, `bunx tsc --noEmit`, and `bun run build`.

---

## P2 — Low-Risk Code Simplification

### 7. Consolidate month arithmetic

**Duplication**

- `src/lib/date.ts:15-18` defines `shiftMonthStart`.
- `src/server/lib/month.ts:12-29` separately defines next/previous month helpers with equivalent date arithmetic.
- `src/pages/budgets.tsx:925-927` has another local current-month calculation.

**Recommended shape**

Keep pure date operations in `src/lib/date.ts`. Keep Zod input validation in `src/server/lib/month.ts`, importing shared date operations where needed.

Also review the budgets initial month against the profile-timezone-aware dashboard behavior. The current budgets helper uses the browser's local timezone, while the dashboard deliberately uses the saved profile timezone.

**Validation**

Test December-to-January and January-to-December navigation plus users whose profile timezone differs from the browser/server timezone.

### 8. Consolidate decimal serialization

**Duplication**

- `src/server/investments/values.ts:38-41` defines `formatDecimal`.
- `src/server/lib/money.ts:21-27` defines the equivalent `formatDecimalValue`.

**Recommended fix**

Use `formatDecimalValue` as the shared server serialization helper and remove the investment-local copy. Preserve the existing behavior for `null` and non-finite values.

### 9. Fix budgets' hardcoded display currency

**Evidence**

- `src/pages/budgets.tsx:945-947` always formats money as CAD.
- The dashboard uses the user's profile currency.
- Transactions and account data carry currency fields.

**Recommended fix**

Make the budgets summary contract return or otherwise expose the intended display currency and pass it to `formatCurrency`. Do not silently aggregate mixed currencies without a conversion rule; this cleanup should clarify the current product contract rather than imply FX support that does not exist.

### 10. Extract the repeated protected-page session gate

The same client pattern appears across budgets, transactions, investments, sandbox, and settings pages:

- call `useSession()`
- redirect to `/login` in an effect
- suppress queries until a session exists
- render `PageStatus` while loading

Examples: `src/pages/budgets.tsx:56-73` and `src/pages/transactions.tsx:33-64`.

**Recommended fix**

Extract a small `useRequireSession()` hook that owns redirect and loading semantics. Keep server-side auth where it has a real purpose, such as dashboard bootstrap and onboarding routing; do not replace all auth layers indiscriminately.

### 11. Reformat the sandbox page's compressed JSX

`src/pages/sandbox.tsx:375-399` compresses full tables, forms, and helpers into very long one-line functions.

This is a readability problem even though the page is only about 399 lines. Reformat the existing components into normal multiline JSX before performing any deeper refactor. Do not introduce extra abstractions solely to reduce line count.

---

## P3 — Structural Refactors to Do Only When Touching the Area

### 12. Split the two largest page modules along existing component boundaries

Current sizes:

- `src/pages/budgets.tsx` — 956 lines
- `src/pages/dashboard.tsx` — 854 lines

Useful extraction seams already exist.

#### Budgets

Move page-local presentation components such as category cards, add-category UI, and chart modal into `src/components/budgets/`. Keep query orchestration and page state in the route file.

#### Dashboard

Move display-only metric/copy helpers and panels into `src/components/dashboard/`. Move server-only initial-month selection away from the UI module.

**Guardrail**

A successful split should reduce responsibilities, not create a directory of single-use wrappers. Do this when changing the page, not as an isolated rename-only project.

### 13. Separate investment synchronization from bank-transaction synchronization

`src/server/plaid/sync.ts` is 639 lines and contains two clear domains:

- investment holdings/transaction sync beginning around `src/server/plaid/sync.ts:206`
- regular transaction sync beginning around `src/server/plaid/sync.ts:431`

**Recommended fix**

Extract investment-specific orchestration into `src/server/plaid/sync-investments.ts`, retaining shared connection/security helpers in a deliberate common module. Keep stable re-exports initially to reduce call-site churn.

**Validation**

Run both regular Plaid transaction sync and investment holdings/transaction sync. Verify idempotency, cursor advancement, closed-position removal, and error status behavior.

---

## Optional Cleanup

These are factual but low leverage. Batch them with related work rather than opening dedicated cleanup changes.

- `tsconfig.json:9` enables JavaScript even though there are no application `.js`/`.jsx` files. Set `allowJs` to `false` if no generated tooling requires it.
- `tsconfig.json:41` excludes tests from the main TypeScript pass. Either document that `bun test` is the test typecheck boundary or add a dedicated test typecheck configuration.
- `tsx` is used only for database scripts. Bun may be able to run them directly, but do not remove `tsx` until both scripts are tested against a disposable database.
- Thin page-local `formatMoney` aliases can be removed when those pages are already being edited. Centralize behavior, not every contextual display label.

---

## Leave Alone

The audits produced several tempting false positives. These areas should remain unless a concrete failure or product change justifies work.

### Drizzle migrations and metadata

Keep `drizzle/0000` through `0007`, `drizzle/meta/_journal.json`, and generated snapshots. Applied migrations are operational history, not disposable build output. The missing `0003_snapshot.json` is worth noting only if `drizzle-kit generate` reports a real problem; prior project verification reported no drift.

### Spec/plan pairs

Keep `docs/spec/*` and `docs/plan/*` as separate artifacts. Specs define behavior and constraints; plans record implementation order. They are related, not accidental duplicates.

### Ledger history

`ledger.md` is intentionally cumulative cross-agent handoff history. Do not rewrite old entries merely to shorten the file. If it becomes hard to scan, add a compact current-state section or archive by year without changing historical claims.

### Better Auth SSO dependency

`@better-auth/sso` has no direct application import, but `@better-auth/infra` uses it as part of the Better Auth Dash integration. Do not remove it while `dash()` remains in `src/lib/auth.ts:43` without testing installation and auth startup.

### Security and financial-domain complexity

Keep the explicit Plaid webhook verification, token encryption, timeline replay, portfolio locking, FX exclusion rules, and investment valuation branches. Their complexity protects external integration and money invariants.

### Generated/local directories

`.next`, `node_modules`, `.DS_Store`, `.env`, and `tsconfig.tsbuildinfo` are ignored local artifacts. They occupy disk but are not repository bloat. Clean them locally when useful; do not treat them as source cleanup.

### Agent skill packs

Do not delete `.agents/skills/*` based only on file count. First confirm which tools discover project-local skills versus workspace-level skills. Remove or move a pack only if it is unused, duplicated elsewhere, or conflicts with the Pages Router policy.

---

## Recommended Execution Order

### Pass 1 — Credential containment

- Rotate ngrok token.
- Remove tracked real ngrok config and add an example.
- Remove local Finnhub token literals.

### Pass 2 — Documentation and repository truth

- Archive/delete stale `.agents/*.md` product plans.
- Refresh `README.md`, `docs/plan.md`, and `docs/resources.md`.
- Resolve the `CLAUDE.md` policy.
- Apply the small ignore/Knip/CSS/dependency classification cleanups.

### Pass 3 — Shared helpers and correctness

- Consolidate month helpers.
- Consolidate decimal serialization.
- Fix budgets currency handling.
- Add a shared protected-page session hook.
- Reformat sandbox JSX.

### Pass 4 — Structural work when feature changes require it

- Split budgets/dashboard page responsibilities.
- Split investment sync from regular Plaid sync.

### Validation after each code pass

```bash
bun test
bunx tsc --noEmit
bun run lint
bun run knip
bunx madge --circular --extensions ts,tsx --ts-config tsconfig.json src
bun run build
```

For Plaid, auth, investments, budgets, and sandbox changes, add focused signed-in browser smoke tests; static checks cannot validate integration behavior or financial presentation by themselves.
