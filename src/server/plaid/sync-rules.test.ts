import { describe, expect, test } from "bun:test";
import {
  classifyErrorReason,
  classifySyncErrorCode,
  normalizeTransactionAmount,
} from "./sync-rules";

describe("normalizeTransactionAmount", () => {
  test("negates Plaid provider amounts into FinWin sign convention", () => {
    expect(normalizeTransactionAmount(12.34)).toBe("-12.34");
    expect(normalizeTransactionAmount(-50)).toBe("50.00");
  });
});

describe("classifySyncErrorCode", () => {
  test("maps login and credential failures to login_required", () => {
    expect(classifyErrorReason("ITEM_LOGIN_REQUIRED")).toBe("login_required");
    expect(classifyErrorReason("INSUFFICIENT_CREDENTIALS")).toBe("login_required");
    expect(classifySyncErrorCode("ITEM_LOGIN_REQUIRED").requiresUserAction).toBe(true);
  });

  test("maps ITEM_LOCKED to locked", () => {
    expect(classifyErrorReason("ITEM_LOCKED")).toBe("locked");
    expect(classifySyncErrorCode("ITEM_LOCKED").requiresUserAction).toBe(true);
  });

  test("flags cursor reset codes without inventing a reason mapping", () => {
    const classified = classifySyncErrorCode("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION");
    expect(classified.requiresCursorReset).toBe(true);
    expect(classified.reason).toBe("unknown");
  });

  test("treats unrecognized codes as unknown", () => {
    expect(classifyErrorReason("SOMETHING_ELSE")).toBe("unknown");
  });
});
