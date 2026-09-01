export type SyncFailureReason = "login_required" | "locked" | "unknown";
export type SyncErrorReason = SyncFailureReason | "cursor_reset" | null;

/** Plaid error codes that require the user to re-authenticate via Link update mode. */
export const USER_ACTION_ERROR_CODES = new Set([
  "ITEM_LOGIN_REQUIRED",
  "ITEM_LOCKED",
  "INSUFFICIENT_CREDENTIALS",
  "USER_SETUP_REQUIRED",
  "MFA_NOT_SUPPORTED",
  "INVALID_MFA",
  "NO_ACCOUNTS",
]);

/** Plaid error codes that indicate a stale or invalid cursor. */
export const CURSOR_RESET_ERROR_CODES = new Set([
  "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION",
]);

export function normalizeTransactionAmount(providerAmount: number) {
  // FinWin stores canonical account semantics:
  // positive = money in, negative = money out.
  return (-providerAmount).toFixed(2);
}

export function classifyErrorReason(errorCode: string): SyncFailureReason {
  if (
    errorCode === "ITEM_LOGIN_REQUIRED" ||
    errorCode === "INSUFFICIENT_CREDENTIALS"
  ) {
    return "login_required";
  }
  if (errorCode === "ITEM_LOCKED") {
    return "locked";
  }
  return "unknown";
}

export function getSyncFailureState(errorCode: string | null) {
  return {
    status: "sync_failed" as const,
    syncErrorCode: errorCode ?? "UNKNOWN",
  };
}

export function classifySyncErrorCode(errorCode: string): {
  requiresUserAction: boolean;
  requiresCursorReset: boolean;
  reason: SyncErrorReason;
} {
  return {
    requiresUserAction: USER_ACTION_ERROR_CODES.has(errorCode),
    requiresCursorReset: CURSOR_RESET_ERROR_CODES.has(errorCode),
    reason: classifyErrorReason(errorCode),
  };
}
