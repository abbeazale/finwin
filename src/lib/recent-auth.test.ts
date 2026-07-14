import { describe, expect, test } from "bun:test";
import {
  RECENT_AUTH_REQUIRED_CAUSE,
  RECENT_AUTH_WINDOW_MS,
  getRecentAuthStatus,
  isRecentAuthRequiredMessage,
} from "./recent-auth";

describe("getRecentAuthStatus", () => {
  test("accepts a session created inside the freshness window", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const createdAt = new Date(now.getTime() - 5 * 60 * 1000);
    const status = getRecentAuthStatus(createdAt, now);
    expect(status.ok).toBe(true);
    if (status.ok) {
      expect(status.remainingMs).toBe(10 * 60 * 1000);
    }
  });

  test("rejects a session older than the freshness window", () => {
    const now = new Date("2026-07-14T12:00:00Z");
    const createdAt = new Date(now.getTime() - RECENT_AUTH_WINDOW_MS - 1);
    const status = getRecentAuthStatus(createdAt, now);
    expect(status.ok).toBe(false);
    expect(status.remainingMs).toBe(0);
  });

  test("rejects a missing session timestamp", () => {
    expect(getRecentAuthStatus(null).ok).toBe(false);
  });
});

describe("isRecentAuthRequiredMessage", () => {
  test("detects the stable cause token", () => {
    expect(
      isRecentAuthRequiredMessage(
        `Confirm it's you again before changing bank connections. (${RECENT_AUTH_REQUIRED_CAUSE})`,
      ),
    ).toBe(true);
  });
});
