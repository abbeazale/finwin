import {
  logProviderError,
  type ProviderErrorEvent,
} from "../src/server/observability/provider-error";
import {
  createBetterAuthLogger,
  type AuthErrorEvent,
} from "../src/server/observability/auth-error";

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

let capturedAuthEvent: AuthErrorEvent | undefined;
const authLogger = createBetterAuthLogger((event) => {
  capturedAuthEvent = event;
});
authLogger.log(
  "error",
  `Failed query containing ${secrets.body}`,
  new Error(`oauth_state=${secrets.accessToken}&code_verifier=${secrets.secret}`),
  { headers: { authorization: secrets.clientId } },
);

if (!capturedAuthEvent) throw new Error("Forced auth failure did not emit a log event.");
const serializedAuthEvent = JSON.stringify(capturedAuthEvent);
for (const secret of Object.values(secrets)) {
  if (serializedAuthEvent.includes(secret)) {
    throw new Error("Better Auth log contains secret-bearing input.");
  }
}
if (
  capturedAuthEvent.operation !== "better-auth" ||
  capturedAuthEvent.severity !== "error" ||
  capturedAuthEvent.eventCode !== "INTERNAL_ERROR" ||
  !capturedAuthEvent.correlationId
) {
  throw new Error("Better Auth log whitelist changed unexpectedly.");
}

console.log("Provider and auth failure logging is useful and secret-free.");
