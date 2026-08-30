/**
 * Password rules shared by the Better Auth server config and the recovery
 * pages, so the copy a user reads cannot drift from what is enforced.
 */

/** Must match Better Auth's `minPasswordLength`, which defaults to 8. */
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_RESET_EXPIRY_MINUTES = 30;
