import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/index";
import * as schema from "@/db/schema";
import { dash } from "@better-auth/infra";
import { getServerEnvironment } from "@/server/env";

const env = getServerEnvironment();
const authBaseURL = env.betterAuthUrl;

const betterAuthApiKey = env.betterAuthApiKey;

export const auth = betterAuth({
  appName: "FinWin",
  secret: env.betterAuthSecret,
  secrets: env.betterAuthSecrets,
  baseURL: authBaseURL,
  trustedOrigins: env.authTrustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  account: {
    encryptOAuthTokens: true,
  },
  advanced: {
    useSecureCookies: env.secureCookies,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.secureCookies,
    },
  },
  plugins: [
    dash({ apiKey: betterAuthApiKey }),
    passkey({
      rpName: "FinWin",
      rpID: env.passkeyRpId,
      origin: env.canonicalOrigin,
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
