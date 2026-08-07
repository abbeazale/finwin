import Head from "next/head";
import Link from "next/link";

const sections = [
  {
    title: "What we collect",
    body: "When you create an account, FinWin stores your name, email, authentication credentials, and profile preferences (currency, timezone). If you connect a bank or investment account through Plaid, we receive and store account metadata, balances, transactions, holdings, and related identifiers needed to power budgeting and portfolio views.",
  },
  {
    title: "How we use it",
    body: "We use your data only to operate FinWin: authenticate you, import and categorize financial activity, show dashboards and budgets, sync connected accounts, and secure sensitive actions. We do not sell your personal or financial data.",
  },
  {
    title: "Bank connections (Plaid)",
    body: "Bank linking is provided by Plaid Inc. When you open Plaid Link, you authorize Plaid and FinWin to access the financial data you select. Plaid's own privacy policy also applies to data it processes. Access tokens are encrypted at rest before storage; we decrypt them only on the server to sync or manage your connection.",
  },
  {
    title: "Storage and security",
    body: "Data is stored in a hosted Postgres database and served over HTTPS. Sessions use secure cookies. Optional multi-factor authentication (passkeys and TOTP) is available. Sensitive bank-linking actions require a recent strong sign-in. No security measure is perfect; please protect your account credentials.",
  },
  {
    title: "Retention and deletion",
    body: "We keep your account and imported financial data while your account is active so history, budgets, and portfolio views remain available. You can unlink a bank connection; historical transactions already imported may remain associated with your account. To request account deletion or data removal, contact the address below and we will process the request within a reasonable time.",
  },
  {
    title: "Third parties",
    body: "We use infrastructure and service providers needed to run the product (hosting, database, authentication, bank data via Plaid, and optional market/FX data providers). These providers process data only as needed to deliver their services under their own terms.",
  },
  {
    title: "Your choices",
    body: "You can update profile settings in the app, enable MFA under Settings → Security, unlink bank connections under Settings → Connections, and sign out at any time. Connecting a bank is optional; core account features do not require it.",
  },
  {
    title: "Contact",
    body: "Questions about this policy or your data: abbeazale98@gmail.com.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink-0 text-bone">
      <Head>
        <title>Privacy Policy — FinWin</title>
        <meta
          name="description"
          content="How FinWin collects, uses, stores, and deletes account and financial data."
        />
      </Head>

      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute -top-40 right-[12%] h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(232,199,145,0.06), transparent 65%)",
          }}
        />
        <div
          className="absolute -bottom-40 left-0 h-[28rem] w-[48rem] blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="display text-[22px] leading-none text-bone">
              Fin<span className="italic text-brass">Win</span>
            </span>
          </Link>
          <span className="label-eyebrow">Privacy · 2026</span>
        </header>

        <main className="mt-16 flex-1 pb-20">
          <div className="mb-10">
            <span className="label-eyebrow-brass">Policy</span>
            <h1 className="display mt-4 text-[clamp(2.2rem,5vw,3.4rem)] leading-[1.02] text-bone">
              Privacy <span className="italic text-brass-hi">policy</span>
            </h1>
            <p className="mt-4 max-w-xl text-[14px] leading-[1.75] text-bone-mute">
              This page explains what FinWin collects when you use the app,
              including data received through Plaid when you connect a financial
              institution. Last updated August 6, 2026.
            </p>
          </div>

          <div className="space-y-px border border-[var(--stroke-2)] bg-[var(--stroke)]">
            {sections.map((section, index) => (
              <section
                key={section.title}
                className="bg-[var(--ink-1)] px-6 py-7 sm:px-8"
              >
                <div className="flex items-baseline gap-4">
                  <span className="label-eyebrow shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="display text-[22px] leading-tight text-bone">
                    {section.title}
                  </h2>
                </div>
                <p className="mt-3 text-[13px] leading-[1.75] text-bone-mute sm:pl-12">
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <p className="mt-10 text-[12px] leading-[1.7] text-bone-faint">
            FinWin is an early-stage personal finance product. This policy may
            be updated as features and legal requirements evolve. Material
            changes will be reflected on this page with a new &ldquo;Last
            updated&rdquo; date.
          </p>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--stroke)] pt-8 pb-4">
          <Link
            href="/"
            className="label-eyebrow transition-colors hover:text-brass-hi"
          >
            ← Back to FinWin
          </Link>
          <Link
            href="/login"
            className="label-eyebrow transition-colors hover:text-brass-hi"
          >
            Enter the desk →
          </Link>
        </footer>
      </div>
    </div>
  );
}
