import { parseServerEnvironment } from "../src/server/env";
import {
  getSecurityHeaders,
  poweredByHeader,
} from "../src/server/security/headers";

const authSecret = Buffer.alloc(32, 7).toString("base64");
const canonicalOrigin = "https://finwin.abbeazale.com";
const env = parseServerEnvironment({
  FINWIN_ENV: "production",
  VERCEL_ENV: "production",
  DATABASE_ENVIRONMENT: "production",
  DATABASE_URL: "postgresql://finwin:finwin@production.db.example/finwin",
  BETTER_AUTH_URL: canonicalOrigin,
  FINWIN_CANONICAL_ORIGIN: canonicalOrigin,
  AUTH_TRUSTED_ORIGINS: canonicalOrigin,
  BETTER_AUTH_API_KEY: "dash-production-key",
  BETTER_AUTH_SECRET: authSecret,
  BETTER_AUTH_SECRETS: `1:${authSecret}`,
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  PLAID_CLIENT_ID: "plaid-client-id",
  PLAID_SECRET: "plaid-secret",
  PLAID_ENV: "production",
  PLAID_WEBHOOK_URL: `${canonicalOrigin}/api/plaid/webhook`,
  PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION: "v1",
  PLAID_TOKEN_ENCRYPTION_KEYS: JSON.stringify({
    v1: Buffer.alloc(32, 8).toString("base64"),
  }),
  FX_REFRESH_SECRET: "fx-refresh-secret-at-least-32-characters",
  PLAID_REVOCATION_RETRY_SECRET: "plaid-revocation-retry-secret-32-chars",
  RESEND_API_KEY: "re_production_key",
  FINWIN_MAIL_FROM: `FinWin <desk@${new URL(canonicalOrigin).hostname}>`,
});

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

expect(env.canonicalOrigin === canonicalOrigin, "Canonical origin changed.");
expect(
  env.authTrustedOrigins.length === 1 &&
    env.authTrustedOrigins[0] === canonicalOrigin,
  "Production trusted origins are not canonical-only.",
);
expect(env.secureCookies, "Production cookies are not forced secure.");
expect(env.passkeyRpId === "finwin.abbeazale.com", "Passkey RP ID is not canonical.");
expect(
  env.githubOAuthCallbackUrl === `${canonicalOrigin}/api/auth/callback/github`,
  "GitHub OAuth callback is not canonical.",
);
expect(
  env.googleOAuthCallbackUrl === `${canonicalOrigin}/api/auth/callback/google`,
  "Google OAuth callback is not canonical.",
);
expect(poweredByHeader === false, "Next.js X-Powered-By suppression regressed.");

const headers = new Map(
  getSecurityHeaders("production").map(({ key, value }) => [key, value]),
);
for (const requiredHeader of [
  "Content-Security-Policy",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Strict-Transport-Security",
]) {
  expect(headers.has(requiredHeader), `${requiredHeader} is missing.`);
}

const csp = headers.get("Content-Security-Policy") ?? "";
for (const requiredDirective of [
  "default-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]) {
  expect(csp.includes(requiredDirective), `CSP is missing ${requiredDirective}.`);
}
expect(
  !getSecurityHeaders("local").some(({ key }) => key === "Strict-Transport-Security"),
  "Local responses must not opt localhost into HSTS.",
);

console.log("Canonical auth boundary, cookie, passkey, callback, and header checks passed.");
