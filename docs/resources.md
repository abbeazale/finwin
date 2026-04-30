# FinWin Resources

## Key Files

- `README.md`
- `.agents/implementationplan.md` — original phased plan (reference only; ledger is canonical)
- `src/db/schema.ts` — full Drizzle schema (transactions, budgets, categories, bank accounts/connections, auth tables)
- `src/server/trpc/routers/_app.ts` — tRPC root router; add new routers here
- `src/server/trpc/routers/budgets.ts` — monthly budget summary + upsert/delete mutations
- `src/server/trpc/routers/dashboard.ts` — dashboard overview, cashflow, spending-by-category, and recent transaction queries
- `src/server/trpc/routers/plaid.ts` — all Plaid procedures
- `src/server/trpc/routers/transactions.ts` — transaction listing query plus category reassignment mutation for `/transactions`
- `src/server/lib/category-map.ts` — Plaid PFC → our category name mapping (TS const)
- `src/server/plaid/crypto.ts` — application-layer AES-256-GCM encryption/decryption for Plaid access tokens
- `src/server/plaid/sync.ts` — Plaid transaction sync with auto-categorization
- `src/pages/dashboard.tsx` — main dashboard; Budget Progress now reads from `budgets.summary`
- `src/pages/budgets.tsx` — monthly budgets desk with Recharts via the retained shadcn chart wrapper
- `src/pages/transactions.tsx` — production transaction ledger view with filters, uncategorized nudge, and inline category reassignment
- `src/pages/settings/security.tsx` — passkey enrollment and TOTP setup surface
- `src/pages/two-factor.tsx` — TOTP / backup-code challenge page for password sign-in when 2FA is enabled
- `docs/spec/budgets.md` — monthly budgets product spec and query rules
- `docs/plan/budgets.md` — phased implementation plan for the first budgets milestone
- `docs/spec/dashboard-analytics.md` — Phase 3 dashboard analytics spec
- `docs/plan/dashboard-analytics.md` — Phase 3 implementation plan for replacing dashboard placeholders with live data
- `docs/spec/plaid-token-encryption.md` — focused security spec for replacing plaintext Plaid access-token storage
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
- `bun run dbreset` — drops and remigrates the DB (non-production only)
- `bun run seed` — idempotent category seed; run once against a fresh DB before testing sync

## Integrations

- Better Auth — email/password + GitHub + Google social login, passkeys, and TOTP two-factor
- Better Auth Passkey — `@better-auth/passkey` plugin with WebAuthn user verification required
- Neon / Postgres — serverless WebSocket pool (`drizzle-orm/neon-serverless`)
- Drizzle ORM and drizzle-kit
- Plaid — account linking, cursor-based transaction sync, webhook verification (ES256 JWT)
- Plaid token encryption — server-side AES-256-GCM with versioned env-provided keys
- tRPC v11 + TanStack Query v5 — all app data routes; webhook stays as plain Next API route
- Zod v4 — tRPC input validation
- shadcn/ui via `components.json`; only actively imported generated components are kept in `src/components/ui`

## Router Conventions

- Product pages → `src/pages/` (Pages Router). New pages go here.
- tRPC API → `src/pages/api/trpc/[trpc].ts`
- Plaid webhook → `src/pages/api/plaid/webhook.ts` (REST, raw body required)
- App data mutations/queries → add procedures to `src/server/trpc/routers/`
- Current product pages include `/dashboard`, `/transactions`, `/budgets`, `/settings/connections`, `/settings/security`, and `/two-factor`

## Notes

- Run `bun run seed` after `bun run dbreset` — migrations don't seed categories.
- tRPC context carries `userId: string | null`; all protected procedures enforce non-null via `protectedProcedure`.
- Canonical product sign convention: positive = money in, negative = money out.
- Plaid raw provider amounts may use the opposite convention; sync should normalize before persistence.
- `bank_accounts.is_active=false` marks accounts from unlinked connections. Transactions stay for historical budgets.
