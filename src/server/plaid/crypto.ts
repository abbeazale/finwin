import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { getServerEnvironment, resetServerEnvironmentForTests } from "@/server/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
const PAYLOAD_VERSION = "v1";
const keyMapSchema = z.record(z.string(), z.string());

type EncryptionResult = {
  encrypted: string;
  keyVersion: string;
};

type EncryptedPlaidAccessTokenRow = {
  accessTokenEncrypted: string;
  accessTokenKeyVersion: string;
};

type KeyConfig = {
  currentKeyVersion: string;
  keys: Map<string, Buffer>;
};

let keyConfigCache: KeyConfig | null = null;

export function encryptPlaidAccessToken(plaintext: string): EncryptionResult {
  const keyConfig = getKeyConfig();
  const key = getKeyForVersion(keyConfig.currentKeyVersion);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: [
      PAYLOAD_VERSION,
      iv.toString("base64"),
      authTag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(":"),
    keyVersion: keyConfig.currentKeyVersion,
  };
}

function decryptPlaidAccessToken(encrypted: string, keyVersion: string) {
  getKeyConfig();
  const key = getKeyForVersion(keyVersion);
  const parts = encrypted.split(":");

  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
    throw new Error("Invalid Plaid token payload format.");
  }

  const [, ivPart, authTagPart, ciphertextPart] = parts;
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64"));
  decipher.setAuthTag(Buffer.from(authTagPart, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

/**
 * Convenience wrapper for the common `bank_connections`-row decryption shape:
 * routers and the sync path all read `accessTokenEncrypted` +
 * `accessTokenKeyVersion` together, so co-locate the unpack here.
 */
export function decryptPlaidAccessTokenFromRow(row: EncryptedPlaidAccessTokenRow) {
  return decryptPlaidAccessToken(row.accessTokenEncrypted, row.accessTokenKeyVersion);
}

/** Clears the module key cache so tests can reconfigure encryption keys. */
export function resetPlaidCryptoKeyCacheForTests() {
  keyConfigCache = null;
  resetServerEnvironmentForTests();
}

function getKeyConfig(): KeyConfig {
  keyConfigCache ??= loadKeyConfig();
  return keyConfigCache;
}

function loadKeyConfig(): KeyConfig {
  const env = getServerEnvironment();
  const currentKeyVersion = env.plaidTokenEncryptionCurrentKeyVersion;
  const rawKeys = env.plaidTokenEncryptionKeys;

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawKeys);
  } catch {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEYS must be valid JSON.");
  }

  const parsed = keyMapSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEYS must be a JSON object of base64 strings.");
  }

  const keys = new Map<string, Buffer>();

  for (const [version, value] of Object.entries(parsed.data)) {
    const key = Buffer.from(value, "base64");
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(
        `Encryption key for version "${version}" must decode to ${KEY_LENGTH_BYTES} bytes.`,
      );
    }

    keys.set(version, key);
  }

  if (!keys.has(currentKeyVersion)) {
    throw new Error(
      `Current Plaid encryption key version "${currentKeyVersion}" is not configured.`,
    );
  }

  return { currentKeyVersion, keys };
}

function getKeyForVersion(version: string) {
  const keyConfig = getKeyConfig();
  const key = keyConfig.keys.get(version);

  if (!key) {
    throw new Error(`Unknown Plaid encryption key version "${version}".`);
  }

  return key;
}
