# Recent strong authentication

## Goal

Sensitive bank-linking mutations must prove a recent strong authentication
event. A stolen long-lived session cookie alone is not enough.

## Operations that require step-up

- `plaid.createLinkToken`
- `plaid.exchangeToken`
- `plaid.unlinkConnection`
- `plaid.reactivateConnection`

## What counts as recent

Better Auth session `createdAt`. A new session is created after:

- email/password sign-in (and TOTP challenge when enabled)
- GitHub or Google OAuth sign-in
- passkey sign-in

Cookie refresh or page navigation does not mint a new strong-auth timestamp.

## Freshness window

15 minutes (`RECENT_AUTH_WINDOW_MS`).

## Server enforcement

`recentAuthProcedure` in `src/server/trpc/trpc.ts` checks
`getRecentAuthStatus(ctx.sessionCreatedAt)` and returns `FORBIDDEN` with
`RECENT_AUTH_REQUIRED` in the message. Clients must not invent their own
freshness clock.

## Client recovery

Show the server message and link to `/login?returnTo=/settings/connections` so
the user establishes a fresh session, then retries the bank action.
