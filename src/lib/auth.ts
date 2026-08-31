import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "@/index";
import * as schema from "@/db/schema";
import { dash } from "@better-auth/infra";
import { createBetterAuthLogger } from "@/server/observability/auth-error";
import {
  createCorrelationId,
  logProviderError,
} from "@/server/observability/provider-error";
import { sendTransactionalEmail } from "@/server/mail/send";
import { buildPasswordResetEmail } from "@/server/mail/templates/password-reset";
import { getServerEnvironment } from "@/server/env";
import { PASSWORD_RESET_EXPIRY_MINUTES } from "@/lib/password-policy";

const env = getServerEnvironment();
const authBaseURL = env.betterAuthUrl;

const betterAuthApiKey = env.betterAuthApiKey;

export const auth = betterAuth({
  appName: "FinWin",
  logger: createBetterAuthLogger(),
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
    resetPasswordTokenExpiresIn: PASSWORD_RESET_EXPIRY_MINUTES * 60,
    // A reset means the account may already be compromised. Drop every other
    // session so an attacker holding a stolen cookie is signed out too.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const correlationId = createCorrelationId(undefined);
      try {
        await sendTransactionalEmail(
          buildPasswordResetEmail({
            to: user.email,
            resetUrl: url,
            expiresInMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
          }),
          correlationId,
        );
      } catch (err) {
        // Better Auth awaits this callback. If it rejected, the endpoint would
        // fail only for addresses that exist, which would let an attacker
        // enumerate accounts. Swallow the failure and keep the reply uniform.
        logProviderError(err, {
          operation: "resend-email-send",
          correlationId,
          errorCode: "MAIL_SEND_UNHANDLED",
        });
      }
    },
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
