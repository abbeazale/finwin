import { cn } from "@/lib/utils";
import Image from "next/image";
import { useRouter } from "next/router";
import { FormEvent, useState, useTransition } from "react";
import { signIn } from "@/lib/auth-client";

export default function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const { error: signInError } = await signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Unable to sign in.");
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSocialSignIn("github")}
            disabled={isPending}
            className="group flex h-12 items-center justify-center gap-2 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] text-[13px] font-medium text-bone transition-colors hover:border-[var(--stroke-brass-hi)] hover:text-brass-hi disabled:opacity-60"
          >
            <Image src="/gitinverted.svg" alt="" width={20} height={20} className="opacity-80 group-hover:opacity-100" />
            GitHub
          </button>
          <button
            type="button"
            onClick={() => handleSocialSignIn("google")}
            disabled={isPending}
            className="group flex h-12 items-center justify-center gap-2 rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] text-[13px] font-medium text-bone transition-colors hover:border-[var(--stroke-brass-hi)] hover:text-brass-hi disabled:opacity-60"
          >
            <Image src="/google.svg" alt="" width={20} height={20} className="opacity-80 group-hover:opacity-100" />
            Google
          </button>
        </div>

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
            required
            className="input-arch"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="login-password" className="label-eyebrow">Password</label>
            <a href="#" className="text-[11px] text-bone-faint hover:text-brass-hi">Forgot?</a>
          </div>
          <input
            id="login-password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-arch"
          />
        </div>

        {error ? (
          <p className="rounded-[2px] border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.08)] px-3 py-2 text-[12px] text-oxide-hi">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="btn-brass mt-2 h-12 w-full justify-center disabled:opacity-60"
        >
          {isPending ? "Unlocking…" : "Enter the desk"}
          <span aria-hidden>→</span>
        </button>
      </form>
    </div>
  );
}
