# FinWin (Pages Router) Folder Structure + Notes

This structure is optimized for:
- open source friendliness (easy to find things)
- strict boundaries (UI vs domain vs server)
- scaling without turning `/src` into a junk drawer
- tRPC + TanStack Query + Drizzle + Clerk (matches your Notion plan)

---

## Top-level layout

finwin/
├─ .agents/                      # Local notes/tools for you (keep out of app runtime)
│  ├─ folder-struct.md
│  ├─ plan.md
│  └─ skills/…
├─ public/                       # Static assets served at /
├─ src/                          # All application code
├─ .gitignore
├─ eslint.config.mjs
├─ next-env.d.ts
├─ next.config.ts
├─ package.json
├─ package-lock.json
├─ postcss.config.mjs
├─ README.md
└─ tsconfig.json

### Notes
- Keep **all app code inside `src/`**. This makes the repo easier for contributors.
- `.agents/` is fine for your workflow. For open source, consider moving key docs into `docs/` later.
- Add later (recommended for OSS):
  - `LICENSE`
  - `CONTRIBUTING.md`
  - `.env.example`
  - `.github/workflows/ci.yml`
  - `docs/architecture.md`

---

## Recommended `src/` structure (Pages Router)

Your current `src/pages/*` is correct for the Pages Router. Here is the structure I recommend building toward.

src/
├─ pages/                         # Routing (Pages Router)
│  ├─ _app.tsx                     # Providers (tRPC, QueryClient, Theme, Clerk)
│  ├─ _document.tsx                # HTML document setup
│  ├─ index.tsx                    # Landing page
│  ├─ api/
│  │  ├─ trpc/[trpc].ts           # tRPC handler
│  │  └─ webhooks/
│  │     └─ clerk.ts              # Clerk webhook (optional)
│  ├─ app/                         # Authenticated pages (optional naming)
│  │  ├─ dashboard.tsx
│  │  ├─ transactions.tsx
│  │  ├─ budgets.tsx
│  │  └─ portfolio.tsx
│  └─ auth/                        # Auth pages if needed (depends on Clerk setup)
│     ├─ sign-in.tsx
│     └─ sign-up.tsx
│
├─ components/                     # Reusable UI building blocks
│  ├─ ui/                          # shadcn components only (button, card, input)
│  ├─ layout/                      # App shell UI (Sidebar, Navbar, Footer)
│  ├─ charts/                      # Chart wrappers (Recharts / TradingView)
│  └─ shared/                      # Cross-feature components (EmptyState, Loading)
│
├─ features/                       # Vertical slices (domain modules)
│  ├─ transactions/
│  │  ├─ components/               # Feature-specific UI
│  │  ├─ hooks/                    # Feature hooks (useTransactionFilters, etc.)
│  │  ├─ schemas.ts                # Zod inputs + validation
│  │  ├─ types.ts                  # Feature types
│  │  └─ utils.ts                  # Feature helpers
│  ├─ budgets/
│  ├─ portfolio/
│  └─ insights/
│
├─ server/                         # Server-only code (no React imports)
│  ├─ trpc/
│  │  ├─ index.ts                  # createTRPCContext, router, middleware
│  │  ├─ root.ts                   # appRouter
│  │  └─ routers/
│  │     ├─ transactions.ts
│  │     ├─ budgets.ts
│  │     ├─ portfolio.ts
│  │     └─ insights.ts
│  ├─ db/
│  │  ├─ index.ts                  # Drizzle client
│  │  └─ schema/                   # Drizzle schema tables
│  │     ├─ users.ts
│  │     ├─ bankConnections.ts
│  │     ├─ bankAccounts.ts
│  │     ├─ transactions.ts
│  │     ├─ categories.ts
│  │     ├─ budgets.ts
│  │     └─ incomeEvents.ts
│  └─ services/
│     ├─ analysis.service.ts       # Deterministic calculations (your Layer 1)
│     ├─ categorization.service.ts # Category rules/confidence
│     └─ aiInsights.service.ts     # Converts structured data into text (Layer 2)
│
├─ lib/                            # Shared utilities (client + server safe)
│  ├─ env.ts                       # Zod env validation (public/private split)
│  ├─ money.ts                     # Currency helpers, formatting, rounding
│  ├─ date.ts                      # Month boundaries, timezone helpers
│  └─ utils.ts                     # Small helpers (cn, etc.)
│
├─ styles/
│  ├─ globals.css                  # Tailwind base + global styles
│  └─ theme.css                    # Optional (if you keep theme tokens here)
│
└─ types/                          # Optional: shared types not tied to a feature
└─ index.ts

