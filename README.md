# FinWin

FinWin is a Next.js personal finance workspace for imported transactions, monthly budgets, deterministic dashboard analytics, real investment accounts, and paper-trading scenarios.

## Stack

- Next.js Pages Router
- Better Auth with email/password, GitHub, Google, passkeys, and TOTP
- tRPC v11 with TanStack Query
- Drizzle ORM with Neon/Postgres
- Plaid account linking, transaction and investment sync, and webhook verification
- Finnhub market quotes and symbol search
- Open Exchange Rates conversion for investment reporting
- Tailwind CSS/shadcn UI components

## Fresh clone setup

Install the exact Bun version declared by `packageManager` in `package.json`, then:

```bash
cp .env.example .env
# edit .env (see Environment below)
bun install --frozen-lockfile
bun run db:migrate
bun run seed
bun run dev
```

Safe Plaid encryption-key generation (32 bytes, base64):

```bash
openssl rand -base64 32
```

Put the result in `PLAID_TOKEN_ENCRYPTION_KEYS` as
`{"v1":"<generated-value>"}` and keep
`PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION=v1`.

### Environment

Required to boot auth, database, and bank linking:

| Variable | Purpose |
|---|---|
| `FINWIN_ENV` | Explicit runtime contract: `local`, `preview`, `staging`, or `production` |
| `DATABASE_ENVIRONMENT` | Data boundary; must match `FINWIN_ENV` |
| `BETTER_AUTH_URL` | Public app origin (e.g. `http://localhost:3000`) |
| `FINWIN_CANONICAL_ORIGIN` | Required production origin; must equal `BETTER_AUTH_URL` |
| `AUTH_TRUSTED_ORIGINS` | Comma-separated exact auth origins; no wildcards |
| `BETTER_AUTH_API_KEY` | Better Auth dashboard/plugin API key |
| `BETTER_AUTH_SECRET` | Independent legacy/fallback auth key; base64-encoded 32 bytes outside local |
| `BETTER_AUTH_SECRETS` | Versioned auth keys, current first (for example `2:new,1:old`) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `DATABASE_URL` | Neon/Postgres connection string |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid API credentials |
| `PLAID_ENV` | `sandbox`, `development`, or `production` |
| `PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION` | Active key id (e.g. `v1`) |
| `PLAID_TOKEN_ENCRYPTION_KEYS` | JSON map of version → base64 32-byte keys |
| `PLAID_REVOCATION_RETRY_SECRET` | Bearer token for `POST /api/internal/plaid/revocations/retry` (min 32 chars) |

Required in staging and production, because password recovery cannot deliver
mail without them:

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key for transactional email |
| `FINWIN_MAIL_FROM` | Verified sender, e.g. `FinWin <desk@finwin.example>` |

Locally, leaving `RESEND_API_KEY` unset prints the reset link to the server
console instead of sending it. That fallback is restricted to `FINWIN_ENV=local`
so a deployed environment can never print a reset credential to its logs.

Optional integrations (features degrade without them):

| Variable | Purpose |
|---|---|
| `PLAID_WEBHOOK_URL` | Public HTTPS webhook endpoint (ngrok in local dev) |
| `FINNHUB_API_KEY` | Landing ticker + sandbox quotes/search |
| `OER_KEY` | Investment FX conversion to USD |
| `FX_REFRESH_SECRET` | Bearer token for `POST /api/internal/fx/refresh` |
| `NEON_DB_PASSWORD` | Convenience only; app uses `DATABASE_URL` |

`src/server/env.ts` is the single server-side environment contract and is
validated before Next.js builds or starts. Local development uses a local data
scope and an explicitly selected Plaid environment; previews require an isolated
preview database plus Plaid sandbox; staging requires a staging database plus
Plaid development; production requires the production database scope, Plaid
production, HTTPS origins/webhook,
and non-local secrets. Vercel previews infer `preview`, but setting `FINWIN_ENV`
explicitly is recommended. Run `bun run env:check` to exercise the environment
and preview-isolation policy.

### Canonical identity boundary and response headers

