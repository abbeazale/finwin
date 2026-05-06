# FinWin

FinWin is a Next.js personal finance workspace for imported transactions, monthly budgets, and deterministic dashboard analytics.

## Stack

- Next.js Pages Router
- Better Auth with email/password, GitHub, Google, passkeys, and TOTP
- tRPC v11 with TanStack Query
- Drizzle ORM with Neon/Postgres
- Plaid account linking, transaction sync, and webhook verification
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

- `/` redirects signed-out users to `/login`, incomplete profiles to `/onboarding`, and complete profiles to `/dashboard`.
- `/dashboard` shows month-scoped cashflow, spending, recent transactions, and budget pressure.
- `/transactions` lists imported transactions with filters and category reassignment.
- `/budgets` manages monthly category budgets.
- `/settings/connections` manages Plaid bank connections.
- `/settings/security` manages passkeys and TOTP.

Plaid webhooks remain a raw-body REST route at `/api/plaid/webhook`. App data reads and writes go through tRPC.
