import Link from "next/link";
import { DM_Sans, Sora } from "next/font/google";

const heading = Sora({
  subsets: ["latin"],
  variable: "--font-finwin-heading",
  weight: ["600", "700", "800"],
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
  },
  {
    title: "Real-World Simulation",
    detail:
      "Practice investing with virtual dollars mapped to your actual income and monthly cashflow.",
  },
  {
    title: "One Financial Command Center",
    detail:
      "Track spending, portfolio performance, and progress in a unified, low-friction dashboard.",
  },
];

const steps = [
  {
    title: "Connect",
    detail: "Securely link bank accounts and import transactions.",
  },
  {
    title: "Understand",
    detail: "See exactly where money moves and why it matters.",
  },
  {
    title: "Experiment",
    detail: "Simulate portfolio choices before risking real capital.",
  },
];

export default function Home() {
  return (
    <div
      className={`${heading.variable} ${body.variable} min-h-screen bg-[#050911] text-[#edf1f5]`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(65,210,255,0.24),_rgba(5,9,17,0)_65%)] blur-2xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-6 sm:px-8">
        <header className="animate-fade-slide flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-lg">
          <div className="font-[var(--font-finwin-heading)] text-lg tracking-tight">FinWin</div>
          <nav className="hidden items-center gap-7 text-sm text-[#bcc8d5] md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#how" className="transition hover:text-white">
              How it works
            </a>
            <a
              href="https://github.com/abbeazale/finwin"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-white"
            >
              GitHub
            </a>
          </nav>
          <Link
            href="/login"
            className="rounded-md border border-[#55d6ff]/60 bg-[#0f1a2a] px-4 py-2 text-sm font-medium text-[#b9edff] transition hover:-translate-y-0.5 hover:border-[#84e5ff] hover:bg-[#11223a]"
          >
            Create account
          </Link>
        </header>

        <main className="pt-14 sm:pt-20">
          <section className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="space-y-7">
              <div className="animate-fade-slide inline-flex items-center gap-2 rounded-full border border-[#26415e] bg-[#0c1524] px-3 py-1 text-xs text-[#9fbcdb] [animation-delay:90ms]">
                Open-source AI budget + simulated portfolio platform
              </div>
              <h1 className="animate-fade-slide max-w-2xl font-[var(--font-finwin-heading)] text-4xl font-semibold leading-tight tracking-tight text-white [animation-delay:150ms] sm:text-5xl lg:text-6xl">
                Understand your money. Test your moves. Build confidence.
              </h1>
              <p className="animate-fade-slide max-w-xl text-base leading-relaxed text-[#adc0d5] [animation-delay:220ms] sm:text-lg">
                FinWin combines budgeting clarity with investment simulation so beginners and experienced users can improve decisions before making real bets.
              </p>
              <div className="animate-fade-slide flex flex-wrap items-center gap-4 [animation-delay:300ms]">
                <Link
                  href="/login"
                  className="rounded-md bg-[#5ad8ff] px-6 py-3 text-sm font-semibold text-[#041320] transition hover:-translate-y-0.5 hover:bg-[#83e4ff]"
                >
                  Start free
                </Link>
                <a
                  href="https://github.com/abbeazale/finwin"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/5"
                >
                  View on GitHub
                </a>
              </div>
              <div className="grid max-w-lg grid-cols-3 gap-3 pt-2">
                <Stat value="2 layers" label="Deterministic + AI" />
                <Stat value="100%" label="Type-safe stack" />
                <Stat value="Realistic" label="Portfolio simulation" />
              </div>
            </div>

            <div className="animate-fade-slide [animation-delay:240ms]">
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#101a2c] to-[#090f19] p-5 shadow-[0_30px_80px_-40px_rgba(83,208,255,0.45)]">
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm text-[#a8bed6]">Monthly cashflow signal</p>
                  <p className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                    +8.4%
                  </p>
                </div>
                <div className="space-y-3">
                  <GraphRow label="Income" value="+$6,250" width="91%" color="bg-cyan-300" />
                  <GraphRow label="Expenses" value="-$3,480" width="55%" color="bg-blue-300" />
                  <GraphRow label="Budget burn" value="62%" width="62%" color="bg-amber-200" />
                </div>
                <div className="mt-6 rounded-2xl border border-white/10 bg-[#0d1524]/90 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7893ad]">AI Insight</p>
                  <p className="mt-2 text-sm leading-relaxed text-[#cae0f7]">
                    Restaurant spending rose 22% versus last month. Reallocating that delta to your simulation portfolio could add long-term upside.
                  </p>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#5ad8ff]/10 to-transparent" />
              </div>
            </div>
          </section>

          <section id="features" className="mt-24 space-y-8">
            <h2 className="font-[var(--font-finwin-heading)] text-2xl tracking-tight text-white sm:text-3xl">
              Minimal interface, serious capability
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature, index) => (
                <article
                  key={feature.title}
                  className="animate-fade-slide rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  style={{ animationDelay: `${140 + index * 110}ms` }}
                >
                  <h3 className="font-[var(--font-finwin-heading)] text-lg text-[#f5fbff]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#9fb6cd]">
                    {feature.detail}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section id="how" className="mt-24 grid gap-6 rounded-3xl border border-white/10 bg-[#0a111e]/85 p-6 sm:p-8 lg:grid-cols-3">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="animate-fade-slide rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                style={{ animationDelay: `${120 + index * 120}ms` }}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[#6f8aa7]">0{index + 1}</p>
                <h3 className="mt-3 font-(--font-finwin-heading) text-xl text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-[#a9bfd5]">{step.detail}</p>
              </div>
            ))}
          </section>

          <section className="mt-24 rounded-3xl border border-white/10 bg-gradient-to-r from-[#08111e] via-[#0e1a2d] to-[#09111d] p-8 text-center sm:p-10">
            <p className="text-sm uppercase tracking-[0.2em] text-[#8ca7c2]">Launch Early Access</p>
            <h2 className="mx-auto mt-4 max-w-2xl font-[var(--font-finwin-heading)] text-3xl leading-tight tracking-tight text-white sm:text-4xl">
              Build better money habits and test smarter investing decisions.
            </h2>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/login"
                className="rounded-md bg-[#5ad8ff] px-6 py-3 text-sm font-semibold text-[#03111d] transition hover:-translate-y-0.5 hover:bg-[#88e7ff]"
              >
                Create account
              </Link>
              <a
                href="https://github.com/abbeazale/finwin"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-white/45"
              >
                Explore source code
              </a>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

type StatProps = {
  value: string;
  label: string;
};

function Stat({ value, label }: StatProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <p className="font-[var(--font-finwin-heading)] text-base text-white">{value}</p>
      <p className="mt-1 text-xs text-[#8ea7bf]">{label}</p>
    </div>
  );
}

type GraphRowProps = {
  label: string;
  value: string;
  width: string;
  color: string;
};

function GraphRow({ label, value, width, color }: GraphRowProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-[#94acc5]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#1a2637]">
        <div
          className={`${color} animate-pulse-line h-full rounded-full`}
          style={{ width }}
        />
      </div>
    </div>
  );
}
