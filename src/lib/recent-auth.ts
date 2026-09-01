/**
 * Recent strong authentication for sensitive FinWin operations.
 *
 * ## What requires step-up
 * - Plaid unlink / local disconnect
 * - Plaid connection reactivation
 *
 * Creating a Link token and exchanging a public token require a valid session,
 * but not recent authentication. Plaid still authenticates the user at their
 * financial institution, and linking an account is not destructive.
 *
 * Security settings pages already require an authenticated session; passkey and
 * TOTP enrollment continue to use Better Auth's own verification flows.
 *
 * ## What counts as recent
 * Session `createdAt` from Better Auth. A new session is created after password
 * (+ TOTP when enabled), OAuth, or passkey sign-in. That timestamp is treated as
 * the last strong authentication event. Cookie refresh alone does not count.
 *
 * ## Window
 * 15 minutes. Older sessions receive FORBIDDEN with a stable machine-readable
 * cause and instructions to log out before signing in again.
 *
 * ## Verification
 * Enforced only in tRPC `recentAuthProcedure` middleware on the server.
 * Client timestamps and modals are never trusted as proof.
 */

export const RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000;
const RECENT_AUTH_REQUIRED_CAUSE = "RECENT_AUTH_REQUIRED" as const;

export const RECENT_AUTH_REQUIRED_MESSAGE =
  `Confirm it's you again before changing bank connections. Log out, sign in, then retry. (${RECENT_AUTH_REQUIRED_CAUSE})`;

export function getRecentAuthStatus(sessionCreatedAt: Date | null | undefined, now = new Date()) {
  if (!sessionCreatedAt) {
    return {
      ok: false as const,
      ageMs: null,
      remainingMs: 0,
    };
  }

  const ageMs = now.getTime() - sessionCreatedAt.getTime();
  const remainingMs = RECENT_AUTH_WINDOW_MS - ageMs;

  if (ageMs < 0 || remainingMs <= 0) {
    return {
      ok: false as const,
      ageMs: Math.max(ageMs, 0),
      remainingMs: 0,
    };
  }

  return {
    ok: true as const,
    ageMs,
    remainingMs,
  };
}
