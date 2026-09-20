import LoginForm from "@/components/auth/loginForm";
import SignupComponent from "@/components/auth/signupForm";
import NightWindow from "@/components/auth/nightWindow";
import { useState } from "react";
import Link from "next/link";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";

const tabs = [
  { key: "signin", label: "Sign in" },
  { key: "signup", label: "Create account" },
] as const;

export default function Login() {
  const [activePage, setActivePage] = useState<"signin" | "signup">("signin");

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-0 text-bone">
      <Head>
        <title>Sign in — FinWin</title>
      </Head>

      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-56 right-[6%] h-[42rem] w-[42rem] rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,199,145,0.10), transparent 66%)" }}
        />
        <div
          className="absolute -bottom-64 left-[-10%] h-[46rem] w-[64rem] blur-3xl"
          style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.07), transparent 62%)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-64"
          style={{ background: "linear-gradient(0deg, rgba(255,154,60,0.05), transparent 100%)" }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
        <header className="flex items-baseline justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="display text-[23px] leading-none text-bone">
              Fin<span className="italic text-brass">Win</span>
            </span>
          </Link>
          <span className="display text-[14px] italic leading-none text-bone-faint">
            est. mmxxvi
          </span>
        </header>

        <div className="mt-14 grid flex-1 gap-16 lg:mt-8 lg:grid-cols-[0.92fr_1fr] lg:items-center lg:gap-24">
          <aside className="hidden lg:flex lg:flex-col lg:gap-12 animate-fade-slide">
            <div>
              <h1 className="display text-[clamp(2.6rem,4.6vw,4.1rem)] leading-[1.02] text-bone">
                The lights are<br />
                <span className="italic text-brass-hi">still on.</span>
              </h1>
              <p className="mt-6 max-w-[27rem] text-[15px] leading-[1.75] text-bone-mute">
                Your desk, your accounts, your numbers — right where you left
                them. Sign in and the room comes back up.
              </p>
            </div>

            <NightWindow />
          </aside>

          <section
            className="relative animate-fade-slide"
            style={{ animationDelay: "140ms" }}
          >
            <div
              className="relative mx-auto mb-8 flex w-full max-w-md rounded-full border border-[var(--stroke-2)] bg-[var(--ink-1)] p-1"
              role="tablist"
              aria-label="Sign in or create an account"
            >
              <div
                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-gradient-to-b from-[var(--brass-hi)] via-[var(--brass)] to-[var(--brass-lo)] transition-transform duration-500 ease-out ${
                  activePage === "signin" ? "translate-x-0" : "translate-x-full"
                }`}
                aria-hidden="true"
                style={{
                  boxShadow:
                    "inset 0 1px 0 rgba(255,244,214,0.45), 0 6px 18px -10px var(--brass-glow)",
                }}
              />
              {tabs.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={activePage === key}
                  onClick={() => setActivePage(key)}
                  className={`relative z-10 h-10 flex-1 cursor-pointer rounded-full text-[13px] font-medium transition-colors duration-300 ${
                    activePage === key
                      ? "text-[#1a1408]"
                      : "text-bone-mute hover:text-bone"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-[18px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-8 cove sm:p-10">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, var(--brass-hi), transparent)",
                  opacity: 0.45,
                }}
              />
              {activePage === "signin" ? <LoginForm /> : <SignupComponent />}
            </div>

            <p className="mx-auto mt-7 max-w-md text-center text-[12px] leading-[1.7] text-bone-faint">
              By continuing you agree to the{" "}
              <Link
                href="/privacy"
                className="text-bone-mute underline decoration-[var(--stroke-3)] underline-offset-4 transition-colors hover:text-brass-hi"
              >
                privacy policy
              </Link>
              .
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