Production has one identity origin. Set `BETTER_AUTH_URL`,
`FINWIN_CANONICAL_ORIGIN`, and the sole `AUTH_TRUSTED_ORIGINS` entry to the
same HTTPS origin. Preview and staging must also provide an explicit trusted
origin that includes their environment-specific `BETTER_AUTH_URL`; wildcard
origins are rejected.

Register these exact provider callbacks, derived from the canonical origin:

```text
GitHub: <canonical-origin>/api/auth/callback/github
Google: <canonical-origin>/api/auth/callback/google
```

The passkey RP ID is the canonical hostname and its expected origin is the
canonical origin. Better Auth cookies are forced `Secure`, `HttpOnly`, and
`SameSite=Lax` outside local development. Next.js suppresses `X-Powered-By`
and applies CSP, clickjacking protection, MIME sniffing protection, a strict
referrer policy, a restrictive permissions policy, and production HSTS to all
routes.

After deploying the custom domain, run:

```bash
bun run security:check:deployed -- https://finwin.abbeazale.com
```

Then use a fresh browser profile on that same domain to verify password login,
GitHub and Google OAuth, passkey registration/sign-in, TOTP, and one
recent-auth-protected bank action. Confirm auth cookies have `Secure`,
`HttpOnly`, `SameSite=Lax`, and a `__Secure-` prefix. Complete this smoke test
before promoting the deployment; a local or generated Vercel domain is not a
substitute because OAuth redirects, cookies, and WebAuthn are origin-bound.
`https://finwin.abbeazale.tech` currently redirects to the canonical `.com`
origin and must not be registered as a second identity origin.

### Better Auth secret and OAuth-token migration

Better Auth uses only `BETTER_AUTH_SECRET`; it never falls back to the Dash API
key, `AUTH_SECRET`, or a provider credential. Outside local development, the
singular and versioned secrets must be base64-encoded 32-byte keys and must not
match Dash, GitHub, Google, Plaid, FX, Finnhub, or Open Exchange Rates secrets.

For the first versioned deployment, keep the current auth secret as both the
legacy fallback and version 1:

```bash
BETTER_AUTH_SECRET=<existing-secret>
BETTER_AUTH_SECRETS=1:<existing-secret>
```

Deploy with `account.encryptOAuthTokens` enabled, then run the idempotent
`bun run auth:encrypt-oauth-tokens` migration against that environment. It
encrypts existing Google/GitHub access, refresh, and ID tokens in place without
logging their values; new and refreshed tokens are encrypted automatically.

For later rotation, generate a new 32-byte key and prepend it while retaining
the previous versions: `BETTER_AUTH_SECRETS=2:<new>,1:<old>`. Keep singular
`BETTER_AUTH_SECRET=<old>` during the legacy migration window. Existing sessions
remain valid under Better Auth's versioned-secret handling; legacy TOTP/backup
data uses the singular fallback until it is rewritten or re-enrolled. Run
`bun run auth:check`, deploy, verify password/OAuth/passkey/TOTP sign-in, then
remove an old version only after its sessions have expired and dependent legacy
data has been migrated. A rollback restores the prior secret ordering and keeps
all listed decryption keys.

### Database

Prefer the non-destructive migrator for retained or production data. It applies
pending Drizzle migrations from `drizzle/` and verifies the journal reached the
latest expected tag:

```bash
bun run db:migrate
```

Deployment ordering: run `bun run db:migrate` against the target database before
shipping app code that depends on new tables or columns. If migrate fails partway,
fix the SQL error, keep the database, and re-run `bun run db:migrate` after the
fix; do not use `dbreset` against retained data.

Destructive reset and seed commands for non-production disposable data only:

```bash
bun run dbreset
bun run seed
```

`dbreset` drops the `drizzle` and `public` schemas, reapplies every migration,
and is refused when `NODE_ENV=production`. Always run `bun run seed` after a
fresh migrate or reset — migrations do not seed categories.

## Verification

```bash
bun install --frozen-lockfile
bun run verify
```

`verify` is the release gate: typecheck, lint, tests, unused-code analysis,
production dependency audit, and a production build. `audit:prod` rejects every
advisory that is neither patched nor listed in `config/audit-exceptions.json`.
Exceptions must name an owner, evidence, compensating control, and expiry; expired
or stale entries fail CI. The current two moderate exceptions expire 2026-09-30:
Hono's Windows static-file handler is installed only through development/optional
tooling, and esbuild's affected development server is never started by FinWin.
Configure the GitHub `Release gate` job as a required check on `main` so pull
requests cannot merge when it fails.

