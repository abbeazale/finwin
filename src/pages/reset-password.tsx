import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useState, useTransition } from "react";
import AuthShell from "@/components/auth/authShell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_EXPIRY_MINUTES,
} from "@/lib/password-policy";

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResetPassword() {
  const router = useRouter();
  const token = firstQueryValue(router.query.token);
  const linkError = firstQueryValue(router.query.error);

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }
    if (!token) {
      setError("This link is missing its token. Request a new one.");
      return;
    }

    startTransition(async () => {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) {
        setError(resetError.message ?? "Unable to set a new password.");
        return;
      }
      // Every session was revoked with the reset, so sign in again from scratch.
      await router.push("/login?reset=1");
    });
  }

  if (linkError || (router.isReady && !token)) {
    return (
      <AuthShell eyebrow="Reception · recovery">
        <div className="flex flex-col gap-5">
          <div>
            <span className="label-eyebrow-brass">Recovery · expired</span>
            <h1 className="display mt-3 text-[36px] leading-[1] tracking-tight text-bone">
              This link is spent.
            </h1>
          </div>
          <p className="text-[13px] leading-[1.7] text-bone-mute">
            Reset links work once and expire after {PASSWORD_RESET_EXPIRY_MINUTES}{" "}
            minutes. Request a fresh one and it will be in your inbox in a moment.
          </p>
          <Button asChild variant="ghost" className="btn-brass mt-1 h-12 w-full justify-center">
            <Link href="/forgot-password">
              Request a new link
              <span aria-hidden>→</span>
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Reception · recovery">
      <div className="flex flex-col gap-7">
        <div>
          <span className="label-eyebrow-brass">Recovery · new key</span>
          <h1 className="display mt-3 text-[36px] leading-[1] tracking-tight text-bone">
            Cut a new key.
          </h1>
          <p className="mt-3 text-[13px] leading-[1.7] text-bone-mute">
            Setting this password signs out every other device on the account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-password" className="label-eyebrow">New password</label>
            <input
              id="reset-password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="input-arch"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="reset-password-confirm" className="label-eyebrow">Confirm password</label>
            <input
              id="reset-password-confirm"
              name="passwordConfirmation"
              type="password"
              placeholder="••••••••"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              className="input-arch"
            />
          </div>

          {error ? (
            <p className="rounded-[2px] border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.08)] px-3 py-2 text-[12px] text-oxide-hi">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="ghost"
            disabled={isPending}
            className="btn-brass mt-1 h-12 w-full justify-center disabled:opacity-60"
          >
            {isPending ? "Setting…" : "Set password"}
            <span aria-hidden>→</span>
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
