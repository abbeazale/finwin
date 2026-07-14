import Link from "next/link";
import Head from "next/head";
import type { GetServerSideProps } from "next";
import {
  getPageSession,
  getUserProfile,
  hasCompletedOnboarding,
} from "@/lib/page-auth";
import { getTickerQuotesForLanding, type TickerQuote } from "@/server/market/quotes";

const pillars = [
  {
    index: "01",
    title: "Read the room",
    body: "Normalized transactions, category intelligence, and budget truth — not demo data pretending to be insight.",
  },
  {
    index: "02",
    title: "Run the scenario",
    body: "Model allocations against your actual cashflow. Test a move before you move.",
  },
  {
    index: "03",
    title: "One terminal",
    body: "Budgets, accounts, portfolio, and forecasts on a single plane of matte glass.",
  },
];

const fallbackMarquee = [
  { k: "CASHFLOW · M", v: "+ $2,770" },
  { k: "BURN RATE", v: "62%" },
  { k: "NET WORTH", v: "$148,320" },
  { k: "BUDGETED", v: "$3,480" },
  { k: "SAVINGS · YTD", v: "$12,900" },
  { k: "RUNWAY", v: "14.2 MO" },
  { k: "PORTFOLIO · DAY", v: "+1.18%" },
  { k: "VOL · 30D", v: "11.4%" },
];

const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const roomSpec = [
  ["Lighting", "Tungsten cove · no overheads"],
  ["Surfaces", "Matte obsidian, brushed brass"],
  ["Focus", "Desk faces the windows"],
  ["Noise floor", "Whisper-quiet"],
];

type HomeProps = {
  quotes: TickerQuote[];
};

