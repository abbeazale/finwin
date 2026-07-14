import { describe, expect, test } from "bun:test";
import { hashWebhookBody, verifyWebhookBodyHash } from "./webhook-body-hash";

describe("verifyWebhookBodyHash", () => {
  test("accepts a matching sha256 hex digest of the raw body", () => {
    const rawBody = '{"item_id":"abc"}';
    const claim = hashWebhookBody(rawBody);
    expect(verifyWebhookBodyHash(rawBody, claim)).toEqual({ ok: true });
  });

  test("rejects a missing claim", () => {
    expect(verifyWebhookBodyHash("{}", undefined)).toEqual({
      ok: false,
      reason: "missing body hash claim",
    });
  });

  test("rejects a mismatched claim", () => {
    expect(verifyWebhookBodyHash('{"a":1}', hashWebhookBody('{"a":2}'))).toEqual({
      ok: false,
      reason: "body hash mismatch",
    });
  });

  test("is sensitive to whitespace because Plaid hashes the literal body", () => {
    const compact = '{"a":1}';
    const spaced = '{ "a": 1 }';
    expect(hashWebhookBody(compact)).not.toBe(hashWebhookBody(spaced));
  });
});
