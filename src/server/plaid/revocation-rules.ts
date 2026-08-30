import { getPlaidErrorCode } from "./errors";

/**
 * Plaid codes that mean the Item is already gone. Revocation is complete, so
 * there is nothing left to retry and the credential can be dropped.
 */
const ALREADY_REVOKED_CODES = new Set([
  "ITEM_NOT_FOUND",
  "INVALID_ACCESS_TOKEN",
]);

const BASE_RETRY_DELAY_MINUTES = 5;
const MAX_RETRY_DELAY_MINUTES = 12 * 60;

/**
 * After this many failures FinWin stops retrying and drops the credential.
 * With the backoff below that is roughly three days of attempts.
 */
export const MAX_REVOCATION_ATTEMPTS = 12;

export type RevocationOutcome =
  | "revoked"
  | "already-revoked"
  | "retryable"
  | "unusable-credential";

export function classifyRevocationFailure(error: unknown): RevocationOutcome {
  const code = getPlaidErrorCode(error);
  if (code && ALREADY_REVOKED_CODES.has(code)) return "already-revoked";
  return "retryable";
}

export function isRevocationConfirmed(outcome: RevocationOutcome): boolean {
  return outcome === "revoked" || outcome === "already-revoked";
}

/**
 * Delay before attempt number `attempts + 1`, doubling each time up to a cap.
 * `attempts` is the number of failures recorded so far.
 */
export function retryDelayMinutes(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  const delay = BASE_RETRY_DELAY_MINUTES * 2 ** exponent;
  return Math.min(delay, MAX_RETRY_DELAY_MINUTES);
}

/**
 * True when FinWin must stop retrying: either the credential can never be used
 * again, or the attempt budget is spent.
 */
export function shouldAbandonRevocation(
  outcome: RevocationOutcome,
  attempts: number,
): boolean {
  return outcome === "unusable-credential" || attempts >= MAX_REVOCATION_ATTEMPTS;
}
