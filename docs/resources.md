# FinWin Resources

## Key Files

- `README.md`
- `.agents/implementationplan.md` — original phased plan (reference only; ledger is canonical)
- `src/db/schema.ts` — full Drizzle schema (transactions, budgets, categories, bank accounts/connections, auth tables)
- `src/server/trpc/routers/_app.ts` — tRPC root router; add new routers here
- `src/server/trpc/routers/plaid.ts` — all Plaid procedures
- `src/server/trpc/routers/transactions.ts` — filtered transaction listing query for `/transactions`
- `src/server/trpc/category-map.ts` — Plaid PFC → our category name mapping (TS const)
- `src/server/plaid/sync.ts` — Plaid transaction sync with auto-categorization
- `src/pages/dashboard.tsx` — main dashboard (Budget Progress section still hardcoded — Phase 2 task)
- `src/pages/transactions.tsx` — production transaction ledger view with filters and uncategorized nudge
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
- `bun run dbreset` — drops and remigrates the DB (non-production only)
- `bun run seed` — idempotent category seed; run once against a fresh DB before testing sync

## Integrations

- Better Auth — email/password + GitHub + Google social login
- Neon / Postgres — serverless WebSocket pool (`drizzle-orm/neon-serverless`)
- Drizzle ORM and drizzle-kit
- Plaid — account linking, cursor-based transaction sync, webhook verification (ES256 JWT)
- tRPC v11 + TanStack Query v5 — all app data routes; webhook stays as plain Next API route
- Zod v4 — tRPC input validation
- shadcn/ui via `components.json`

## Router Conventions

- Product pages → `src/pages/` (Pages Router). New pages go here.
- tRPC API → `src/pages/api/trpc/[trpc].ts`
- Plaid webhook → `src/pages/api/plaid/webhook.ts` (REST, raw body required)
- App data mutations/queries → add procedures to `src/server/trpc/routers/`
- Current product pages include `/dashboard`, `/transactions`, and `/settings/connections`

## Notes

- `opencode.json` already exists in the repo.
- Run `bun run seed` after `bun run dbreset` — migrations don't seed categories.
- tRPC context carries `userId: string | null`; all protected procedures enforce non-null via `protectedProcedure`.
- Amount sign convention: positive = expense (money out), negative = income/refund. Stored as Plaid returns it.
- `bank_accounts.is_active=false` marks accounts from unlinked connections. Transactions stay for historical budgets.
