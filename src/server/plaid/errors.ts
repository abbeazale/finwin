import type { PlaidError } from "plaid";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function getProperty<K extends string>(value: object, key: K) {
  if (!(key in value)) return undefined;
  return (value as { [P in K]?: unknown })[key];
}

function isPlaidError(value: unknown): value is PlaidError {
  return (
    isObject(value) &&
    typeof getProperty(value, "error_type") === "string" &&
    typeof getProperty(value, "error_code") === "string" &&
    typeof getProperty(value, "error_message") === "string"
  );
}

export function getPlaidErrorData(err: unknown): PlaidError | null {
  if (!isObject(err)) {
    return null;
  }

  const response = getProperty(err, "response");
  if (!isObject(response)) {
    return null;
  }

  const data = getProperty(response, "data");
  return isPlaidError(data) ? data : null;
}

export function getPlaidErrorCode(err: unknown): string | null {
  return getPlaidErrorData(err)?.error_code ?? null;
}
