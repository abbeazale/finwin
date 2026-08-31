import type { OutboundEmail } from "../send";

const BRAND_INK = "#0b0b0d";
const BRAND_PANEL = "#141416";
const BRAND_BONE = "#e8e4dc";
const BRAND_MUTE = "#9b978f";
const BRAND_BRASS = "#c9a46b";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildPasswordResetEmail(options: {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}): OutboundEmail {
  const { to, resetUrl, expiresInMinutes } = options;
  const safeUrl = escapeHtml(resetUrl);

  const text = [
    "Reset your FinWin password",
    "",
    "Someone asked to reset the password on this FinWin account. Open the link",
    "below to choose a new one:",
    "",
    resetUrl,
    "",
    `The link works once and expires in ${expiresInMinutes} minutes.`,
    "",
    "If this was not you, ignore this message. Your password stays as it is, and",
    "nobody can use this link without opening it from your inbox.",
    "",
    "FinWin",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:${BRAND_INK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_INK};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${BRAND_PANEL};border:1px solid #26262a;">
            <tr>
              <td style="padding:32px 32px 8px 32px;font-family:Helvetica,Arial,sans-serif;">
                <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${BRAND_BRASS};">FinWin &middot; Account recovery</p>
                <h1 style="margin:14px 0 0 0;font-size:26px;line-height:1.15;font-weight:500;color:${BRAND_BONE};">Reset your password.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0 32px;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.7;color:${BRAND_MUTE};">
                <p style="margin:0;">Someone asked to reset the password on this FinWin account. Choose a new one with the button below.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px 0 32px;">
                <a href="${safeUrl}" style="display:inline-block;padding:13px 24px;background:${BRAND_BRASS};color:${BRAND_INK};font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;text-decoration:none;border-radius:2px;">Set a new password</a>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 0 32px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${BRAND_MUTE};">
                <p style="margin:0;">The link works once and expires in ${expiresInMinutes} minutes.</p>
                <p style="margin:12px 0 0 0;">If the button does not work, paste this into your browser:</p>
                <p style="margin:6px 0 0 0;word-break:break-all;color:${BRAND_BONE};">${safeUrl}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px 32px 32px;border-top:1px solid #26262a;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.7;color:${BRAND_MUTE};">
                <p style="margin:18px 0 0 0;">If this was not you, ignore this message. Your password stays as it is, and nobody can use this link without opening it from your inbox.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to,
    subject: "Reset your FinWin password",
    text,
    html,
  };
}
