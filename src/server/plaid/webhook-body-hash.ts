import { createHash } from "node:crypto";

export function hashWebhookBody(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

export function verifyWebhookBodyHash(rawBody: string, claimedHash: string | undefined) {
  if (typeof claimedHash !== "string") {
    return { ok: false as const, reason: "missing body hash claim" };
  }

  const expected = hashWebhookBody(rawBody);
  if (expected !== claimedHash) {
    return { ok: false as const, reason: "body hash mismatch" };
  }

  return { ok: true as const };
}
