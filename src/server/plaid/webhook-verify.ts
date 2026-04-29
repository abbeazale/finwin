import { createHash } from "node:crypto";
import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from "jose";
import { getPlaid } from "./client";

const jwkCache = new Map<string, CryptoKey>();

async function getVerificationKey(kid: string): Promise<CryptoKey> {
  const cached = jwkCache.get(kid);
  if (cached) return cached;

  const { data } = await getPlaid().webhookVerificationKeyGet({ key_id: kid });
  const jwk = data.key as unknown as JWK;
  const key = (await importJWK(jwk, "ES256")) as CryptoKey;
  jwkCache.set(kid, key);
  return key;
}

export type WebhookVerification =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Verify a Plaid webhook per https://plaid.com/docs/api/webhooks/webhook-verification/.
 * Caller must pass the RAW request body (not a parsed object) — the
 * `request_body_sha256` claim is computed over the literal HTTP body.
 */
export async function verifyPlaidWebhook(
  signatureHeader: string | undefined,
  rawBody: string,
): Promise<WebhookVerification> {
  if (!signatureHeader) return { ok: false, reason: "missing Plaid-Verification header" };

  let header;
  try {
    header = decodeProtectedHeader(signatureHeader);
  } catch {
    return { ok: false, reason: "unparseable JWT header" };
  }

  if (header.alg !== "ES256") return { ok: false, reason: `unexpected alg ${header.alg}` };
  if (!header.kid) return { ok: false, reason: "missing kid" };

  let verified;
  try {
    const key = await getVerificationKey(header.kid);
    verified = await jwtVerify(signatureHeader, key);
  } catch (e) {
    return { ok: false, reason: `jwt verify failed: ${(e as Error).message}` };
  }

  const payload = verified.payload as { iat?: number; request_body_sha256?: string };

  if (!payload.iat || Date.now() / 1000 - payload.iat > 5 * 60) {
    return { ok: false, reason: "jwt older than 5 minutes" };
  }

  const expected = createHash("sha256").update(rawBody).digest("hex");
  if (expected !== payload.request_body_sha256) {
    return { ok: false, reason: "body hash mismatch" };
  }

  return { ok: true };
}
