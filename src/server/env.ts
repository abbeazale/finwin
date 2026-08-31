import { z } from "zod";

const deploymentEnvironmentSchema = z.enum([
  "local",
  "preview",
  "staging",
  "production",
]);
const databaseEnvironmentSchema = deploymentEnvironmentSchema;
const plaidEnvironmentSchema = z.enum(["sandbox", "development", "production"]);
const LOCAL_AUTH_SECRET = "finwin-local-development-secret-never-use-in-deployment";

const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const rawEnvironmentSchema = z.object({
  FINWIN_ENV: deploymentEnvironmentSchema.optional(),
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
  DATABASE_ENVIRONMENT: databaseEnvironmentSchema.optional(),
  DATABASE_URL: optionalString,
  BETTER_AUTH_URL: optionalString,
  FINWIN_CANONICAL_ORIGIN: optionalString,
  AUTH_TRUSTED_ORIGINS: optionalString,
  BETTER_AUTH_API_KEY: optionalString,
  BETTER_AUTH_SECRET: optionalString,
  BETTER_AUTH_SECRETS: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  PLAID_CLIENT_ID: optionalString,
  PLAID_SECRET: optionalString,
  PLAID_ENV: plaidEnvironmentSchema.optional(),
  PLAID_WEBHOOK_URL: optionalString,
  PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION: optionalString,
  PLAID_TOKEN_ENCRYPTION_KEYS: optionalString,
  FINNHUB_API_KEY: optionalString,
  OER_KEY: optionalString,
  FX_REFRESH_SECRET: optionalString,
  RESEND_API_KEY: optionalString,
  FINWIN_MAIL_FROM: optionalString,
  PLAID_REVOCATION_RETRY_SECRET: optionalString,
});

type RawEnvironment = z.infer<typeof rawEnvironmentSchema>;
export type EnvironmentSource = Record<string, string | undefined>;
type DeploymentEnvironment = z.infer<typeof deploymentEnvironmentSchema>;
type BetterAuthSecret = { version: number; value: string };

type ServerEnvironment = {
  deployment: DeploymentEnvironment;
  databaseEnvironment: DeploymentEnvironment;
  databaseUrl: string;
  betterAuthUrl: string;
  canonicalOrigin: string;
  authTrustedOrigins: string[];
  githubOAuthCallbackUrl: string;
  googleOAuthCallbackUrl: string;
  passkeyRpId: string;
  secureCookies: boolean;
  betterAuthApiKey: string;
  betterAuthSecret: string;
  betterAuthSecrets: BetterAuthSecret[];
  githubClientId: string;
  githubClientSecret: string;
  googleClientId: string;
  googleClientSecret: string;
  plaidClientId: string;
  plaidSecret: string;
  plaidEnvironment: z.infer<typeof plaidEnvironmentSchema>;
  plaidWebhookUrl: string | undefined;
  plaidTokenEncryptionCurrentKeyVersion: string;
  plaidTokenEncryptionKeys: string;
  finnhubApiKey: string | undefined;
  openExchangeRatesKey: string | undefined;
  fxRefreshSecret: string | undefined;
  resendApiKey: string | undefined;
  mailFrom: string | undefined;
  plaidRevocationRetrySecret: string | undefined;
};

let cachedEnvironment: ServerEnvironment | undefined;

function addIssue(issues: string[], condition: unknown, message: string) {
  if (condition) issues.push(message);
}

function requireValue(raw: RawEnvironment, key: keyof RawEnvironment, issues: string[]) {
  const value = raw[key];
  if (typeof value === "string" && value.length > 0) return value;
  issues.push(`${key} is required.`);
  return "";
}

function resolveDeployment(raw: RawEnvironment): DeploymentEnvironment {
  if (raw.FINWIN_ENV) return raw.FINWIN_ENV;
  if (raw.VERCEL_ENV === "preview") return "preview";
  if (raw.VERCEL_ENV === "production") return "production";
  return "local";
}

