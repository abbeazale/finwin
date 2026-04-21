import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;
const PAYLOAD_VERSION = "v1";

type EncryptionResult = {
  encrypted: string;
  keyVersion: string;
};

type KeyConfig = {
  currentKeyVersion: string;
  keys: Map<string, Buffer>;
};

const keyConfig = loadKeyConfig();

export function encryptPlaidAccessToken(plaintext: string): EncryptionResult {
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

export function decryptPlaidAccessToken(encrypted: string, keyVersion: string) {
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

function loadKeyConfig(): KeyConfig {
  const currentKeyVersion = process.env.PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION;
  const rawKeys = process.env.PLAID_TOKEN_ENCRYPTION_KEYS;

  if (!currentKeyVersion) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION must be set.");
  }

  if (!rawKeys) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEYS must be set.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawKeys);
  } catch {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEYS must be valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEYS must be a JSON object.");
  }

  const keys = new Map<string, Buffer>();

  for (const [version, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`Encryption key for version "${version}" must be a base64 string.`);
    }

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
  const key = keyConfig.keys.get(version);

  if (!key) {
    throw new Error(`Unknown Plaid encryption key version "${version}".`);
  }

  return key;
}