export default function Home({ quotes }: HomeProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink-0 text-bone">
      <Head>
        <title>FinWin — a command center for your money</title>
        <meta
          name="description"
          content="An architectural dark-mode personal finance workspace. Import transactions, read the room, and test your moves before making them."
        />
      </Head>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-48 right-1/4 h-[40rem] w-[40rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.07), transparent 65%)" }} />
        <div className="absolute -bottom-40 left-0 h-[36rem] w-[60rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.06), transparent 60%)" }} />
        <div className="grid-plan absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_30%,#000,transparent_80%)]" />
      </div>

      <div className="relative z-20 overflow-hidden border-b border-[var(--stroke)] bg-[var(--ink-1)]">
        <div className="flex w-max animate-ticker py-2.5">
          {quotes.length > 0
            ? [...quotes, ...quotes, ...quotes].map((quote, i) => {
                const up = quote.change >= 0;
                return (
                  <div key={i} className="flex shrink-0 items-center gap-3 px-8">
                    <span className="label-eyebrow">{quote.symbol}</span>
                    <span className="num text-[11px] text-bone">
                      ${priceFormatter.format(quote.price)}
                    </span>
                    <span className={`num text-[11px] ${up ? "text-sage-hi" : "text-oxide-hi"}`}>
                      {up ? "▲" : "▼"} {Math.abs(quote.changePercent).toFixed(2)}%
                    </span>
                    <span className="text-bone-ghost">·</span>
                  </div>
                );
              })
            : [...fallbackMarquee, ...fallbackMarquee, ...fallbackMarquee].map((item, i) => (
                <div key={i} className="flex shrink-0 items-center gap-3 px-8">
                  <span className="label-eyebrow">{item.k}</span>
                  <span className="num text-[11px] text-bone">{item.v}</span>
                  <span className="text-bone-ghost">·</span>
                </div>
              ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-8 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="display text-[26px] leading-none tracking-tight text-bone">Fin<span className="italic text-brass">Win</span></span>
            <span className="label-eyebrow hidden sm:inline">· est. mmxxvi</span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {[
              ["Capabilities", "#capabilities"],
              ["Method", "#method"],
              ["Ledger", "#ledger"],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="label-eyebrow transition-colors hover:text-brass-hi"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com/abbeazale/finwin"
              target="_blank"
              rel="noreferrer"
              className="label-eyebrow hidden transition-colors hover:text-brass-hi sm:inline"
            >
              Source ↗
            </a>
            <Link href="/login" className="btn-brass">
              Enter
              <span aria-hidden>→</span>
            </Link>
          </div>
        </header>

        <main>
          <section className="relative mt-16 grid gap-16 lg:mt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-24">
            <div className="animate-fade-slide">
              <div className="mb-8 flex items-center gap-3">
                <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
                <span className="label-eyebrow-brass">Command center · personal finance</span>
              </div>

              <h1 className="display text-[clamp(3rem,7vw,5.8rem)] leading-[0.96] tracking-tight text-bone">
                A quiet room<br />
                for <span className="italic text-brass-hi">loud</span> money.
              </h1>

              <p className="mt-8 max-w-[520px] text-[15px] leading-[1.7] text-bone-mute">
                FinWin is a matte, focused workspace for your transactions, budgets, and portfolio.
                No dashboards that shout. No colors that beg. Just the instruments you need to
                read the room and make the next move.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href="/login" className="btn-brass">
                  Take the desk
                  <span aria-hidden>→</span>
                </Link>
                <a
                  href="#method"
                  className="btn-ghost"
                >
                  View the method
                </a>
              </div>

              <div className="mt-14 grid max-w-md grid-cols-2 gap-x-10 gap-y-3 border-t border-[var(--stroke)] pt-6">
                {roomSpec.map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <span className="label-eyebrow">{k}</span>
                    <span className="text-[12px] text-bone">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative animate-fade-in" style={{ animationDelay: "220ms" }}>
              <div className="relative overflow-hidden rounded-[3px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-3 cove">
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--oxide)]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-[var(--sage)]" />
                  </div>
                  <span className="label-eyebrow">NORTH · 42F · 22:14</span>
                </div>

                <div className="relative aspect-[5/4] overflow-hidden rounded-[2px] border border-[var(--stroke-2)]" style={{ background: "linear-gradient(180deg, #0e0d0b 0%, #1a140d 50%, #2a1f14 85%, #3a2c1a 100%)" }}>
                  <div className="absolute right-[14%] top-[18%] h-12 w-12 rounded-full" style={{ background: "radial-gradient(circle, #e8c791 0%, #c9a46b 35%, transparent 70%)", filter: "blur(0.5px)", opacity: 0.65 }} />
                  <div className="absolute inset-x-0 bottom-[22%] h-24" style={{ background: "linear-gradient(0deg, rgba(255,154,60,0.32) 0%, transparent 100%)" }} />
                  <div className="skyline absolute inset-x-0 bottom-0 h-[55%]" />
                  <div className="absolute inset-x-0 bottom-[8%] h-[40%]">
                    {Array.from({ length: 28 }).map((_, i) => {
                      const left = (i * 37) % 100;
                      const top = (i * 19) % 85;
                      const size = (i % 3) + 1;
                      return (
                        <div
                          key={i}
                          className="animate-window-flicker absolute rounded-[1px]"
                          style={{
                            left: `${left}%`,
                            bottom: `${top}%`,
                            width: `${size}px`,
                            height: `${size + 1}px`,
                            background: i % 5 === 0 ? "#ff9a3c" : "#e8c791",
                            opacity: 0.7,
                            animationDelay: `${i * 0.3}s`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="blinds pointer-events-none absolute inset-0 opacity-70" />
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-y-0 left-1/3 w-px bg-[var(--ink-0)]" />
                    <div className="absolute inset-y-0 left-2/3 w-px bg-[var(--ink-0)]" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--ink-0)]" />
                  </div>

                  <div className="absolute inset-x-8 bottom-0 h-[32%]">
                    <div className="absolute inset-x-0 bottom-0 h-4" style={{ background: "linear-gradient(180deg, #3b2817 0%, #1d1c18 100%)", borderTop: "1px solid rgba(201,164,107,0.4)" }} />
                    <div className="absolute left-1/2 bottom-4 h-[60%] w-[55%] -translate-x-1/2 rounded-[2px] border border-[var(--brass-lo)]" style={{ background: "linear-gradient(180deg, #17161310 0%, #0a0a09 100%)", boxShadow: "0 0 24px -4px rgba(232,199,145,0.35)" }}>
                      <div className="relative m-1.5 h-[calc(100%-12px)] overflow-hidden rounded-[1px] bg-[var(--ink-0)]">
                        <svg viewBox="0 0 100 40" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#c9a46b" stopOpacity="0.35" />
                              <stop offset="100%" stopColor="#c9a46b" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <path d="M0,28 L10,25 L20,30 L30,22 L40,24 L50,15 L60,18 L70,10 L80,14 L90,6 L100,9 L100,40 L0,40 Z" fill="url(#sparkfill)" />
                          <path d="M0,28 L10,25 L20,30 L30,22 L40,24 L50,15 L60,18 L70,10 L80,14 L90,6 L100,9" fill="none" stroke="#e8c791" strokeWidth="0.6" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-0">
                    <div className="animate-brass-gleam absolute inset-y-0 w-1/3" style={{ background: "linear-gradient(110deg, transparent, rgba(232,199,145,0.18), transparent)" }} />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 divide-x divide-[var(--stroke)] overflow-hidden rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-0)]">
                  <Readout eyebrow="NET / M" value="+$2,770" tone="sage" />
                  <Readout eyebrow="BUDGET" value="62%" tone="amber" />
                  <Readout eyebrow="DAY · PORT" value="+1.18%" tone="sage" />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="label-eyebrow">Fig. 01 — The desk, facing outward</span>
                <span className="num text-[10px] text-bone-faint">[view:22·14]</span>
              </div>
            </div>
          </section>

          <section id="capabilities" className="mt-32">
            <div className="mb-16 grid gap-4 md:grid-cols-[1fr_1.4fr] md:items-end">
              <div>
                <span className="label-eyebrow-brass">§ Capabilities</span>
                <h2 className="display mt-4 text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] text-bone">
                  Instruments,<br />
                  not <span className="italic text-bone-mute">decorations.</span>
                </h2>
              </div>
              <p className="text-[14px] leading-[1.7] text-bone-mute md:max-w-lg md:justify-self-end">
                Every surface is functional. No throwaway graphics, no vanity charts,
                no placeholders dressed as insight. If it&apos;s on the screen, it&apos;s load-bearing.
              </p>
            </div>

            <div className="grid gap-px bg-[var(--stroke)] md:grid-cols-3">
              {[
                {
                  eyebrow: "LAYER · 01",
                  title: "Transaction truth",
                  body: "Plaid-imported, normalized, categorized — with a deterministic floor underneath every AI suggestion.",
                  stat: "2 LAYER",
                  statLabel: "AI + DETERMINISTIC",
                },
                {
                  eyebrow: "LAYER · 02",
                  title: "Budget visibility",
                  body: "Spent-so-far is always derived from transactions, never stored. Categories flex with how you actually live.",
                  stat: "LIVE",
                  statLabel: "NO STALE MIRRORS",
                },
                {
                  eyebrow: "LAYER · 03",
                  title: "Scenario engine",
                  body: "Simulate allocations on virtual dollars mapped to real income. Practice the move before taking it.",
                  stat: "T–0",
                  statLabel: "ZERO RISK SANDBOX",
                },
              ].map((c, i) => (
                <article
                  key={c.title}
                  className="group relative bg-ink-0 p-8 transition-colors hover:bg-[var(--ink-1)] animate-fade-slide"
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  <div className="absolute left-0 top-0 h-px w-0 bg-brass transition-all duration-500 group-hover:w-full" />
                  <span className="label-eyebrow">{c.eyebrow}</span>
                  <h3 className="display mt-6 text-[28px] leading-tight text-bone">{c.title}</h3>
                  <p className="mt-3 text-[13px] leading-[1.7] text-bone-mute">{c.body}</p>
                  <div className="mt-10 flex items-end justify-between border-t border-[var(--stroke)] pt-4">
                    <span className="num text-[22px] text-brass-hi">{c.stat}</span>
                    <span className="label-eyebrow">{c.statLabel}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section id="method" className="mt-32">
            <div className="grid gap-8 md:grid-cols-[1fr_2fr] md:gap-16">
              <div className="md:sticky md:top-12 md:self-start">
                <span className="label-eyebrow-brass">§ Method</span>
                <h2 className="display mt-4 text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] text-bone">
                  Three steps.<br />
                  Nothing <span className="italic text-bone-mute">ornamental.</span>
                </h2>
                <div className="rule mt-8 max-w-[200px]" />
              </div>

              <ol className="space-y-px">
                {pillars.map((p) => (
                  <li
                    key={p.index}
                    className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-8 border-t border-[var(--stroke)] py-8 transition-colors first:border-t-0 hover:bg-[var(--ink-1)]"
                  >
                    <span className="display text-[56px] leading-none text-bone-ghost transition-colors group-hover:text-brass">
                      {p.index}
                    </span>
                    <div>
                      <h3 className="display text-[28px] leading-tight text-bone">{p.title}</h3>
                      <p className="mt-2 max-w-md text-[13px] leading-[1.7] text-bone-mute">{p.body}</p>
                    </div>
                    <span className="label-eyebrow hidden transition-colors group-hover:text-brass md:inline">→</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section id="ledger" className="relative mt-32 overflow-hidden rounded-[3px] border border-[var(--stroke-2)] brackets">
            <div className="absolute inset-0 blinds pointer-events-none opacity-50" />
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 120%, rgba(255,154,60,0.09), transparent 60%), radial-gradient(ellipse at 20% -10%, rgba(232,199,145,0.06), transparent 50%)" }} />

            <div className="relative grid gap-10 px-8 py-16 md:grid-cols-[1.3fr_1fr] md:items-center md:px-16 md:py-24">
              <div>
                <span className="label-eyebrow-brass">The offer</span>
                <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4rem)] leading-[0.98] text-bone">
                  Close the browser tabs.<br />
                  Open the <span className="italic text-brass-hi">desk.</span>
                </h2>
                <p className="mt-6 max-w-md text-[14px] leading-[1.7] text-bone-mute">
                  Free to use. Open source. Every keystroke local-first where it can be,
                  cleanly wired to your banks where it can&apos;t.
                </p>
                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Link href="/login" className="btn-brass">
                    Take the desk
                    <span aria-hidden>→</span>
                  </Link>
                  <a
                    href="https://github.com/abbeazale/finwin"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost"
                  >
                    Inspect the source
                  </a>
                </div>
              </div>

              <div className="relative rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)]/70 p-6 smoked">
                <div className="mb-4 flex items-center justify-between">
                  <span className="label-eyebrow">Ledger · preview</span>
                  <span className="pill pill-sage"><span className="h-1 w-1 rounded-full bg-[var(--sage-hi)] animate-pulse-dot" />Live</span>
                </div>
                <div className="space-y-3 font-[family-name:var(--font-mono)] text-[11px]">
                  {[
                    ["2026-04-16", "Whole Foods", "-42.18", "oxide"],
                    ["2026-04-16", "Payroll", "+3,240.00", "sage"],
                    ["2026-04-15", "Blue Bottle", "-6.25", "oxide"],
                    ["2026-04-15", "Rent", "-1,875.00", "oxide"],
                    ["2026-04-14", "Dividend · VTI", "+38.40", "sage"],
                  ].map(([d, m, amt, tone]) => (
                    <div key={String(d) + String(m)} className="grid grid-cols-[90px_1fr_auto] gap-3 border-b border-[var(--stroke)] pb-3 last:border-b-0">
                      <span className="text-bone-faint">{d}</span>
                      <span className="text-bone">{m}</span>
                      <span className={tone === "sage" ? "text-sage-hi" : "text-oxide-hi"}>{amt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-20 grid gap-6 border-t border-[var(--stroke)] pt-10 md:grid-cols-3">
            <div>
              <span className="display text-[22px] text-bone">Fin<span className="italic text-brass">Win</span></span>
              <p className="mt-2 text-[12px] text-bone-faint">A command center for your money.</p>
            </div>
            <div className="md:justify-self-center">
              <span className="label-eyebrow">System</span>
              <p className="mt-2 text-[12px] text-bone-mute">Next.js · Plaid · Drizzle · Better Auth</p>
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <span className="label-eyebrow">MIT · Open source</span>
              <a href="https://github.com/abbeazale/finwin" className="text-[12px] text-bone-mute hover:text-brass-hi">
                github.com/abbeazale/finwin ↗
              </a>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Readout({
  eyebrow,
  value,
  tone,
}: {
  eyebrow: string;
  value: string;
  tone: "sage" | "oxide" | "amber";
}) {
  const color =
    tone === "sage" ? "text-sage-hi" : tone === "oxide" ? "text-oxide-hi" : "text-amber";
  return (
    <div className="flex flex-col gap-1 px-3 py-3">
      <span className="label-eyebrow">{eyebrow}</span>
      <span className={`num text-[16px] ${color}`}>{value}</span>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<HomeProps> = async (context) => {
  const session = await getPageSession(context);

  if (!session) {
    return { props: { quotes: getTickerQuotesForLanding() } };
  }

  const profile = await getUserProfile(session.user.id);

  if (!hasCompletedOnboarding(profile)) {
    return { redirect: { destination: "/onboarding", permanent: false } };
  }

  return { redirect: { destination: "/dashboard", permanent: false } };
};
