import {
  parseEnvelope,
  symmetricDecrypt,
  symmetricEncrypt,
} from "better-auth/crypto";
import {
  createBetterAuthSecretConfig,
  encryptOAuthTokenIfNeeded,
} from "../src/server/auth/oauth-token-migration";

const v1 = Buffer.alloc(32, 3).toString("base64");
const v2 = Buffer.alloc(32, 4).toString("base64");
const token = "oauth-access-token-for-migration-check";
const initialConfig = createBetterAuthSecretConfig(
  [{ version: 1, value: v1 }],
  v1,
);
const rotatedConfig = createBetterAuthSecretConfig(
  [
    { version: 2, value: v2 },
    { version: 1, value: v1 },
  ],
  v1,
);

async function main() {
  const encryptedV1 = await encryptOAuthTokenIfNeeded(token, initialConfig);
  if (!encryptedV1 || parseEnvelope(encryptedV1)?.version !== 1) {
    throw new Error("OAuth migration did not produce a versioned v1 envelope.");
  }
  if (encryptedV1.includes(token)) {
    throw new Error("OAuth token plaintext is visible in its encrypted value.");
  }
  if ((await encryptOAuthTokenIfNeeded(encryptedV1, initialConfig)) !== encryptedV1) {
    throw new Error("OAuth token migration is not idempotent.");
  }
  if ((await symmetricDecrypt({ key: rotatedConfig, data: encryptedV1 })) !== token) {
    throw new Error("Rotated secrets cannot decrypt the previous version.");
  }

  const encryptedV2 = await encryptOAuthTokenIfNeeded(token, rotatedConfig);
  if (!encryptedV2 || parseEnvelope(encryptedV2)?.version !== 2) {
    throw new Error("New OAuth encryption did not use the current v2 secret.");
  }

  const legacyCiphertext = await symmetricEncrypt({ key: v1, data: token });
  if ((await symmetricDecrypt({ key: rotatedConfig, data: legacyCiphertext })) !== token) {
    throw new Error("Legacy encrypted user data cannot use the singular fallback secret.");
  }

  console.log("Better Auth rotation and OAuth token migration checks passed.");
}

void main();
