import {
  type EnvironmentSource,
  parseServerEnvironment,
} from "../src/server/env";

const authSecretV1 = Buffer.alloc(32, 2).toString("base64");

const base = {
  FINWIN_ENV: "local",
  DATABASE_ENVIRONMENT: "local",
  DATABASE_URL: "postgresql://finwin:finwin@localhost:5432/finwin",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_API_KEY: "dash-local-key",
  BETTER_AUTH_SECRET: authSecretV1,
  BETTER_AUTH_SECRETS: `1:${authSecretV1}`,
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  PLAID_CLIENT_ID: "plaid-client-id",
  PLAID_SECRET: "plaid-secret",
  PLAID_ENV: "sandbox",
  PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION: "v1",
  PLAID_TOKEN_ENCRYPTION_KEYS: JSON.stringify({
    v1: Buffer.alloc(32, 1).toString("base64"),
  }),
  FX_REFRESH_SECRET: "fx-refresh-secret-at-least-32-characters",
  PLAID_REVOCATION_RETRY_SECRET: "plaid-revocation-retry-secret-32-chars",
} satisfies EnvironmentSource;

function expectValid(name: string, overrides: EnvironmentSource) {
  try {
    parseServerEnvironment({ ...base, ...overrides });
  } catch (error) {
    throw new Error(`${name} should be valid.`, { cause: error });
  }
}

function expectInvalid(name: string, overrides: EnvironmentSource, message: string) {
  try {
    parseServerEnvironment({ ...base, ...overrides });
  } catch (error) {
    if (error instanceof Error && error.message.includes(message)) return;
    throw new Error(`${name} failed for an unexpected reason.`, { cause: error });
  }
  throw new Error(`${name} should have been rejected.`);
}

expectValid("local contract", {});
expectValid("preview contract", {
  FINWIN_ENV: "preview",
  DATABASE_ENVIRONMENT: "preview",
  DATABASE_URL: "postgresql://finwin:finwin@preview.db.example/finwin",
  BETTER_AUTH_URL: "https://preview.finwin.example",
  AUTH_TRUSTED_ORIGINS: "https://preview.finwin.example",
});
expectValid("staging contract", {
  FINWIN_ENV: "staging",
  DATABASE_ENVIRONMENT: "staging",
  DATABASE_URL: "postgresql://finwin:finwin@staging.db.example/finwin",
  BETTER_AUTH_URL: "https://staging.finwin.example",
  AUTH_TRUSTED_ORIGINS: "https://staging.finwin.example",
  PLAID_ENV: "development",
  PLAID_WEBHOOK_URL: "https://staging.finwin.example/api/plaid/webhook",
  RESEND_API_KEY: "re_staging_key",
  FINWIN_MAIL_FROM: "FinWin <desk@staging.finwin.example>",
});
const productionContract = {
  FINWIN_ENV: "production",
  DATABASE_ENVIRONMENT: "production",
  DATABASE_URL: "postgresql://finwin:finwin@production.db.example/finwin",
  BETTER_AUTH_URL: "https://finwin.example",
  FINWIN_CANONICAL_ORIGIN: "https://finwin.example",
  AUTH_TRUSTED_ORIGINS: "https://finwin.example",
  PLAID_ENV: "production",
  PLAID_WEBHOOK_URL: "https://finwin.example/api/plaid/webhook",
  RESEND_API_KEY: "re_production_key",
  FINWIN_MAIL_FROM: "FinWin <desk@finwin.example>",
} satisfies EnvironmentSource;
expectValid("production contract", productionContract);
expectInvalid(
  "preview production database isolation",
  { FINWIN_ENV: "preview", DATABASE_ENVIRONMENT: "production" },
  "DATABASE_ENVIRONMENT=production cannot be used by FINWIN_ENV=preview",
);
expectInvalid(
  "preview production Plaid isolation",
  { FINWIN_ENV: "preview", DATABASE_ENVIRONMENT: "preview", PLAID_ENV: "production" },
  "Preview deployments must use PLAID_ENV=sandbox",
);
expectInvalid(
  "production secret requirement",
  {
    FINWIN_ENV: "production",
    DATABASE_ENVIRONMENT: "production",
    DATABASE_URL: "postgresql://finwin:finwin@production.db.example/finwin",
    BETTER_AUTH_URL: "https://finwin.example",
    FINWIN_CANONICAL_ORIGIN: "https://finwin.example",
    AUTH_TRUSTED_ORIGINS: "https://finwin.example",
    BETTER_AUTH_SECRET: "short",
    PLAID_ENV: "production",
    PLAID_WEBHOOK_URL: "https://finwin.example/api/plaid/webhook",
  },
  "BETTER_AUTH_SECRET must be a base64-encoded 32-byte key",
);
expectInvalid(
  "production versioned secret requirement",
  {
    FINWIN_ENV: "production",
    DATABASE_ENVIRONMENT: "production",
    DATABASE_URL: "postgresql://finwin:finwin@production.db.example/finwin",
    BETTER_AUTH_URL: "https://finwin.example",
    FINWIN_CANONICAL_ORIGIN: "https://finwin.example",
    AUTH_TRUSTED_ORIGINS: "https://finwin.example",
    BETTER_AUTH_SECRETS: undefined,
    PLAID_ENV: "production",
    PLAID_WEBHOOK_URL: "https://finwin.example/api/plaid/webhook",
  },
  "BETTER_AUTH_SECRETS is required outside local development",
);
expectInvalid(
  "auth and provider secret isolation",
  { BETTER_AUTH_API_KEY: authSecretV1 },
  "Better Auth secrets must be independent from API and provider secrets",
);
expectInvalid(
  "production canonical origin mismatch",
  {
    FINWIN_ENV: "production",
    DATABASE_ENVIRONMENT: "production",
    DATABASE_URL: "postgresql://finwin:finwin@production.db.example/finwin",
    BETTER_AUTH_URL: "https://deployment.finwin.example",
    FINWIN_CANONICAL_ORIGIN: "https://finwin.example",
    AUTH_TRUSTED_ORIGINS: "https://deployment.finwin.example",
    PLAID_ENV: "production",
    PLAID_WEBHOOK_URL: "https://finwin.example/api/plaid/webhook",
  },
  "BETTER_AUTH_URL must match FINWIN_CANONICAL_ORIGIN in production",
);
expectInvalid(
  "wildcard trusted origin",
  { AUTH_TRUSTED_ORIGINS: "https://*.finwin.example,http://localhost:3000" },
  "AUTH_TRUSTED_ORIGINS cannot contain wildcard origins",
);
expectInvalid(
  "production password recovery mail requirement",
  { ...productionContract, RESEND_API_KEY: undefined },
  "RESEND_API_KEY is required for staging and production",
);
expectInvalid(
  "production mail sender requirement",
  { ...productionContract, FINWIN_MAIL_FROM: undefined },
  "FINWIN_MAIL_FROM is required for staging and production",
);
expectInvalid(
  "malformed mail sender",
  { FINWIN_MAIL_FROM: "FinWin desk" },
  "FINWIN_MAIL_FROM must be an email address",
);
expectInvalid(
  "revocation retry secret requirement",
  { ...productionContract, PLAID_REVOCATION_RETRY_SECRET: "short" },
  "PLAID_REVOCATION_RETRY_SECRET must be at least 32 characters",
);
expectInvalid(
  "revocation retry secret isolation",
  { PLAID_REVOCATION_RETRY_SECRET: authSecretV1 },
  "Better Auth secrets must be independent from API and provider secrets",
);

console.log("Environment, origin, preview isolation, and auth secret checks passed.");