function validateOrigin(name: string, value: string, deployment: DeploymentEnvironment, issues: string[]) {
  if (!value) return;
  try {
    const url = new URL(value);
    addIssue(
      issues,
      url.pathname !== "/" || url.search.length > 0 || url.hash.length > 0,
      `${name} must be an origin without a path, query, or fragment.`,
    );
    addIssue(
      issues,
      Boolean(url.username || url.password),
      `${name} cannot contain credentials.`,
    );
    addIssue(
      issues,
      deployment !== "local" && url.protocol !== "https:",
      `${name} must use HTTPS outside local development.`,
    );
  } catch {
    issues.push(`${name} must be a valid absolute URL.`);
  }
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function parseTrustedOrigins(
  rawValue: string | undefined,
  authOrigin: string,
  deployment: DeploymentEnvironment,
  issues: string[],
) {
  if (!rawValue) {
    addIssue(
      issues,
      deployment !== "local",
      "AUTH_TRUSTED_ORIGINS is required outside local development.",
    );
    return authOrigin ? [authOrigin] : [];
  }

  const origins = rawValue.split(",").map((origin) => origin.trim()).filter(Boolean);
  addIssue(issues, origins.length === 0, "AUTH_TRUSTED_ORIGINS cannot be empty.");
  addIssue(
    issues,
    new Set(origins).size !== origins.length,
    "AUTH_TRUSTED_ORIGINS cannot contain duplicates.",
  );
  for (const origin of origins) {
    addIssue(
      issues,
      origin.includes("*"),
      "AUTH_TRUSTED_ORIGINS cannot contain wildcard origins.",
    );
    validateOrigin("AUTH_TRUSTED_ORIGINS entry", origin, deployment, issues);
  }
  addIssue(
    issues,
    Boolean(authOrigin) && !origins.includes(authOrigin),
    "AUTH_TRUSTED_ORIGINS must include BETTER_AUTH_URL.",
  );
  return origins;
}

function validateDatabaseUrl(value: string, deployment: DeploymentEnvironment, issues: string[]) {
  if (!value) return;
  try {
    const url = new URL(value);
    addIssue(
      issues,
      url.protocol !== "postgres:" && url.protocol !== "postgresql:",
      "DATABASE_URL must use the postgres or postgresql protocol.",
    );
    addIssue(
      issues,
      deployment !== "local" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname),
      "DATABASE_URL cannot target a loopback host outside local development.",
    );
  } catch {
    issues.push("DATABASE_URL must be a valid PostgreSQL URL.");
  }
}

function validateWebhookUrl(value: string | undefined, issues: string[]) {
  if (!value) return;
  try {
    const url = new URL(value);
    addIssue(issues, url.protocol !== "https:", "PLAID_WEBHOOK_URL must use HTTPS.");
    addIssue(
      issues,
      url.pathname !== "/api/plaid/webhook" || url.search.length > 0 || url.hash.length > 0,
      "PLAID_WEBHOOK_URL must point to /api/plaid/webhook without a query or fragment.",
    );
  } catch {
    issues.push("PLAID_WEBHOOK_URL must be a valid absolute URL.");
  }
}

function validateEncryptionKeys(raw: RawEnvironment, issues: string[]) {
  const currentVersion = raw.PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION;
  const rawKeys = raw.PLAID_TOKEN_ENCRYPTION_KEYS;
  if (!currentVersion || !rawKeys) return;

  let keys: unknown;
  try {
    keys = JSON.parse(rawKeys);
  } catch {
    issues.push("PLAID_TOKEN_ENCRYPTION_KEYS must be valid JSON.");
    return;
  }
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) {
    issues.push("PLAID_TOKEN_ENCRYPTION_KEYS must be a JSON object.");
    return;
  }

  const entries = Object.entries(keys);
  addIssue(issues, entries.length === 0, "PLAID_TOKEN_ENCRYPTION_KEYS cannot be empty.");
  for (const [version, encodedKey] of entries) {
    if (typeof encodedKey !== "string") {
      issues.push(`Plaid encryption key ${version} must be a base64 string.`);
      continue;
    }
    const decoded = Buffer.from(encodedKey, "base64");
    const canonical = decoded.toString("base64").replace(/=+$/, "");
    const supplied = encodedKey.replace(/=+$/, "");
    addIssue(
      issues,
      decoded.length !== 32 || canonical !== supplied,
      `Plaid encryption key ${version} must be exactly 32 bytes encoded as base64.`,
    );
  }
  addIssue(
    issues,
    !(currentVersion in keys),
    "PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION must exist in PLAID_TOKEN_ENCRYPTION_KEYS.",
  );
}

function validateMailFrom(value: string | undefined, issues: string[]) {
  if (!value) return;
  const address = value.includes("<")
    ? value.slice(value.indexOf("<") + 1, value.lastIndexOf(">"))
    : value;
  addIssue(
    issues,
    !/^[^\s@<>]+@[^\s@<>.]+\.[^\s@<>]+$/.test(address.trim()),
    "FINWIN_MAIL_FROM must be an email address, optionally as \"Name <user@domain>\".",
  );
}

function isBase64Key(value: string) {
  const decoded = Buffer.from(value, "base64");
  return (
    decoded.length === 32 &&
    decoded.toString("base64").replace(/=+$/, "") === value.replace(/=+$/, "")
  );
}

