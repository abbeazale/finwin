# Recent strong authentication

## Goal

Destructive bank-connection mutations must prove a recent strong authentication
event. A stolen long-lived session cookie alone is not enough to revoke or
restore provider access.

## Operations that require step-up

- `plaid.unlinkConnection`
- `plaid.reactivateConnection`

`plaid.createLinkToken` and `plaid.exchangeToken` require a valid authenticated
session through `protectedProcedure`, but do not require recent authentication.
Plaid authenticates the user at their financial institution during Link, and
linking an account is not destructive. Keeping the 15-minute guard here blocked
returning users whose valid sessions were older than the freshness window, while
the former sign-in link could not create a new session.

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

Show the server message instructing the user to log out, sign in, and retry.
Do not link an authenticated user to `/login`: that route redirects an existing
session to the dashboard without establishing a fresh session.
