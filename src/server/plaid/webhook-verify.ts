import { importJWK, jwtVerify, decodeProtectedHeader, type JWK } from "jose";
import type { JWKPublicKey } from "plaid";
import { getPlaid } from "./client";
import { verifyWebhookBodyHash } from "./webhook-body-hash";

type PlaidWebhookVerificationKey = Awaited<ReturnType<typeof importJWK>>;
type PlaidWebhookJwtPayload = {
  iat?: number;
  request_body_sha256?: string;
};

const jwkCache = new Map<string, PlaidWebhookVerificationKey>();

async function getVerificationKey(kid: string): Promise<PlaidWebhookVerificationKey> {
  const cached = jwkCache.get(kid);
  if (cached) return cached;

  const { data } = await getPlaid().webhookVerificationKeyGet({ key_id: kid });
  const jwk = toJoseJwk(data.key);
  const key = await importJWK(jwk, "ES256");
  jwkCache.set(kid, key);
  return key;
}

function toJoseJwk(key: JWKPublicKey): JWK {
  return {
    alg: key.alg,
    crv: key.crv,
    kid: key.kid,
    kty: key.kty,
    use: key.use,
    x: key.x,
    y: key.y,
  };
}

type WebhookVerification =
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
    verified = await jwtVerify<PlaidWebhookJwtPayload>(signatureHeader, key);
  } catch {
    return { ok: false, reason: "jwt or verification-key check failed" };
  }

  const payload = verified.payload;

  if (typeof payload.iat !== "number" || Date.now() / 1000 - payload.iat > 5 * 60) {
    return { ok: false, reason: "jwt older than 5 minutes" };
  }

  if (typeof payload.request_body_sha256 !== "string") {
    return { ok: false, reason: "missing body hash claim" };
  }

  const bodyHash = verifyWebhookBodyHash(rawBody, payload.request_body_sha256);
  if (!bodyHash.ok) {
    return { ok: false, reason: bodyHash.reason };
  }

  return { ok: true };
}
