import { getSecurityHeaders } from "../src/server/security/headers";

async function main() {
  const target = process.argv[2];
  if (!target) {
    throw new Error("Usage: bun run security:check:deployed -- https://finwin.example");
  }

  const targetOrigin = new URL(target);
  if (
    targetOrigin.protocol !== "https:" ||
    targetOrigin.pathname !== "/" ||
    targetOrigin.search ||
    targetOrigin.hash
  ) {
    throw new Error("The deployed security target must be an HTTPS origin.");
  }

  const response = await fetch(targetOrigin, { redirect: "manual" });
  if (!response.ok) {
    throw new Error(
      `Canonical origin must return a direct 2xx response; received HTTP ${response.status}.`,
    );
  }

  function expectHeader(name: string, expected?: string) {
    const value = response.headers.get(name);
    if (!value) throw new Error(`${name} is missing from ${targetOrigin.origin}.`);
    if (expected && value !== expected) {
      throw new Error(`${name} does not match the approved value.`);
    }
  }

  for (const { key, value } of getSecurityHeaders("production")) {
    expectHeader(key, value);
  }

  if (response.headers.has("x-powered-by")) {
    throw new Error("X-Powered-By must not be exposed.");
  }

  console.log(`Deployed security headers passed for ${targetOrigin.origin}.`);
}

void main();