---

## Notes by folder

### `src/pages/`
**Purpose:** routing and page composition only.

Rules that keep your repo clean:
- Pages should mostly “compose” feature components and call hooks.
- Avoid putting business logic inside `pages/*`. Push that into `features/*` or `server/services/*`.

Important files:
- `_app.tsx`: where you set up providers:
  - `QueryClientProvider`
  - `trpc.Provider` (or `withTRPC`)
  - `ClerkProvider` (if used)
  - theme provider
- `api/trpc/[trpc].ts`: single entry point for typed procedures.
- `pages/app/*`: optional pattern for authenticated pages. You can also name it `dashboard/*` etc. The key is consistency.

### `src/components/`
**Purpose:** reusable UI and app shell.
- `components/ui/`: shadcn only. Treat this as “vendor primitives”.
- `components/layout/`: navigation shell pieces.
- `components/charts/`: wrap chart libs so the rest of the app imports your components, not the vendor directly.

### `src/features/`
**Purpose:** the main collaboration surface for open source.
Each feature owns:
- UI components specific to the feature
- zod schemas for inputs
- hooks
- types + small helpers

This prevents a “god `lib/` folder” later.

### `src/server/`
**Purpose:** backend-only logic.
Recommended boundaries:
- `server/trpc/routers/*`: thin procedures
  - validate input
  - call services
  - return results
- `server/services/*`: real business logic
  - deterministic analysis (savings rate, cashflow, spending trends)
  - portfolio simulation rules
  - AI insight generation based on structured results

This matches your Notion principle: AI explains, but does not compute metrics.

### `src/server/db/`
**Purpose:** Drizzle + schema.
- Keep schema files split by table for clarity.
- Put indexes/relations near the table definitions.
- Keep migrations out of `src` if you prefer, but having `src/server/db/migrations` is fine.

### `src/lib/`
**Purpose:** shared helpers used across multiple places.
Keep it small and intentional:
- `env.ts` (validated envs)
- date/money helpers
- `cn()` helper for classnames

### `src/styles/`
You currently have `src/styles` which is good. Keep Tailwind globals here.

---

## Conventions I recommend (so contributors don’t get confused)

### Imports
- Prefer absolute imports via `tsconfig.json`:
  - `@/features/...`
  - `@/server/...`
  - `@/components/...`

### Naming
- `features/<featureName>/components/*`
- `features/<featureName>/schemas.ts`
- `server/trpc/routers/<featureName>.ts`

### Data flow
- UI uses `trpc.<router>.<procedure>.useQuery()` (TanStack Query under the hood)
- routers call `server/services/*`
- services call `server/db/*` (Drizzle)

### “Spent so far”
- Do not store spent totals on budgets, derive them from transactions (as in your data model doc).
- Keep the deterministic calculation in `analysis.service.ts`.

---

## Minimal migration plan from your current structure

You already have:
- `src/pages/*`
- `src/styles/*`

Next steps:
1. Add `src/components/` + `src/features/` + `src/server/` + `src/lib/`
2. Add `pages/api/trpc/[trpc].ts`
3. Move any non-page UI into `components/` or `features/`
4. Keep `pages/*` thin as the app grows

---

If you want, paste your current `src/` tree (just names), and I’ll map each file to its best destination in this structure.