### Provider error logging

Provider failures are emitted through a typed whitelist containing only the
operation, correlation ID, safe provider error code, connection ID, and provider
request ID. Headers, request/response bodies, tokens, credentials, messages, and
stacks are never copied into the event. `bun run provider-logs:check` forces an
Axios-shaped Plaid failure through the logger and fails if the output changes or
contains secret-bearing values.

Better Auth warnings and failures use the same approach: only severity, a
classified event code, and a generated correlation ID are emitted. Its raw
message and opaque logger arguments are discarded because database errors can
contain OAuth state, PKCE verifiers, token values, and query parameters. The
logging check exercises this failure shape as well.

FinWin configures no third-party server log exporter; provider events go only to
process stdout/stderr, whose retention is controlled by the hosting platform.
Because the previous raw Axios logging could have reached hosted logs, deployment
acceptance requires rotating the Plaid client secret, updating every runtime
environment atomically, redeploying, and verifying Link plus sync. Do not revoke
the old secret before the replacement is installed in each active environment.

### Release runbook

- **Owner:** `@abbeazale` is the release owner until ownership is explicitly
  handed off. The owner confirms the required `Release gate` check passed on the
  exact commit being deployed.
- **Migration approval:** production migrations are never run by CI. The release
  owner reviews the pending Drizzle SQL and explicitly approves and runs
  `bun run db:migrate` as a separate release stage before dependent application
  code is deployed.
- **Rollback decision:** the release owner rolls back when the deployment is
  unhealthy, a required smoke check fails, or a new critical user/data-integrity
  regression appears. Re-deploy the last known-good application commit. Prefer a
  forward database fix; never run `dbreset` or blindly reverse a production
  migration.
- **Post-deploy smoke:** confirm `/` returns successfully, sign in, load the
  dashboard, open transactions and budgets, and verify the latest Plaid sync
  state. Record the deployed commit and smoke result with the release.

## Commands

```bash
bun install
bun run dev
bun run db:migrate
bun run dbreset
bun run seed
bun run typecheck
bun run lint
bun run knip
bun test
bun run env:check
bun run audit:prod
bun run build
bun run verify
```

## Routes

- `/` serves the signed-out marketing page with a live stock ticker, while signed-in users continue to onboarding or the dashboard.
- `/dashboard` shows month-scoped cashflow, spending, recent transactions, and budget pressure.
- `/transactions` lists imported transactions with filters, pagination, and category reassignment.
- `/budgets` manages monthly category budgets.
- `/investments` shows linked investment accounts, holdings, and investment transactions.
- `/sandbox` provides deterministic multi-portfolio paper trading with live quotes.
- `/settings/connections` manages Plaid bank connections. Linking requires a valid session; unlinking and reactivation require recent strong authentication.
- `/settings/security` manages passkeys and TOTP.
- `/forgot-password` requests a single-use password reset link.
- `/reset-password` consumes that link and sets a new password.

Plaid webhooks remain a raw-body REST route at `/api/plaid/webhook`. App data reads and writes go through tRPC.

### Bank unlink and provider revocation

Unlinking deletes the connection and detaches its accounts, but transaction
history stays. The encrypted access token is the only thing that can revoke
access at Plaid, so it is never dropped on a failed `itemRemove`. Instead the
credential moves to `pending_provider_revocations` inside the same transaction
that deletes the connection, and the user is told that revocation is still
pending rather than complete.

Hobby cannot run Vercel Cron, so the queue is worked on later Plaid traffic
instead. Opening `/settings/connections`, a manual transaction sync, and
incoming Plaid webhooks retry every due row with exponential backoff from 5
minutes up to 12 hours. `POST /api/internal/plaid/revocations/retry` with
`Authorization: Bearer $PLAID_REVOCATION_RETRY_SECRET` runs the same sweep by
hand. After 12 failed attempts a row is marked `abandoned` and its credential
is deleted; that emits a `REVOCATION_ABANDONED` log, and an operator must then
remove the Item in the Plaid dashboard by hand.
