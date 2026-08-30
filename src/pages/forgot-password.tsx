import { FormEvent, useState, useTransition } from "react";
import AuthShell from "@/components/auth/authShell";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { PASSWORD_RESET_EXPIRY_MINUTES } from "@/lib/password-policy";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      // The reply is deliberately uniform. Better Auth already answers the same
      // way for known and unknown addresses, so the page must not branch on the
      // result either, or it would tell an attacker which emails have accounts.
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      setSubmitted(true);
    });
  }

  if (submitted) {
    return (
      <AuthShell eyebrow="Reception · recovery">
        <div className="flex flex-col gap-5">
          <div>
            <span className="label-eyebrow-brass">Recovery · sent</span>
            <h1 className="display mt-3 text-[36px] leading-[1] tracking-tight text-bone">
              Check your inbox.
            </h1>
          </div>
          <p className="text-[13px] leading-[1.7] text-bone-mute">
            If an account uses <span className="text-bone">{email}</span>, a reset
            link is on its way. It works once and expires in{" "}
            {PASSWORD_RESET_EXPIRY_MINUTES} minutes.
          </p>
          <p className="text-[12px] leading-[1.7] text-bone-faint">
            Nothing arrived? Check spam, then try again. Signing in with GitHub,
            Google, or a passkey also gets you back to your desk.
          </p>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setSubmitted(false)}
            className="btn-ghost mt-1 h-11 w-full justify-center"
          >
            Use a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Reception · recovery">
      <div className="flex flex-col gap-7">
        <div>
          <span className="label-eyebrow-brass">Recovery · locked out</span>
          <h1 className="display mt-3 text-[36px] leading-[1] tracking-tight text-bone">
            Forgot the key.
          </h1>
          <p className="mt-3 text-[13px] leading-[1.7] text-bone-mute">
            Give us the email on the account. We will send a single-use link to
            set a new password.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="recovery-email" className="label-eyebrow">Email</label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              placeholder="desk@finwin.app"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              className="input-arch"
            />
          </div>

          <Button
            type="submit"
            variant="ghost"
            disabled={isPending}
            className="btn-brass mt-1 h-12 w-full justify-center disabled:opacity-60"
          >
            {isPending ? "Sending…" : "Send reset link"}
            <span aria-hidden>→</span>
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
