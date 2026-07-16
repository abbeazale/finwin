import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  decryptPlaidAccessTokenFromRow,
  encryptPlaidAccessToken,
  resetPlaidCryptoKeyCacheForTests,
} from "./crypto";

const KEY_V1 = Buffer.alloc(32, 7).toString("base64");
const KEY_V2 = Buffer.alloc(32, 9).toString("base64");

function configureKeys(current: string, keys: Record<string, string>) {
  process.env.PLAID_TOKEN_ENCRYPTION_CURRENT_KEY_VERSION = current;
  process.env.PLAID_TOKEN_ENCRYPTION_KEYS = JSON.stringify(keys);
  resetPlaidCryptoKeyCacheForTests();
}

beforeEach(() => {
  configureKeys("v1", { v1: KEY_V1, v2: KEY_V2 });
});

afterEach(() => {
  resetPlaidCryptoKeyCacheForTests();
});

describe("plaid access token encryption", () => {
  test("round-trips plaintext with the current key version", () => {
    const encrypted = encryptPlaidAccessToken("access-sandbox-token");
    expect(encrypted.keyVersion).toBe("v1");
    expect(encrypted.encrypted.startsWith("v1:")).toBe(true);

    const plaintext = decryptPlaidAccessTokenFromRow({
      accessTokenEncrypted: encrypted.encrypted,
      accessTokenKeyVersion: encrypted.keyVersion,
    });
    expect(plaintext).toBe("access-sandbox-token");
  });

  test("detects ciphertext tampering", () => {
    const encrypted = encryptPlaidAccessToken("access-sandbox-token");
    const parts = encrypted.encrypted.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    const tampered = parts.join(":");

    expect(() =>
      decryptPlaidAccessTokenFromRow({
        accessTokenEncrypted: tampered,
        accessTokenKeyVersion: encrypted.keyVersion,
      }),
    ).toThrow();
  });

  test("decrypts historical rows with a non-current key version", () => {
    configureKeys("v2", { v1: KEY_V1, v2: KEY_V2 });
    const withV2 = encryptPlaidAccessToken("new-token");
    expect(withV2.keyVersion).toBe("v2");

    configureKeys("v1", { v1: KEY_V1, v2: KEY_V2 });
    const legacy = encryptPlaidAccessToken("legacy-token");
    expect(legacy.keyVersion).toBe("v1");

    configureKeys("v2", { v1: KEY_V1, v2: KEY_V2 });
    expect(
      decryptPlaidAccessTokenFromRow({
        accessTokenEncrypted: legacy.encrypted,
        accessTokenKeyVersion: "v1",
      }),
    ).toBe("legacy-token");
  });

  test("rejects an unknown key version", () => {
    const encrypted = encryptPlaidAccessToken("access-sandbox-token");
    expect(() =>
      decryptPlaidAccessTokenFromRow({
        accessTokenEncrypted: encrypted.encrypted,
        accessTokenKeyVersion: "v9",
      }),
    ).toThrow(/Unknown Plaid encryption key version/);
  });
});
