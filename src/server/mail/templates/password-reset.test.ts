import { describe, expect, test } from "bun:test";
import { buildPasswordResetEmail } from "./password-reset";

const RESET_URL =
  "https://finwin.example/api/auth/reset-password/tok3n?callbackURL=%2Freset-password";

describe("password reset email", () => {
  test("carries the reset link in both the text and HTML bodies", () => {
    const email = buildPasswordResetEmail({
      to: "desk@finwin.example",
      resetUrl: RESET_URL,
      expiresInMinutes: 30,
    });

    expect(email.to).toBe("desk@finwin.example");
    expect(email.subject).toBe("Reset your FinWin password");
    expect(email.text).toContain(RESET_URL);
    expect(email.html).toContain(`href="${RESET_URL}"`);
  });

  test("states the expiry that the auth config actually enforces", () => {
    const email = buildPasswordResetEmail({
      to: "desk@finwin.example",
      resetUrl: RESET_URL,
      expiresInMinutes: 15,
    });

    expect(email.text).toContain("expires in 15 minutes");
    expect(email.html).toContain("expires in 15 minutes");
  });

  test("escapes the link so a query string cannot break out of the attribute", () => {
    const email = buildPasswordResetEmail({
      to: "desk@finwin.example",
      resetUrl: 'https://finwin.example/r/a?x=1&y="><script>alert(1)</script>',
      expiresInMinutes: 30,
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&amp;y=&quot;&gt;&lt;script&gt;");
  });

  test("tells the reader that ignoring the message is safe", () => {
    const email = buildPasswordResetEmail({
      to: "desk@finwin.example",
      resetUrl: RESET_URL,
      expiresInMinutes: 30,
    });

    expect(email.text).toContain("If this was not you");
    expect(email.html).toContain("If this was not you");
  });
});
