import { randomUUID } from "node:crypto";
import { getPlaidErrorData } from "@/server/plaid/errors";

type ProviderOperation =
  | "plaid-link-token-create"
  | "plaid-token-exchange"
  | "plaid-initial-sync"
  | "plaid-transaction-sync"
  | "plaid-item-remove"
  | "plaid-item-remove-retry"
  | "plaid-webhook-connection-lookup"
  | "plaid-webhook-sync"
  | "open-exchange-rates-refresh"
  | "resend-email-send";

export type ProviderErrorEvent = {
  operation: ProviderOperation;
  correlationId: string;
  errorCode: string;
  connectionId?: string;
  requestId?: string;
};

type ProviderErrorContext = {
  operation: ProviderOperation;
  correlationId: string;
  connectionId?: string;
  errorCode?: string;
};

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const SAFE_ERROR_CODE = /^[A-Z][A-Z0-9_:-]{0,63}$/;

function safeIdentifier(value: unknown) {
  return typeof value === "string" && SAFE_IDENTIFIER.test(value)
    ? value
    : undefined;
}

function safeErrorCode(value: unknown) {
  return typeof value === "string" && SAFE_ERROR_CODE.test(value)
    ? value
    : undefined;
}

export function createCorrelationId(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return safeIdentifier(candidate) ?? randomUUID();
}

function sanitizeProviderError(
  error: unknown,
  context: ProviderErrorContext,
): ProviderErrorEvent {
  const plaidError = getPlaidErrorData(error);
  const connectionId = safeIdentifier(context.connectionId);
  const requestId = safeIdentifier(plaidError?.request_id);

  return {
    operation: context.operation,
    correlationId: safeIdentifier(context.correlationId) ?? randomUUID(),
    errorCode:
      safeErrorCode(context.errorCode) ??
      safeErrorCode(plaidError?.error_code) ??
      "UNKNOWN",
    ...(connectionId ? { connectionId } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

export function logProviderError(
  error: unknown,
  context: ProviderErrorContext,
  logger: (event: ProviderErrorEvent) => void = console.error,
) {
  logger(sanitizeProviderError(error, context));
}
