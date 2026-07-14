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

## Commands

```bash
bun install
bun run dev
bunx tsc --noEmit
bun run lint
bun run knip
bunx madge --circular --extensions ts,tsx --ts-config tsconfig.json src
bun run build
```

Database reset and seed commands for non-production disposable data:

```bash
bun run dbreset
bun run seed
```

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
