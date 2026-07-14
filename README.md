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

## Setup

1. Copy `.env.example` to `.env` and fill required values.
2. Set `DATABASE_URL` to a Neon/Postgres connection string.
3. Generate a Plaid token encryption key (32 random bytes, base64) and put it in
   `PLAID_TOKEN_ENCRYPTION_KEYS` with matching `PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION`.
4. Apply schema migrations with the non-destructive migrator below.
5. Seed categories once on a fresh database.

```bash
cp .env.example .env
# edit .env
bun install
bun run db:migrate
bun run seed
```

Safe encryption-key generation example:

```bash
openssl rand -base64 32
```

## Commands

```bash
bun install
bun run dev
bunx tsc --noEmit
bun run lint
bun run knip
bun test
bunx madge --circular --extensions ts,tsx --ts-config tsconfig.json src
bun run build
```

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
and is refused when `NODE_ENV=production`.
## Routes

- `/` serves the signed-out marketing page with a live stock ticker, while signed-in users continue to onboarding or the dashboard.
- `/dashboard` shows month-scoped cashflow, spending, recent transactions, and budget pressure.
- `/transactions` lists imported transactions with filters and category reassignment.
- `/budgets` manages monthly category budgets.
- `/investments` shows linked investment accounts, holdings, and investment transactions.
- `/sandbox` provides deterministic multi-portfolio paper trading with live quotes.
- `/settings/connections` manages Plaid bank connections.
- `/settings/security` manages passkeys and TOTP.

Plaid webhooks remain a raw-body REST route at `/api/plaid/webhook`. App data reads and writes go through tRPC.
