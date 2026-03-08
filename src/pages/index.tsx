import Link from "next/link";
import { DM_Sans, Sora } from "next/font/google";

const heading = Sora({
  subsets: ["latin"],
  variable: "--font-finwin-heading",
  weight: ["300", "400", "600", "700", "800"],
});

const body = DM_Sans({
  subsets: ["latin"],
  variable: "--font-finwin-body",
  weight: ["400", "500", "700"],
});

const features = [
  {
    title: "AI Budget Intelligence",
    detail:
      "Turn transaction noise into plain-English actions with deterministic math under the hood.",
    icon: "◈",
    accent: "#41d2ff",
  },
  {
    title: "Real-World Simulation",
    detail:
      "Practice investing with virtual dollars mapped to your actual income and monthly cashflow.",
    icon: "◉",
    accent: "#6ee7b7",
  },
  {
    title: "One Command Center",
    detail:
      "Track spending, portfolio performance, and progress in a unified, low-friction dashboard.",
    icon: "◍",
    accent: "#a78bfa",
  },
];

const steps = [
  {
    title: "Connect",
    detail: "Securely link bank accounts and import transactions in seconds.",
    num: "01",
  },
  {
    title: "Understand",
    detail: "See exactly where money moves and why it matters to your goals.",
    num: "02",
  },
  {
    title: "Experiment",
    detail: "Simulate portfolio choices before risking real capital.",
    num: "03",
  },
];

