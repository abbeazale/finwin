import { z } from "zod";

const deploymentEnvironmentSchema = z.enum([
  "local",
  "preview",
  "staging",
  "production",
]);
const databaseEnvironmentSchema = deploymentEnvironmentSchema;
const plaidEnvironmentSchema = z.enum(["sandbox", "development", "production"]);

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
  BETTER_AUTH_API_KEY: optionalString,
  BETTER_AUTH_SECRET: optionalString,
  AUTH_SECRET: optionalString,
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
});

type RawEnvironment = z.infer<typeof rawEnvironmentSchema>;
export type EnvironmentSource = Record<string, string | undefined>;
type DeploymentEnvironment = z.infer<typeof deploymentEnvironmentSchema>;

type ServerEnvironment = {
  deployment: DeploymentEnvironment;
  databaseEnvironment: DeploymentEnvironment;
  databaseUrl: string;
  betterAuthUrl: string;
  betterAuthApiKey: string;
  betterAuthSecret: string | undefined;
  legacyAuthSecret: string | undefined;
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
      deployment !== "local" && url.protocol !== "https:",
      `${name} must use HTTPS outside local development.`,
    );
  } catch {
    issues.push(`${name} must be a valid absolute URL.`);
  }
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
  const betterAuthApiKey = requireValue(raw, "BETTER_AUTH_API_KEY", issues);
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
      !raw.BETTER_AUTH_SECRET || raw.BETTER_AUTH_SECRET.length < 32,
      "BETTER_AUTH_SECRET must be at least 32 characters outside local development.",
    );
    addIssue(
      issues,
      !raw.FX_REFRESH_SECRET || raw.FX_REFRESH_SECRET.length < 32,
      "FX_REFRESH_SECRET must be at least 32 characters outside local development.",
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
    betterAuthUrl: new URL(betterAuthUrl).origin,
    betterAuthApiKey,
    betterAuthSecret: raw.BETTER_AUTH_SECRET,
    legacyAuthSecret: raw.AUTH_SECRET,
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
  };
}

export function getServerEnvironment() {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}

export function resetServerEnvironmentForTests() {
  cachedEnvironment = undefined;
}
