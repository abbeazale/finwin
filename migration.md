# App Router Migration Plan

## 1. Fix `src/app/layout.tsx`

Add font imports and `globals.css` — this fixes broken fonts on the landing page:

```tsx
import { DM_Sans, Sora } from 'next/font/google'
import './globals.css'

const heading = Sora({ subsets: ['latin'], variable: '--font-finwin-heading', weight: ['600','700','800'] })
const body = DM_Sans({ subsets: ['latin'], variable: '--font-finwin-body', weight: ['400','500','700'] })

// In the layout, apply both variables to <body>:
<body className={`${heading.variable} ${body.variable} antialiased`}>
```

## 2. Create `src/app/api/auth/[...all]/route.ts`

Replace `pages/api/auth/[...all].ts` with the App Router version:

```ts
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

## 3. Create `src/app/api/onboarding/route.ts`

Replace `pages/api/onboarding.ts`. Key changes:
- Use `NextRequest` / `NextResponse` instead of `NextApiRequest` / `NextApiResponse`
- Get session via `auth.api.getSession({ headers: await headers() })` (from `next/headers`)
- Parse body with `await req.json()` instead of `req.body`

## 4. Create `src/app/login/page.tsx`

Split into two files:
- **`page.tsx`** (Server Component) — checks the session and redirects with `redirect()` from `next/navigation`, then renders the client component
- **`LoginClient.tsx`** (Client Component, `'use client'`) — the toggle + forms UI, identical to the current `pages/login.tsx` render return

## 5. Create `src/app/onboarding/page.tsx`

Same pattern as login — server component does auth guard + data fetch, passes props down to a `'use client'` `OnboardingClient.tsx`.

## 6. Create `src/app/dashboard/page.tsx`

The dashboard uses `useRouter`, `useState`, `useTransition` — so it needs `'use client'`. Pattern:
- **`page.tsx`** (Server Component) — auth guard, fetch `firstName` from profile, redirect if not onboarded, pass `firstName` as a prop
- **`DashboardClient.tsx`** (Client Component) — the full dashboard UI

## 7. Fix `useRouter` in auth components

`loginForm.tsx` and `signupForm.tsx` both import from `next/router` — change to `next/navigation`:

```ts
// Before
import { useRouter } from 'next/router'
// After
import { useRouter } from 'next/navigation'
```

## 8. Clean up

Once everything works, delete:
- `src/pages/_app.tsx`, `_document.tsx`, `login.tsx`, `dashboard.tsx`, `onboarding.tsx`
- `src/pages/api/auth/[...all].ts`, `src/pages/api/onboarding.ts`
- `src/login/page.jsx` (empty file in the wrong place)
- Empty `src/pages/app/` directory
