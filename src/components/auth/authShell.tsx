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
          <span className="label-eyebrow">{eyebrow}</span>
        </div>

        <div className="flex flex-1 items-center justify-center py-16">
          <section className="relative w-full max-w-md animate-fade-slide">
            <div className="relative rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-8 cove sm:p-10 brackets">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, var(--brass-hi), transparent)", opacity: 0.4 }} />
              {children}
            </div>

            <p className="mt-8 text-center text-[11px] text-bone-faint">
              <Link href="/login" className="transition-colors hover:text-brass-hi">
                Back to sign in
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
