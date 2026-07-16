import Link from "next/link";
import { FormEvent, useState, useTransition } from "react";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { authClient } from "@/lib/auth-client";
import { useRequireSession } from "@/hooks/use-require-session";
import { PageStatus } from "@/components/page-status";
import { Button } from "@/components/ui/button";

type Notice = { kind: "success" | "error"; text: string };

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
  const [notice, setNotice] = useState<Notice | null>(null);
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

  if (sessionLoading) return <PageStatus label="Preparing security controls…" />;
  if (!session) return <PageStatus label="Redirecting…" />;

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-[15%] h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }} />
        <div className="absolute -bottom-40 left-0 h-[28rem] w-[48rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)" }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
        <div className="mb-12 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="label-eyebrow inline-flex items-center gap-2 transition-colors hover:text-brass-hi"
            >
              <ArrowLeft className="size-3" />
              Back to desk
            </Link>
            <span className="label-eyebrow">Settings · 04 / 04</span>
          </div>

          <div>
            <span className="label-eyebrow-brass">§ Access</span>
            <h1 className="display mt-3 text-[clamp(2rem,4vw,3.2rem)] leading-[1] text-bone">
              Security <span className="italic text-brass-hi">keys.</span>
            </h1>
          </div>

          <div className="flex items-center gap-px overflow-x-auto border-b border-[var(--stroke)]">
            {[
              { label: "Connections", active: false, href: "/settings/connections" },
              { label: "Profile", active: false, href: null },
              { label: "Notifications", active: false, href: null },
              { label: "Security", active: true, href: "/settings/security" },
            ].map((t) => (
              <Button
                key={t.label}
                asChild={Boolean(t.href)}
                type="button"
                variant="ghost"
                className={`relative h-auto rounded-none px-4 py-3 text-[11px] uppercase tracking-[0.12em] shadow-none hover:bg-transparent ${
                  t.active ? "text-brass-hi" : "text-bone-mute hover:text-bone"
                }`}
              >
                {t.href ? (
                  <Link href={t.href}>
                    {t.label}
                    {t.active ? (
                      <span className="absolute inset-x-3 -bottom-px h-[2px] bg-brass" style={{ boxShadow: "0 0 8px var(--brass-glow)" }} />
                    ) : null}
                  </Link>
                ) : (
                  <>
                    {t.label}
                    {t.active ? (
                      <span className="absolute inset-x-3 -bottom-px h-[2px] bg-brass" style={{ boxShadow: "0 0 8px var(--brass-glow)" }} />
                    ) : null}
                  </>
                )}
              </Button>
            ))}
          </div>
        </div>

        {notice ? (
          notice.kind === "success" ? (
            <p className="mb-8 flex items-center gap-3 rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-4 py-2.5 text-[12px] text-brass-hi">
              <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
              {notice.text}
            </p>
          ) : (
            <p className="mb-8 flex items-center gap-3 rounded-[2px] border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.08)] px-4 py-2.5 text-[12px] text-oxide-hi">
              <span className="h-1.5 w-1.5 rounded-full bg-oxide-hi" />
              {notice.text}
            </p>
          )
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
                <KeyRound className="size-4" />
              </div>
              <div>
                <span className="label-eyebrow-brass">Passkey</span>
                <h2 className="display text-[24px] leading-tight text-bone">Primary access</h2>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label htmlFor="passkey-name" className="label-eyebrow">Name</label>
              <input
                id="passkey-name"
                value={passkeyName}
                onChange={(event) => setPasskeyName(event.target.value)}
                placeholder="MacBook Touch ID"
                className="input-arch"
              />
              <Button
                type="button"
                variant="ghost"
                onClick={addPasskey}
                disabled={isPending}
                className="btn-brass mt-2 h-12 justify-center disabled:opacity-60"
              >
                Add passkey
              </Button>
            </div>
          </section>

          <section className="rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <span className="label-eyebrow-brass">Authenticator</span>
                <h2 className="display text-[24px] leading-tight text-bone">Authenticator app</h2>
              </div>
            </div>

            <p className="text-[12px] leading-[1.7] text-bone-mute">
              Add FinWin to Microsoft Authenticator, Google Authenticator, 1Password,
              or another app that generates 6-digit verification codes.
            </p>

            {twoFactorEnabled ? (
              <div className="mt-5 flex items-start gap-3 border-y border-[var(--stroke)] py-5">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] text-brass-hi">
                  ✓
                </span>
                <div>
                  <p className="text-[12px] font-medium text-bone">Two-factor authentication is on</p>
                  <p className="mt-1 text-[11px] leading-[1.6] text-bone-mute">
                    After signing in, use the current 6-digit FinWin code from your authenticator.
                    If your phone is unavailable, use one of your saved backup codes instead.
                  </p>
                </div>
              </div>
            ) : totpURI ? (
              <div className="mt-6 flex flex-col gap-6 border-t border-[var(--stroke)] pt-6">
                <section aria-labelledby="authenticator-step-scan" className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] font-mono text-[10px] text-brass-hi">
                      1
                    </span>
                    <div>
                      <h3 id="authenticator-step-scan" className="label-eyebrow-brass">Scan the QR code</h3>
                      <p className="mt-1 text-[11px] leading-[1.6] text-bone-mute">
                        In Microsoft Authenticator, tap <strong className="font-medium text-bone">+</strong>, choose
                        <strong className="font-medium text-bone"> Other account</strong>, then scan this code.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <div className="rounded-[2px] bg-bone p-3">
                      <QRCodeSVG value={totpURI} size={176} level="M" />
                    </div>
                  </div>

                  <details className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-0)] px-3 py-2.5">
                    <summary className="label-eyebrow cursor-pointer text-bone-faint transition-colors hover:text-brass-hi">
                      Can&apos;t scan? Enter a setup key manually
                    </summary>
                    <div className="mt-3 flex flex-col gap-2">
                      <p className="text-[11px] leading-[1.6] text-bone-mute">
                        Add an account manually in your authenticator and use this private key.
                      </p>
                      <input
                        readOnly
                        value={totpSetupKey ?? ""}
                        onFocus={(event) => event.currentTarget.select()}
                        aria-label="Manual authenticator setup key"
                        className="input-arch font-mono text-[11px] tracking-[0.08em]"
                      />
                      <p className="text-[10px] leading-[1.5] text-oxide-hi">
                        Keep this key private. Anyone with it can generate your verification codes.
                      </p>
                    </div>
                  </details>
                </section>

                <section aria-labelledby="authenticator-step-backup" className="flex flex-col gap-3 border-t border-[var(--stroke)] pt-6">
                  <div className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] font-mono text-[10px] text-brass-hi">
                      2
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 id="authenticator-step-backup" className="label-eyebrow-brass">Save your backup codes</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={downloadBackupCodes}
                          className="label-eyebrow h-auto px-2 py-1 text-bone-faint hover:text-brass-hi"
                        >
                          Download
                        </Button>
                      </div>
                      <p className="mt-1 text-[11px] leading-[1.6] text-bone-mute">
                        Each code can sign you in once if you lose access to your authenticator app.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {backupCodes.map((code) => (
                      <code key={code} className="rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-0)] px-3 py-2 text-[11px] text-bone-mute">
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
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] font-mono text-[10px] text-brass-hi">
                      3
                    </span>
                    <div>
                      <h3 className="label-eyebrow-brass">Verify and finish</h3>
                      <p id="totp-code-help" className="mt-1 text-[11px] leading-[1.6] text-bone-mute">
                        Enter the current 6-digit code shown for FinWin in your authenticator app.
                      </p>
                    </div>
                  </div>

                  <label htmlFor="totp-code" className="label-eyebrow mt-1">6-digit code</label>
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
                    className="input-arch font-mono tracking-[0.22em]"
                  />
                  <Button
                    type="submit"
                    variant="ghost"
                    disabled={isPending || (backupCodes.length > 0 && !backupCodesAcknowledged)}
                    className="btn-brass mt-2 h-12 justify-center disabled:opacity-60"
                  >
                    Enable two-factor authentication
                  </Button>
                  {!backupCodesAcknowledged ? (
                    <p className="text-center text-[10px] leading-[1.5] text-bone-faint">
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
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--stroke)] font-mono text-[9px] text-bone-faint">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-[11px] font-medium text-bone">{title}</p>
                        <p className="mt-0.5 text-[10px] leading-[1.5] text-bone-faint">{description}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                <form onSubmit={enableTwoFactor} className="flex flex-col gap-3">
                  <label htmlFor="two-factor-password" className="label-eyebrow">Current FinWin password</label>
                  <input
                    id="two-factor-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    aria-describedby="two-factor-password-help"
                    className="input-arch"
                  />
                  <p id="two-factor-password-help" className="text-[10px] leading-[1.5] text-bone-faint">
                    Required for password accounts. Leave blank if you only use social sign-in or a passkey.
                  </p>
                  <Button
                    type="submit"
                    variant="ghost"
                    disabled={isPending}
                    className="btn-brass mt-2 h-12 justify-center disabled:opacity-60"
                  >
                    Set up authenticator app
                  </Button>
                  <p className="text-center text-[10px] leading-[1.5] text-bone-faint">
                    Two-factor authentication stays off until you verify a code.
                  </p>
                </form>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
