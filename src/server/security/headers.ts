type DeploymentEnvironment = "local" | "preview" | "staging" | "production";

type SecurityHeader = { key: string; value: string };

export const poweredByHeader = false;

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.plaid.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.plaid.com https://*.vercel-insights.com",
  "frame-src https://cdn.plaid.com https://*.plaid.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const baselineHeaders: SecurityHeader[] = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

export function getSecurityHeaders(
  deployment: DeploymentEnvironment,
): SecurityHeader[] {
  if (deployment !== "production") return baselineHeaders;
  return [
    ...baselineHeaders,
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
  ];
}
