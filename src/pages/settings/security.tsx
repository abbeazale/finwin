import { FormEvent, useState, useTransition } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { authClient } from "@/lib/auth-client";
import { useRequireSession } from "@/hooks/use-require-session";
import { PageStatus } from "@/components/page-status";
import { AppShell } from "@/components/dashboard/app-shell";
import {
  Notice,
  PageHeading,
  SettingsTabs,
  ShellLoading,
} from "@/components/dashboard/desk-ui";
import { Button } from "@/components/ui/button";

type SecurityNotice = { kind: "success" | "error"; text: string };

function getTotpSetupKey(totpURI: string) {
  try {
    return new URL(totpURI).searchParams.get("secret") ?? totpURI;
  } catch {
    return totpURI;
  }
}

export default function SecuritySettings() {
  const { session, isPending: sessionLoading } = useRequireSession();
  const [passkeyName, setPasskeyName] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesAcknowledged, setBackupCodesAcknowledged] = useState(false);
  const [twoFactorSetupComplete, setTwoFactorSetupComplete] = useState(false);
  const [notice, setNotice] = useState<SecurityNotice | null>(null);
  const [isPending, startTransition] = useTransition();
  const totpSetupKey = totpURI ? getTotpSetupKey(totpURI) : null;
  const twoFactorEnabled = twoFactorSetupComplete || session?.user.twoFactorEnabled === true;

  function addPasskey() {
    setNotice(null);
    startTransition(async () => {
      const { error } = await authClient.passkey.addPasskey({
        name: passkeyName.trim() || "FinWin passkey",
      });

      if (error) {
        setNotice({ kind: "error", text: error.message ?? "Passkey enrollment failed." });
        return;
      }

      setPasskeyName("");
      setNotice({ kind: "success", text: "Passkey added." });
    });
  }

  function enableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    startTransition(async () => {
      const { data, error } = await authClient.twoFactor.enable({
        password: password || undefined,
        issuer: "FinWin",
      });

      if (error) {
        setNotice({ kind: "error", text: error.message ?? "Two-factor setup failed." });
        return;
      }

      setPassword("");
      setTotpURI(data.totpURI);
      setBackupCodes(data.backupCodes ?? []);
      setBackupCodesAcknowledged(false);
      setNotice({ kind: "success", text: "Scan the QR, then save your backup codes." });
    });
  }

  function verifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (backupCodes.length > 0 && !backupCodesAcknowledged) {
      setNotice({
        kind: "error",
        text: "Save your backup codes before verifying.",
      });
      return;
    }

    startTransition(async () => {
      const { error } = await authClient.twoFactor.verifyTotp({
        code: totpCode,
        trustDevice: true,
      });

      if (error) {
        setNotice({ kind: "error", text: error.message ?? "Code verification failed." });
        return;
      }

      setTotpCode("");
      setTotpURI(null);
      setBackupCodes([]);
      setBackupCodesAcknowledged(false);
      setTwoFactorSetupComplete(true);
      setNotice({ kind: "success", text: "Two-factor enabled." });
    });
  }

  function downloadBackupCodes() {
    const blob = new Blob(
      [
        [
          "FinWin two-factor backup codes",
          `Generated: ${new Date().toISOString()}`,
          "Each code works once. Keep them somewhere safe.",
          "",
          ...backupCodes,
        ].join("\n"),
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "finwin-backup-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (sessionLoading) {
    return (
      <AppShell>
        <ShellLoading label="Loading security settings…" />
      </AppShell>
    );
  }
  if (!session) return <PageStatus label="Redirecting…" />;

  return (
    <AppShell>
      <PageHeading
        kicker="Settings"
        title={
          <>
            Sign-in <span className="italic text-brass-hi">security.</span>
          </>
        }
        description="Add a passkey or an authenticator app so only you can get into FinWin."
      />
      <SettingsTabs active="security" />

      {notice ? (
        <Notice tone={notice.kind === "success" ? "brass" : "error"}>
          {notice.text}
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="desk-panel p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
              <KeyRound className="size-4" />
            </div>
            <div>
              <span className="display text-[14px] italic text-brass-hi">Passkey</span>
              <h2 className="display text-[26px] leading-tight text-bone">Primary access</h2>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <label htmlFor="passkey-name" className="field-label">Name</label>
            <input
              id="passkey-name"
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              placeholder="MacBook Touch ID"
              className="input-arch input-arch--soft"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={addPasskey}
              disabled={isPending}
              className="btn-brass-fill mt-2 h-12 w-full disabled:opacity-60"
            >
              Add passkey
            </Button>
          </div>
        </section>

        <section className="desk-panel p-7">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
              <ShieldCheck className="size-4" />
            </div>
            <div>
              <span className="display text-[14px] italic text-brass-hi">Authenticator</span>
              <h2 className="display text-[26px] leading-tight text-bone">Authenticator app</h2>
            </div>
          </div>

          <p className="text-[13.5px] leading-[1.7] text-bone-mute">
            Add FinWin to Microsoft Authenticator, Google Authenticator, 1Password,
            or another app that generates 6-digit verification codes.
          </p>

          {twoFactorEnabled ? (
            <div className="mt-5 flex items-start gap-3 border-y border-[var(--stroke)] py-5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] text-brass-hi">
                ✓
              </span>
              <div>
                <p className="text-[14px] font-medium text-bone">Two-factor authentication is on</p>
                <p className="mt-1 text-[12.5px] leading-[1.6] text-bone-mute">
                  After signing in, use the current 6-digit FinWin code from your authenticator.
                  If your phone is unavailable, use one of your saved backup codes instead.
                </p>
              </div>
            </div>
          ) : totpURI ? (
            <div className="mt-6 flex flex-col gap-6 border-t border-[var(--stroke)] pt-6">
              <section aria-labelledby="authenticator-step-scan" className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] font-mono text-[11.5px] text-brass-hi">
                    1
                  </span>
                  <div>
                    <h3 id="authenticator-step-scan" className="text-[14px] font-medium text-bone">Scan the QR code</h3>
                    <p className="mt-1 text-[12.5px] leading-[1.6] text-bone-mute">
                      In Microsoft Authenticator, tap <strong className="font-medium text-bone">+</strong>, choose
                      <strong className="font-medium text-bone"> Other account</strong>, then scan this code.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <div className="rounded-[14px] bg-bone p-3">
                    <QRCodeSVG value={totpURI} size={176} level="M" />
                  </div>
                </div>

                <details className="rounded-[12px] border border-[var(--stroke)] bg-[var(--ink-0)] px-3 py-2.5">
                  <summary className="cursor-pointer text-[13px] text-bone-mute transition-colors hover:text-brass-hi">
                    Can&apos;t scan? Enter a setup key manually
                  </summary>
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-[12.5px] leading-[1.6] text-bone-mute">
                      Add an account manually in your authenticator and use this private key.
                    </p>
                    <input
                      readOnly
                      value={totpSetupKey ?? ""}
                      onFocus={(event) => event.currentTarget.select()}
                      aria-label="Manual authenticator setup key"
                      className="input-arch input-arch--soft font-mono text-[12.5px] tracking-[0.08em]"
                    />
                    <p className="text-[11.5px] leading-[1.5] text-oxide-hi">
                      Keep this key private. Anyone with it can generate your verification codes.
                    </p>
                  </div>
                </details>
              </section>

              <section aria-labelledby="authenticator-step-backup" className="flex flex-col gap-3 border-t border-[var(--stroke)] pt-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] font-mono text-[11.5px] text-brass-hi">
                    2
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 id="authenticator-step-backup" className="text-[14px] font-medium text-bone">Save your backup codes</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={downloadBackupCodes}
                        className="h-auto px-2 py-1 text-[13px] font-normal text-bone-mute hover:bg-transparent hover:text-brass-hi"
                      >
                        Download
                      </Button>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-[1.6] text-bone-mute">
                      Each code can sign you in once if you lose access to your authenticator app.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code) => (
                    <code key={code} className="rounded-[12px] border border-[var(--stroke)] bg-[var(--ink-0)] px-3 py-2 text-[12.5px] text-bone-mute">
                      {code}
                    </code>
                  ))}
                </div>
                <label className="flex items-center gap-3 text-[12px] text-bone-mute">
                  <input
                    type="checkbox"
                    checked={backupCodesAcknowledged}
                    onChange={(event) => setBackupCodesAcknowledged(event.target.checked)}
                    className="size-4 accent-[var(--brass)]"
                  />
                  I&apos;ve saved these codes somewhere safe.
                </label>
              </section>

              <form onSubmit={verifyTwoFactor} className="flex flex-col gap-3 border-t border-[var(--stroke)] pt-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] font-mono text-[11.5px] text-brass-hi">
                    3
                  </span>
                  <div>
                    <h3 className="text-[14px] font-medium text-bone">Verify and finish</h3>
                    <p id="totp-code-help" className="mt-1 text-[12.5px] leading-[1.6] text-bone-mute">
                      Enter the current 6-digit code shown for FinWin in your authenticator app.
                    </p>
                  </div>
                </div>

                <label htmlFor="totp-code" className="field-label mt-1">6-digit code</label>
                <input
                  id="totp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value)}
                  aria-describedby="totp-code-help"
                  placeholder="123456"
                  maxLength={6}
                  required
                  className="input-arch input-arch--soft font-mono tracking-[0.22em]"
                />
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={isPending || (backupCodes.length > 0 && !backupCodesAcknowledged)}
                  className="btn-brass-fill mt-2 h-12 w-full disabled:opacity-60"
                >
                  Enable two-factor authentication
                </Button>
                {!backupCodesAcknowledged ? (
                  <p className="text-center text-[11.5px] leading-[1.5] text-bone-faint">
                    Save and acknowledge your backup codes to finish setup.
                  </p>
                ) : null}
              </form>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              <ol className="flex flex-col gap-3 border-y border-[var(--stroke)] py-4">
                {[
                  ["Confirm your identity", "Enter your current FinWin password."],
                  ["Connect your app", "Scan a QR code with Microsoft Authenticator or a similar app."],
                  ["Verify one code", "Enter the 6-digit code from the app to turn protection on."],
                ].map(([title, description], index) => (
                  <li key={title} className="flex items-start gap-3">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--stroke)] font-mono text-[10.5px] text-bone-faint">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[12.5px] font-medium text-bone">{title}</p>
                      <p className="mt-0.5 text-[11.5px] leading-[1.5] text-bone-faint">{description}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <form onSubmit={enableTwoFactor} className="flex flex-col gap-3">
                <label htmlFor="two-factor-password" className="field-label">Current FinWin password</label>
                <input
                  id="two-factor-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  aria-describedby="two-factor-password-help"
                  className="input-arch input-arch--soft"
                />
                <p id="two-factor-password-help" className="text-[11.5px] leading-[1.5] text-bone-faint">
                  Required for password accounts. Leave blank if you only use social sign-in or a passkey.
                </p>
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={isPending}
                  className="btn-brass-fill mt-2 h-12 w-full disabled:opacity-60"
                >
                  Set up authenticator app
                </Button>
                <p className="text-center text-[11.5px] leading-[1.5] text-bone-faint">
                  Two-factor authentication stays off until you verify a code.
                </p>
              </form>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
