import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { authClient, signIn } from "@/lib/auth-client";

function isBenignPasskeyError(message: string | undefined) {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("abort") ||
    lower.includes("cancel") ||
    lower.includes("not allowed")
  );
}

function passkeyErrorMessage(message: string | undefined) {
  if (!message) return "Unable to sign in with passkey.";
  if (message.toLowerCase().includes("not allowed")) {
    return "No matching passkey on this device. Register one from Security settings.";
  }
  return message;
}

function hasTwoFactorRedirect(data: unknown) {
  return (
    typeof data === "object" &&
    data !== null &&
    "twoFactorRedirect" in data &&
    data.twoFactorRedirect === true
  );
}

export default function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const autofillAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (
      typeof PublicKeyCredential === "undefined" ||
      !PublicKeyCredential.isConditionalMediationAvailable
    ) {
      return;
    }

    const controller = new AbortController();
    autofillAbortRef.current = controller;

    void PublicKeyCredential.isConditionalMediationAvailable().then((available) => {
      if (!available || controller.signal.aborted) return;

      void authClient.signIn.passkey({
        autoFill: true,
        fetchOptions: {
          signal: controller.signal,
          onSuccess() {
            void router.push("/dashboard");
          },
        },
      });
    });

    return () => {
      controller.abort();
      if (autofillAbortRef.current === controller) {
        autofillAbortRef.current = null;
      }
    };
  }, [router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const { data, error: signInError } = await signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Unable to sign in.");
        return;
      }
      if (hasTwoFactorRedirect(data)) {
        return;
      }
      await router.push("/dashboard");
    });
  }

  function handlePasskeySignIn() {
    setError(null);
    autofillAbortRef.current?.abort();
    autofillAbortRef.current = null;

    startTransition(async () => {
      const { error: passkeyError } = await authClient.signIn.passkey();
      if (passkeyError) {
        if (isBenignPasskeyError(passkeyError.message)) {
          setError(passkeyErrorMessage(passkeyError.message));
          return;
        }
        setError(passkeyError.message ?? "Unable to sign in with passkey.");
        return;
      }
      await router.push("/dashboard");
    });
  }

  async function handleSocialSignIn(provider: "google" | "github") {
    setError(null);
    const { error: socialError } = await signIn.social({
      provider,
      callbackURL: "/dashboard",
    });
    if (socialError) {
      setError(socialError.message ?? "Unable to continue with social sign-in.");
    }
  }

  return (
    <div className={cn("flex flex-col gap-7", className)} {...props}>
      <div>
        <span className="label-eyebrow-brass">Re-entry · returning</span>
        <h1 className="display mt-3 text-[40px] leading-[1] tracking-tight text-bone">
          Welcome back.
        </h1>
        <p className="mt-3 text-[13px] leading-[1.7] text-bone-mute">
          The desk is as you left it.
        </p>
      </div>

      {router.query.reset === "1" ? (
        <p className="rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-3 py-2 text-[12px] text-brass-hi">
          Password updated. Sign in with the new one.
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSocialSignIn("github")}
            disabled={isPending}
            className="group h-12 rounded-[2px] border-[var(--stroke-2)] bg-[var(--ink-0)] text-[13px] font-medium text-bone shadow-none hover:border-[var(--stroke-brass-hi)] hover:bg-[var(--ink-0)] hover:text-brass-hi disabled:opacity-60"
          >
            <Image src="/gitinverted.svg" alt="" width={20} height={20} className="opacity-80 group-hover:opacity-100" />
            GitHub
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSocialSignIn("google")}
            disabled={isPending}
            className="group h-12 rounded-[2px] border-[var(--stroke-2)] bg-[var(--ink-0)] text-[13px] font-medium text-bone shadow-none hover:border-[var(--stroke-brass-hi)] hover:bg-[var(--ink-0)] hover:text-brass-hi disabled:opacity-60"
          >
            <Image src="/google.svg" alt="" width={20} height={20} className="opacity-80 group-hover:opacity-100" />
            Google
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handlePasskeySignIn}
          disabled={isPending}
          className="group h-12 rounded-[2px] border-[var(--stroke-2)] bg-[var(--ink-0)] text-[13px] font-medium text-bone shadow-none hover:border-[var(--stroke-brass-hi)] hover:bg-[var(--ink-0)] hover:text-brass-hi disabled:opacity-60"
        >
          <KeyRound className="size-4 opacity-80 group-hover:opacity-100" />
          Passkey
        </Button>

        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-[var(--stroke)]" />
          <span className="label-eyebrow">or with email</span>
          <span className="h-px flex-1 bg-[var(--stroke)]" />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="login-email" className="label-eyebrow">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            placeholder="desk@finwin.app"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username webauthn"
            required
            className="input-arch"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="label-eyebrow">Password</label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-bone-faint hover:text-brass-hi"
            >
              Forgot?
            </Link>
          </div>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
          className="btn-brass mt-2 h-12 w-full justify-center disabled:opacity-60"
        >
          {isPending ? "Unlocking…" : "Enter the desk"}
          <span aria-hidden>→</span>
        </Button>
      </form>
    </div>
  );
}