function parseBetterAuthSecrets(
  rawValue: string | undefined,
  legacySecret: string,
  deployment: DeploymentEnvironment,
  issues: string[],
): BetterAuthSecret[] {
  if (!rawValue) {
    addIssue(
      issues,
      deployment !== "local",
      "BETTER_AUTH_SECRETS is required outside local development.",
    );
    return legacySecret ? [{ version: 1, value: legacySecret }] : [];
  }

  const secrets: BetterAuthSecret[] = [];
  const seenVersions = new Set<number>();
  const seenValues = new Set<string>();
  for (const entry of rawValue.split(",")) {
    const separator = entry.indexOf(":");
    const version = Number(entry.slice(0, separator));
    const value = entry.slice(separator + 1).trim();
    if (separator < 1 || !Number.isInteger(version) || version < 0 || !value) {
      issues.push("BETTER_AUTH_SECRETS entries must use <non-negative-version>:<secret>.");
      continue;
    }
    addIssue(issues, seenVersions.has(version), `BETTER_AUTH_SECRETS contains duplicate version ${version}.`);
    addIssue(issues, seenValues.has(value), "BETTER_AUTH_SECRETS cannot reuse a key across versions.");
    seenVersions.add(version);
    seenValues.add(value);
    secrets.push({ version, value });
  }

  if (deployment !== "local") {
    for (const secret of secrets) {
      addIssue(
        issues,
        !isBase64Key(secret.value),
        `Better Auth secret version ${secret.version} must be a base64-encoded 32-byte key.`,
      );
    }
  }
  return secrets;
}

