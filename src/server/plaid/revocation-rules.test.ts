import { describe, expect, test } from "bun:test";
import {
  MAX_REVOCATION_ATTEMPTS,
  classifyRevocationFailure,
  isRevocationConfirmed,
  retryDelayMinutes,
  shouldAbandonRevocation,
} from "./revocation-rules";

function plaidFailure(code: string) {
  return {
    response: {
      data: {
        error_type: "ITEM_ERROR",
        error_code: code,
        error_message: "message",
        request_id: "req-1",
      },
    },
  };
}

describe("revocation failure classification", () => {
  test("treats an Item that is already gone as revoked", () => {
    expect(classifyRevocationFailure(plaidFailure("ITEM_NOT_FOUND"))).toBe("already-revoked");
    expect(classifyRevocationFailure(plaidFailure("INVALID_ACCESS_TOKEN"))).toBe("already-revoked");
  });

  test("treats provider and transport failures as retryable", () => {
    expect(classifyRevocationFailure(plaidFailure("INTERNAL_SERVER_ERROR"))).toBe("retryable");
    expect(classifyRevocationFailure(plaidFailure("RATE_LIMIT_EXCEEDED"))).toBe("retryable");
    expect(classifyRevocationFailure(new Error("socket hang up"))).toBe("retryable");
    expect(classifyRevocationFailure(undefined)).toBe("retryable");
  });

  test("counts only confirmed removal as revoked", () => {
    expect(isRevocationConfirmed("revoked")).toBe(true);
    expect(isRevocationConfirmed("already-revoked")).toBe(true);
    expect(isRevocationConfirmed("retryable")).toBe(false);
    expect(isRevocationConfirmed("unusable-credential")).toBe(false);
  });
});

describe("retry backoff", () => {
  test("doubles the delay with each recorded failure", () => {
    expect(retryDelayMinutes(1)).toBe(5);
    expect(retryDelayMinutes(2)).toBe(10);
    expect(retryDelayMinutes(3)).toBe(20);
    expect(retryDelayMinutes(4)).toBe(40);
  });

  test("caps the delay at twelve hours", () => {
    expect(retryDelayMinutes(20)).toBe(12 * 60);
    expect(retryDelayMinutes(MAX_REVOCATION_ATTEMPTS)).toBe(12 * 60);
  });

  test("never returns a delay below the base for a first failure", () => {
    expect(retryDelayMinutes(0)).toBe(5);
  });
});

describe("abandoning a revocation", () => {
  test("gives up when the stored credential cannot be decrypted", () => {
    expect(shouldAbandonRevocation("unusable-credential", 1)).toBe(true);
  });

  test("keeps retrying while the attempt budget lasts", () => {
    expect(shouldAbandonRevocation("retryable", 1)).toBe(false);
    expect(shouldAbandonRevocation("retryable", MAX_REVOCATION_ATTEMPTS - 1)).toBe(false);
  });

  test("gives up once the attempt budget is spent", () => {
    expect(shouldAbandonRevocation("retryable", MAX_REVOCATION_ATTEMPTS)).toBe(true);
    expect(shouldAbandonRevocation("retryable", MAX_REVOCATION_ATTEMPTS + 1)).toBe(true);
  });
});
