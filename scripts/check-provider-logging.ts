import {
  logProviderError,
  type ProviderErrorEvent,
} from "../src/server/observability/provider-error";

const secrets = {
  clientId: "plaid-client-id-that-must-not-leak",
  secret: "plaid-secret-that-must-not-leak",
  accessToken: "access-production-token-that-must-not-leak",
  body: "request-body-that-must-not-leak",
};
const forcedAxiosFailure = {
  response: {
    data: {
      error_type: "API_ERROR",
      error_code: "INVALID_API_KEYS",
      error_message: secrets.body,
      request_id: "plaid-request-123",
    },
  },
  config: {
    headers: {
      "PLAID-CLIENT-ID": secrets.clientId,
      "PLAID-SECRET": secrets.secret,
    },
    data: { access_token: secrets.accessToken },
  },
};

let captured: ProviderErrorEvent | undefined;
logProviderError(
  forcedAxiosFailure,
  {
    operation: "plaid-transaction-sync",
    correlationId: "correlation-123",
    connectionId: "connection-123",
  },
  (event) => {
    captured = event;
  },
);

if (!captured) throw new Error("Forced provider failure did not emit a log event.");
const serialized = JSON.stringify(captured);
for (const secret of Object.values(secrets)) {
  if (serialized.includes(secret)) {
    throw new Error("Provider log contains a secret-bearing field.");
  }
}

const expected = JSON.stringify({
  operation: "plaid-transaction-sync",
  correlationId: "correlation-123",
  errorCode: "INVALID_API_KEYS",
  connectionId: "connection-123",
  requestId: "plaid-request-123",
});
if (serialized !== expected) {
  throw new Error(`Provider log whitelist changed unexpectedly: ${serialized}`);
}

console.log("Provider failure logging is useful and secret-free.");
