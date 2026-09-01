import { describe, expect, test } from "bun:test";
import {
  RECENT_AUTH_REQUIRED_MESSAGE,
  RECENT_AUTH_WINDOW_MS,
  getRecentAuthStatus,
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

describe("RECENT_AUTH_REQUIRED_MESSAGE", () => {
  test("gives stale-session users an actionable recovery path", () => {
    expect(RECENT_AUTH_REQUIRED_MESSAGE).toContain("Log out, sign in, then retry.");
    expect(RECENT_AUTH_REQUIRED_MESSAGE).toContain("RECENT_AUTH_REQUIRED");
  });
});