export default function Home() {
  return (
    <div
      className={`${heading.variable} ${body.variable} relative min-h-screen overflow-x-hidden bg-[#03080f] font-[family-name:var(--font-finwin-body)] text-[#dce9f4]`}
    >
      {/* ── Background atmosphere ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        {/* Primary glow */}
        <div className="absolute -top-40 left-1/2 h-[52rem] w-[52rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(65,210,255,0.12),_transparent_65%)]" />
        {/* Secondary accent glow bottom-right */}
        <div className="absolute bottom-0 right-0 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,_rgba(110,231,183,0.07),_transparent_65%)]" />
        {/* Fine grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_20%,black,transparent)]" />
        {/* Grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-5 sm:px-8">
        {/* ── Header ── */}
        <header className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-3.5 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#41d2ff]/15 text-[#41d2ff]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L12.196 4V10L7 13L1.804 10V4L7 1Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <path d="M7 4L9.598 5.5V8.5L7 10L4.402 8.5V5.5L7 4Z" fill="currentColor" opacity="0.5"/>
              </svg>
            </div>
            <span className="font-[family-name:var(--font-finwin-heading)] text-[15px] font-semibold tracking-tight text-white">
              FinWin
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-[13px] text-[#7a95af] md:flex">
            {["Features", "How it works"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                className="transition-colors duration-150 hover:text-white"
              >
                {item}
              </a>
            ))}
            <a
              href="https://github.com/abbeazale/finwin"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 transition-colors duration-150 hover:text-white"
            >
              <svg height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </nav>

          <Link
            href="/login"
            className="rounded-xl border border-[#41d2ff]/30 bg-[#41d2ff]/[0.08] px-4 py-2 text-[13px] font-medium text-[#9fe7ff] transition-all duration-200 hover:-translate-y-px hover:border-[#41d2ff]/60 hover:bg-[#41d2ff]/[0.13]"
          >
            Get started →
          </Link>
        </header>

        {/* ── Hero ── */}
        <main className="pt-16 sm:pt-24">
          <section className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-8">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#41d2ff]/20 bg-[#41d2ff]/[0.06] px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[#7fc8e8]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#41d2ff] shadow-[0_0_6px_#41d2ff]" />
                Open-source · AI-powered finance
              </div>

              {/* Headline */}
              <h1 className="font-[family-name:var(--font-finwin-heading)] text-[2.6rem] font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.5rem]">
                Understand your money.{" "}
                <span className="relative">
                  <span className="relative z-10 text-[#41d2ff]">Test your moves.</span>
                  <span className="absolute -inset-x-2 -inset-y-1 z-0 rounded-lg bg-[#41d2ff]/[0.08]" />
                </span>{" "}
                Build confidence.
              </h1>

              <p className="max-w-[480px] text-[15px] leading-[1.75] text-[#7f9ab3]">
                FinWin combines budgeting clarity with investment simulation so beginners and experienced users can sharpen decisions before making real bets.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="group relative overflow-hidden rounded-xl bg-[#41d2ff] px-6 py-3 text-[13px] font-semibold text-[#021018] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(65,210,255,0.35)]"
                >
                  <span className="relative z-10">Start for free</span>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </Link>
                <a
                  href="https://github.com/abbeazale/finwin"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-6 py-3 text-[13px] font-semibold text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
                >
                  View source code
                </a>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap gap-5 pt-1">
                <StatPill value="2-layer" label="AI + deterministic" />
                <StatPill value="100%" label="Type-safe stack" />
                <StatPill value="Real data" label="Simulation engine" />
              </div>
            </div>

            {/* Dashboard card */}
            <div className="relative">
              {/* Card glow */}
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-[#41d2ff]/20 via-transparent to-[#6ee7b7]/10 blur-sm" />
              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#0c1829] to-[#070e1a] p-6 shadow-[0_40px_100px_-30px_rgba(65,210,255,0.3)]">
                {/* Card header */}
                <div className="mb-1 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#4a6885]">Monthly cashflow</p>
                    <p className="mt-0.5 font-[family-name:var(--font-finwin-heading)] text-2xl font-semibold text-white">$2,770</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.09] px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-medium text-emerald-300">+8.4%</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                {/* Graph rows */}
                <div className="space-y-4">
                  <GraphRow label="Income" value="+$6,250" width="91%" color="from-cyan-400 to-cyan-300" />
                  <GraphRow label="Expenses" value="-$3,480" width="55%" color="from-blue-400 to-blue-300" />
                  <GraphRow label="Budget burn" value="62%" width="62%" color="from-amber-400 to-amber-300" />
                </div>

                {/* AI insight box */}
                <div className="mt-5 rounded-2xl border border-white/[0.07] bg-[#060d1a]/80 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#41d2ff]/15 text-[#41d2ff]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M5 0l1.175 3.59H9.755L6.888 5.81l1.126 3.44L5 7.18 1.986 9.25l1.126-3.44L.245 3.59H3.825L5 0z"/>
                      </svg>
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#41d2ff]/80">AI Insight</p>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-[#8fb8d8]">
                    Restaurant spending rose{" "}
                    <span className="font-medium text-white">22%</span> vs last month. Reallocating that delta to your simulation portfolio could add meaningful long-term upside.
                  </p>
                </div>

                {/* Bottom shimmer */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#41d2ff]/[0.06] to-transparent" />
              </div>
            </div>
          </section>

          {/* ── Features ── */}
          <section id="features" className="mt-28">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#41d2ff]/70">Capabilities</p>
                <h2 className="font-[family-name:var(--font-finwin-heading)] text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Minimal interface,{" "}
                  <span className="text-[#7a95af]">serious capability</span>
                </h2>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature, index) => (
                <article
                  key={feature.title}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/[0.12] hover:bg-white/[0.04]"
                  style={{ animationDelay: `${140 + index * 110}ms` }}
                >
                  {/* Hover glow */}
                  <div
                    className="pointer-events-none absolute -top-8 left-1/2 h-20 w-20 -translate-x-1/2 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-60"
                    style={{ backgroundColor: feature.accent }}
                  />
                  <div
                    className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] text-base"
                    style={{ color: feature.accent, backgroundColor: `${feature.accent}15` }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="font-[family-name:var(--font-finwin-heading)] text-[15px] font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#5e7d98]">
                    {feature.detail}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* ── How it works ── */}
          <section id="how-it-works" className="mt-28">
            <div className="mb-10">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#41d2ff]/70">Process</p>
              <h2 className="font-[family-name:var(--font-finwin-heading)] text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Up and running{" "}
                <span className="text-[#7a95af]">in three steps</span>
              </h2>
            </div>

            <div className="relative grid gap-0 lg:grid-cols-3">
              {/* Connector line */}
              <div className="pointer-events-none absolute left-0 top-8 hidden h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent lg:block" />

              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className="relative flex flex-col gap-4 border-l border-white/[0.07] p-6 lg:border-l-0 lg:border-t lg:pt-8"
                  style={{ animationDelay: `${120 + index * 120}ms` }}
                >
                  {/* Step dot on line */}
                  <div className="absolute -left-2 top-6 hidden h-4 w-4 items-center justify-center rounded-full border border-[#41d2ff]/40 bg-[#03080f] lg:flex lg:-top-2 lg:left-6">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#41d2ff]" />
                  </div>

                  <p className="font-[family-name:var(--font-finwin-heading)] text-[11px] font-bold uppercase tracking-[0.22em] text-[#2c4a63]">
                    {step.num}
                  </p>
                  <h3 className="font-[family-name:var(--font-finwin-heading)] text-xl font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-[#5e7d98]">{step.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA ── */}
          <section className="relative mt-28 overflow-hidden rounded-3xl border border-white/[0.07] p-10 text-center sm:p-14">
            {/* BG gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#0a1828] via-[#091120] to-[#050b14]" />
            <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#41d2ff]/40 to-transparent" />
            <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(65,210,255,0.12),_transparent_65%)]" />

            <div className="relative">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#41d2ff]/70">
                Early access
              </p>
              <h2 className="mx-auto max-w-2xl font-[family-name:var(--font-finwin-heading)] text-3xl font-bold leading-[1.2] tracking-[-0.025em] text-white sm:text-4xl">
                Build better money habits.
                <br />
                <span className="text-[#6a8aaa]">Test smarter investing decisions.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-[#4a6880]">
                Free to use. Open source. No credit card required.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="group relative overflow-hidden rounded-xl bg-[#41d2ff] px-7 py-3.5 text-[13px] font-semibold text-[#021018] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(65,210,255,0.4)]"
                >
                  <span className="relative z-10">Create free account</span>
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
                </Link>
                <a
                  href="https://github.com/abbeazale/finwin"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-white/10 px-7 py-3.5 text-[13px] font-semibold text-white/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:text-white/90"
                >
                  Explore source code
                </a>
              </div>
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="mt-16 flex items-center justify-between border-t border-white/[0.05] pt-8 text-[12px] text-[#2e4a62]">
            <span className="font-[family-name:var(--font-finwin-heading)] font-semibold text-[#3a607f]">FinWin</span>
            <span>Open source · MIT License</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-[family-name:var(--font-finwin-heading)] text-[13px] font-semibold text-white">
        {value}
      </span>
      <span className="text-[12px] text-[#3d5e7a]">{label}</span>
    </div>
  );
}

function GraphRow({
  label,
  value,
  width,
  color,
}: {
  label: string;
  value: string;
  width: string;
  color: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="text-[#4a6885]">{label}</span>
        <span className="font-medium text-[#8fb3d0]">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#0e1d2f]">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} opacity-80`}
          style={{ width }}
        />
      </div>
    </div>
  );
}