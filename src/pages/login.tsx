import LoginForm from "@/components/auth/loginForm";
import SignupComponent from "@/components/auth/signupForm";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";

export default function Login() {
  const [activePage, setActivePage] = useState<"signin" | "signup">("signin");

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-[10%] h-[36rem] w-[36rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.08), transparent 65%)" }} />
        <div className="absolute -bottom-48 left-[5%] h-[40rem] w-[52rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.06), transparent 60%)" }} />
        <div className="grid-plan absolute inset-0 opacity-[0.25] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,#000,transparent_80%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="display text-[22px] leading-none text-bone">
              Fin<span className="italic text-brass">Win</span>
            </span>
          </Link>
          <span className="label-eyebrow">Reception · 2026</span>
        </div>

        <div className="mt-16 grid flex-1 gap-16 lg:grid-cols-[0.95fr_1fr] lg:items-center lg:gap-24">
          <aside className="hidden lg:flex lg:flex-col lg:gap-10 animate-fade-slide">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
                <span className="label-eyebrow-brass">Access · authorized only</span>
              </div>
              <h1 className="display text-[clamp(2.4rem,4.5vw,4rem)] leading-[0.98] text-bone">
                Step into the<br />
                <span className="italic text-brass-hi">command center.</span>
              </h1>
              <p className="mt-6 max-w-md text-[14px] leading-[1.75] text-bone-mute">
                Your desk. Your accounts. Your numbers. Matte surfaces, quiet lighting,
                no noise on the glass.
              </p>
            </div>

            <div className="relative rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-5 cove">
              <div className="mb-4 flex items-center justify-between">
                <span className="label-eyebrow">Account access</span>
                <span className="pill pill-sage"><span className="h-1 w-1 rounded-full bg-[var(--sage-hi)] animate-pulse-dot" />Online</span>
              </div>
              <div className="space-y-2 border-y border-[var(--stroke)] py-4 text-[11px] font-[family-name:var(--font-mono)]">
                {[
                  ["Auth", "Better Auth session"],
                  ["MFA", "Passkeys and TOTP"],
                  ["Data", "Plaid-backed after sign-in"],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 text-bone-mute">
                    <span className="text-bone-faint">{label}</span>
                    <span className="text-right text-bone">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="relative animate-fade-slide" style={{ animationDelay: "140ms" }}>
            <div className="relative mx-auto mb-10 flex w-full max-w-md overflow-hidden rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-1">
              <div
                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-[2px] bg-gradient-to-b from-[var(--brass-hi)] via-[var(--brass)] to-[var(--brass-lo)] transition-transform duration-500 ease-out ${
                  activePage === "signin" ? "translate-x-0" : "translate-x-full"
                }`}
                aria-hidden="true"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,244,214,0.45), 0 0 20px -6px var(--brass-glow)" }}
              />
              <Button
                type="button"
                variant="ghost"
                className={`relative z-10 h-10 flex-1 rounded-[2px] font-[family-name:var(--font-sans)] text-[11px] uppercase tracking-[0.16em] shadow-none transition-colors duration-300 hover:bg-transparent ${
                  activePage === "signin" ? "text-[#1a1408]" : "text-bone-mute hover:text-bone"
                }`}
                onClick={() => setActivePage("signin")}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={`relative z-10 h-10 flex-1 rounded-[2px] font-[family-name:var(--font-sans)] text-[11px] uppercase tracking-[0.16em] shadow-none transition-colors duration-300 hover:bg-transparent ${
                  activePage === "signup" ? "text-[#1a1408]" : "text-bone-mute hover:text-bone"
                }`}
                onClick={() => setActivePage("signup")}
              >
                Create account
              </Button>
            </div>

            <div className="relative mx-auto w-full max-w-md rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-8 cove sm:p-10 brackets">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--brass-hi), transparent)", opacity: 0.4 }} />
              {activePage === "signin" ? <LoginForm /> : <SignupComponent />}
            </div>

            <p className="mt-8 text-center text-[11px] text-bone-faint">
              Protected by Better Auth · End-to-end encrypted in transit
            </p>
            <p className="mt-3 text-center text-[11px] text-bone-faint">
              <Link
                href="/privacy"
                className="transition-colors hover:text-brass-hi"
              >
                Privacy policy
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return { props: {} };
  }

  const profile = await getUserProfile(session.user.id);

  if (hasCompletedOnboarding(profile)) {
    return {
      redirect: {
        destination: "/dashboard",
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: "/onboarding",
      permanent: false,
    },
  };
};
