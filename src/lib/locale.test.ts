import { describe, expect, test } from "bun:test";
import {
  isSupportedOnboardingTimeZone,
  isValidIanaTimeZone,
  resolveProfileTimeZone,
} from "./locale";

describe("timezone helpers", () => {
  test("rejects the historically invalid Philippines option", () => {
    expect(isValidIanaTimeZone("Asia/Philippines")).toBe(false);
    expect(isSupportedOnboardingTimeZone("Asia/Philippines")).toBe(false);
  });

  test("accepts Asia/Shanghai as the onboarding Shanghai option", () => {
    expect(isSupportedOnboardingTimeZone("Asia/Shanghai")).toBe(true);
  });

  test("repairs legacy Asia/Philippines profile values", () => {
    expect(resolveProfileTimeZone("Asia/Philippines")).toBe("Asia/Shanghai");
  });

  test("falls back to America/Toronto for garbage values", () => {
    expect(resolveProfileTimeZone("Not/AZone")).toBe("America/Toronto");
  });
});
