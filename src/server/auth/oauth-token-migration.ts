import {
  type SecretConfig,
  symmetricEncrypt,
} from "better-auth/crypto";
import { getServerEnvironment } from "@/server/env";

type VersionedSecret = { version: number; value: string };

export function createBetterAuthSecretConfig(
  secrets: VersionedSecret[],
  legacySecret: string,
): SecretConfig {
  const current = secrets[0];
  if (!current) throw new Error("At least one versioned Better Auth secret is required.");
  return {
    keys: new Map(secrets.map((secret) => [secret.version, secret.value])),
    currentVersion: current.version,
    legacySecret,
  };
}

function getBetterAuthSecretConfig() {
  const env = getServerEnvironment();
  return createBetterAuthSecretConfig(
    env.betterAuthSecrets,
    env.betterAuthSecret,
  );
}

export async function encryptOAuthTokenIfNeeded(
  token: string | null,
  secretConfig: SecretConfig = getBetterAuthSecretConfig(),
) {
  if (!token || token.startsWith("$ba$")) return token;
  return symmetricEncrypt({ key: secretConfig, data: token });
}
