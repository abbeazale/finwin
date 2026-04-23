import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({
            code,
            trustDevice,
          })
        : await authClient.twoFactor.verifyTotp({
            code,
            trustDevice,
          });

      if (result.error) {
        setError(result.error.message ?? "Unable to verify this code.");
        return;
      }

      await router.push("/dashboard");
    });
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-0 px-6 py-10 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-[15%] h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }} />
        <div className="absolute -bottom-40 left-0 h-[28rem] w-[48rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)" }} />
      </div>

      <section className="relative z-10 w-full max-w-md rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-8 cove brackets">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <span className="label-eyebrow-brass">Second factor</span>
            <h1 className="display text-[30px] leading-tight text-bone">Verify access.</h1>
          </div>
        </div>

        <form onSubmit={verify} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="two-factor-code" className="label-eyebrow">
              {useBackupCode ? "Backup code" : "Authenticator code"}
            </label>
            <input
              id="two-factor-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode={useBackupCode ? "text" : "numeric"}
              autoComplete="one-time-code"
              required
              className="input-arch"
            />
          </div>

          <label className="flex items-center gap-3 text-[12px] text-bone-mute">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(event) => setTrustDevice(event.target.checked)}
              className="size-4 accent-[var(--brass)]"
            />
            Trust this device
          </label>

          <button
            type="button"
            onClick={() => {
              setUseBackupCode((value) => !value);
              setCode("");
              setError(null);
            }}
            className="label-eyebrow w-fit text-bone-faint transition-colors hover:text-brass-hi"
          >
            {useBackupCode ? "Use authenticator code" : "Use backup code"}
          </button>

          {error ? (
            <p className="rounded-[2px] border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.08)] px-3 py-2 text-[12px] text-oxide-hi">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="ghost"
            disabled={isPending}
            className="btn-brass h-12 w-full justify-center disabled:opacity-60"
          >
            {isPending ? "Checking..." : "Continue"}
          </Button>
        </form>

        <Link href="/login" className="label-eyebrow mt-6 inline-block text-bone-faint transition-colors hover:text-brass-hi">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
