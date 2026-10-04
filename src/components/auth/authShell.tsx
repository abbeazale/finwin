import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Chrome shared by the standalone recovery pages. The combined sign-in and
 * sign-up page keeps its own two-column layout; these pages are single-purpose,
 * so they use a narrower centered panel.
 */
export default function AuthShell({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-0 text-bone">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-56 right-[6%] h-[42rem] w-[42rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.10), transparent 66%)" }} />
        <div className="absolute -bottom-64 left-[-10%] h-[46rem] w-[64rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.07), transparent 62%)" }} />
        <div className="absolute inset-x-0 bottom-0 h-64" style={{ background: "linear-gradient(0deg, rgba(255,154,60,0.05), transparent 100%)" }} />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="display text-[23px] leading-none text-bone">
              Fin<span className="italic text-brass">Win</span>
            </span>
          </Link>
          <span className="label-eyebrow">{eyebrow}</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-16">
          <section className="relative w-full max-w-md animate-fade-slide">
            <div className="relative overflow-hidden rounded-[18px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-8 cove sm:p-10">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--brass-hi), transparent)", opacity: 0.45 }} />
              {children}
            </div>

            <p className="mt-7 text-center text-[12px] text-bone-faint">
              <Link href="/login" className="transition-colors hover:text-brass-hi">
                ← Back to sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
