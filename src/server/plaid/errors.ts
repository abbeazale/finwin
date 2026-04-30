import type { PlaidError } from "plaid";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPlaidError(value: unknown): value is PlaidError {
  return (
    isRecord(value) &&
    typeof value.error_type === "string" &&
    typeof value.error_code === "string" &&
    typeof value.error_message === "string"
  );
}

export function getPlaidErrorData(err: unknown): PlaidError | null {
  if (!isRecord(err)) {
    return null;
  }

  const response = err.response;
  if (!isRecord(response)) {
    return null;
  }

  return isPlaidError(response.data) ? response.data : null;
}

export function getPlaidErrorCode(err: unknown): string | null {
  return getPlaidErrorData(err)?.error_code ?? null;
}
