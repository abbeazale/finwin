import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/index";
import * as schema from "@/db/schema";
import { dash } from "@better-auth/infra";
import { createBetterAuthLogger } from "@/server/observability/auth-error";

const authBaseURL = process.env.BETTER_AUTH_URL?.replace(/\/$/, "");

function requiredAuthEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to configure authentication.`);
  }
  return value;
}

function getAuthHost() {
  if (!authBaseURL) return undefined;

  return new URL(authBaseURL).hostname;
}

const betterAuthApiKey = requiredAuthEnv("BETTER_AUTH_API_KEY");

export const auth = betterAuth({
  appName: "FinWin",
  logger: createBetterAuthLogger(),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    process.env.AUTH_SECRET ??
    betterAuthApiKey,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [
    "https://finwin.abbeazale.tech",
    "https://finwin-vert.vercel.app",
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [
    dash({ apiKey: betterAuthApiKey }),
    passkey({
      rpName: "FinWin",
      rpID: getAuthHost(),
      origin: authBaseURL,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    }),
    twoFactor({
      issuer: "FinWin",
      allowPasswordless: true,
    }),
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    github: {
      clientId: requiredAuthEnv("GITHUB_CLIENT_ID"),
      clientSecret: requiredAuthEnv("GITHUB_CLIENT_SECRET"),
    },
    google: {
      clientId: requiredAuthEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requiredAuthEnv("GOOGLE_CLIENT_SECRET"),
    },
  },
});
