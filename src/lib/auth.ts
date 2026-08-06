import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/index";
import * as schema from "@/db/schema";
import { dash } from "@better-auth/infra";
import { createBetterAuthLogger } from "@/server/observability/auth-error";
import { getServerEnvironment } from "@/server/env";

const env = getServerEnvironment();
const authBaseURL = env.betterAuthUrl;

function getAuthHost() {
  if (!authBaseURL) return undefined;

  return new URL(authBaseURL).hostname;
}

const betterAuthApiKey = env.betterAuthApiKey;

export const auth = betterAuth({
  appName: "FinWin",
  logger: createBetterAuthLogger(),
  secret:
    env.betterAuthSecret ??
    env.legacyAuthSecret ??
    betterAuthApiKey,
  baseURL: authBaseURL,
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
      clientId: env.githubClientId,
      clientSecret: env.githubClientSecret,
    },
    google: {
      clientId: env.googleClientId,
      clientSecret: env.googleClientSecret,
    },
  },
});
