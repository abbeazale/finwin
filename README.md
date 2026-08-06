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
| `BETTER_AUTH_URL` | Public app origin (e.g. `http://localhost:3000`) |
| `BETTER_AUTH_API_KEY` | Better Auth dashboard/plugin API key |
| `BETTER_AUTH_SECRET` or `AUTH_SECRET` | Session signing secret (falls back to API key if unset) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `DATABASE_URL` | Neon/Postgres connection string |
| `PLAID_CLIENT_ID` / `PLAID_SECRET` | Plaid API credentials |
| `PLAID_ENV` | `sandbox`, `development`, or `production` |
| `PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION` | Active key id (e.g. `v1`) |
| `PLAID_TOKEN_ENCRYPTION_KEYS` | JSON map of version → base64 32-byte keys |

Optional integrations (features degrade without them):

| Variable | Purpose |
|---|---|
| `PLAID_WEBHOOK_URL` | Public HTTPS webhook endpoint (ngrok in local dev) |
| `FINNHUB_API_KEY` | Landing ticker + sandbox quotes/search |
| `OER_KEY` | Investment FX conversion to USD |
| `FX_REFRESH_SECRET` | Bearer token for `POST /api/internal/fx/refresh` |
| `NEON_DB_PASSWORD` | Convenience only; app uses `DATABASE_URL` |

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
production dependency audit, and a production build. The dependency policy blocks
critical production advisories; G1.3 owns remediation of known high-severity
findings and tightening that threshold. Configure the GitHub `Release gate` job
as a required check on `main` so pull requests cannot merge when it fails.

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
- `/settings/connections` manages Plaid bank connections (requires recent strong auth).
- `/settings/security` manages passkeys and TOTP.

Plaid webhooks remain a raw-body REST route at `/api/plaid/webhook`. App data reads and writes go through tRPC.