export function parseServerEnvironment(source: EnvironmentSource): ServerEnvironment {
  const parsed = rawEnvironmentSchema.safeParse(source);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid FinWin environment:\n- ${messages.join("\n- ")}`);
  }

  const raw = parsed.data;
  const deployment = resolveDeployment(raw);
  const issues: string[] = [];
  const databaseEnvironment = raw.DATABASE_ENVIRONMENT ?? "local";
  const databaseUrl = requireValue(raw, "DATABASE_URL", issues);
  const betterAuthUrl = requireValue(raw, "BETTER_AUTH_URL", issues);
  const authOrigin = normalizeOrigin(betterAuthUrl);
  const canonicalOrigin = normalizeOrigin(raw.FINWIN_CANONICAL_ORIGIN ?? authOrigin);
  const authTrustedOrigins = parseTrustedOrigins(
    raw.AUTH_TRUSTED_ORIGINS,
    authOrigin,
    deployment,
    issues,
  );
  const betterAuthApiKey = requireValue(raw, "BETTER_AUTH_API_KEY", issues);
  const betterAuthSecret = raw.BETTER_AUTH_SECRET ?? (
    deployment === "local" ? LOCAL_AUTH_SECRET : ""
  );
  addIssue(
    issues,
    deployment !== "local" && !raw.BETTER_AUTH_SECRET,
    "BETTER_AUTH_SECRET is required outside local development.",
  );
  const betterAuthSecrets = parseBetterAuthSecrets(
    raw.BETTER_AUTH_SECRETS,
    betterAuthSecret,
    deployment,
    issues,
  );
  const githubClientId = requireValue(raw, "GITHUB_CLIENT_ID", issues);
  const githubClientSecret = requireValue(raw, "GITHUB_CLIENT_SECRET", issues);
  const googleClientId = requireValue(raw, "GOOGLE_CLIENT_ID", issues);
  const googleClientSecret = requireValue(raw, "GOOGLE_CLIENT_SECRET", issues);
  const plaidClientId = requireValue(raw, "PLAID_CLIENT_ID", issues);
  const plaidSecret = requireValue(raw, "PLAID_SECRET", issues);
  const plaidEnvironment = raw.PLAID_ENV ?? "sandbox";
  const plaidTokenEncryptionCurrentKeyVersion = requireValue(
    raw,
    "PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION",
    issues,
  );
  const plaidTokenEncryptionKeys = requireValue(raw, "PLAID_TOKEN_ENCRYPTION_KEYS", issues);

  validateOrigin("BETTER_AUTH_URL", betterAuthUrl, deployment, issues);
  validateOrigin(
    "FINWIN_CANONICAL_ORIGIN",
    raw.FINWIN_CANONICAL_ORIGIN ?? canonicalOrigin,
    deployment,
    issues,
  );
  validateDatabaseUrl(databaseUrl, deployment, issues);
  validateEncryptionKeys(raw, issues);
  addIssue(
    issues,
    databaseEnvironment !== deployment,
    `DATABASE_ENVIRONMENT=${databaseEnvironment} cannot be used by FINWIN_ENV=${deployment}.`,
  );

  if (raw.FINWIN_ENV === "production") {
    addIssue(
      issues,
      raw.VERCEL_ENV !== undefined && raw.VERCEL_ENV !== "production",
      "FINWIN_ENV=production requires VERCEL_ENV=production when VERCEL_ENV is set.",
    );
  }

  if (deployment === "production") {
    addIssue(
      issues,
      !raw.FINWIN_CANONICAL_ORIGIN,
      "FINWIN_CANONICAL_ORIGIN is required in production.",
    );
    addIssue(
      issues,
      canonicalOrigin !== authOrigin,
      "BETTER_AUTH_URL must match FINWIN_CANONICAL_ORIGIN in production.",
    );
    addIssue(
      issues,
      authTrustedOrigins.length !== 1 || authTrustedOrigins[0] !== canonicalOrigin,
      "Production AUTH_TRUSTED_ORIGINS must contain only FINWIN_CANONICAL_ORIGIN.",
    );
  }

  if (deployment === "preview") {
    addIssue(issues, plaidEnvironment !== "sandbox", "Preview deployments must use PLAID_ENV=sandbox.");
  } else if (deployment === "staging") {
    addIssue(
      issues,
      plaidEnvironment !== "development",
      "Staging deployments must use PLAID_ENV=development.",
    );
  } else if (deployment === "production") {
    addIssue(
      issues,
      plaidEnvironment !== "production",
      "Production deployments must use PLAID_ENV=production.",
    );
  }

  if (deployment !== "local") {
    addIssue(
      issues,
      !isBase64Key(betterAuthSecret),
      "BETTER_AUTH_SECRET must be a base64-encoded 32-byte key outside local development.",
    );
    addIssue(
      issues,
      !raw.FX_REFRESH_SECRET || raw.FX_REFRESH_SECRET.length < 32,
      "FX_REFRESH_SECRET must be at least 32 characters outside local development.",
    );
    addIssue(
      issues,
      !raw.PLAID_REVOCATION_RETRY_SECRET || raw.PLAID_REVOCATION_RETRY_SECRET.length < 32,
      "PLAID_REVOCATION_RETRY_SECRET must be at least 32 characters outside local development.",
    );
  }

  validateMailFrom(raw.FINWIN_MAIL_FROM, issues);
  if (deployment === "staging" || deployment === "production") {
    addIssue(
      issues,
      !raw.RESEND_API_KEY,
      "RESEND_API_KEY is required for staging and production so password recovery can send mail.",
    );
    addIssue(
      issues,
      !raw.FINWIN_MAIL_FROM,
      "FINWIN_MAIL_FROM is required for staging and production so password recovery can send mail.",
    );
  }

  const providerSecrets = [
    betterAuthApiKey,
    githubClientSecret,
    googleClientSecret,
    plaidSecret,
    raw.FX_REFRESH_SECRET,
    raw.FINNHUB_API_KEY,
    raw.OER_KEY,
    raw.RESEND_API_KEY,
    raw.PLAID_REVOCATION_RETRY_SECRET,
  ].filter((value): value is string => Boolean(value));
  for (const authSecret of new Set([
    betterAuthSecret,
    ...betterAuthSecrets.map((secret) => secret.value),
  ])) {
    addIssue(
      issues,
      providerSecrets.includes(authSecret),
      "Better Auth secrets must be independent from API and provider secrets.",
    );
  }

  if (deployment === "staging" || deployment === "production") {
    addIssue(issues, !raw.PLAID_WEBHOOK_URL, "PLAID_WEBHOOK_URL is required for staging and production.");
    validateWebhookUrl(raw.PLAID_WEBHOOK_URL, issues);
  }

  if (issues.length > 0) {
    throw new Error(`Invalid FinWin environment:\n- ${issues.join("\n- ")}`);
  }

  return {
    deployment,
    databaseEnvironment,
    databaseUrl,
    betterAuthUrl: authOrigin,
    canonicalOrigin,
    authTrustedOrigins,
    githubOAuthCallbackUrl: `${authOrigin}/api/auth/callback/github`,
    googleOAuthCallbackUrl: `${authOrigin}/api/auth/callback/google`,
    passkeyRpId: new URL(authOrigin).hostname,
    secureCookies: deployment !== "local",
    betterAuthApiKey,
    betterAuthSecret,
    betterAuthSecrets,
    githubClientId,
    githubClientSecret,
    googleClientId,
    googleClientSecret,
    plaidClientId,
    plaidSecret,
    plaidEnvironment,
    plaidWebhookUrl: raw.PLAID_WEBHOOK_URL,
    plaidTokenEncryptionCurrentKeyVersion,
    plaidTokenEncryptionKeys,
    finnhubApiKey: raw.FINNHUB_API_KEY,
    openExchangeRatesKey: raw.OER_KEY,
    fxRefreshSecret: raw.FX_REFRESH_SECRET,
    resendApiKey: raw.RESEND_API_KEY,
    mailFrom: raw.FINWIN_MAIL_FROM,
    plaidRevocationRetrySecret: raw.PLAID_REVOCATION_RETRY_SECRET,
  };
}

export function getServerEnvironment() {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}

export function resetServerEnvironmentForTests() {
  cachedEnvironment = undefined;
}
