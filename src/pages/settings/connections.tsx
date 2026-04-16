import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, Plug, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useSession } from "@/lib/auth-client";
import { ConnectBank } from "@/components/connect-bank";

type ConnectionRow = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  accounts: { name: string; mask: string | null; type: string }[];
  lastTransactionDate: string | null;
};

export default function ConnectionsSettings() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  const { data: session, isPending: sessionLoading } = useSession();
  useEffect(() => {
    if (!sessionLoading && !session) router.push("/login");
  }, [session, sessionLoading, router]);

  const connectionsQuery = trpc.plaid.listConnections.useQuery();
  const { data: connections = [], isLoading } = connectionsQuery;

  const unlinkMutation = trpc.plaid.unlinkConnection.useMutation({
    onSuccess: () => {
      setMessage("Connection unlinked.");
      void connectionsQuery.refetch();
    },
    onError: (e) => setMessage(e.message ?? "Unlink failed"),
  });

  async function unlink(id: string) {
    if (!confirm("Unlink this bank connection? Transactions stay for history.")) return;
    setMessage(null);
    unlinkMutation.mutate({ id });
  }

  if (isLoading || sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-0 text-bone-mute">
        Loading…
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-ink-0 text-bone">
      {/* Atmosphere */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 right-[15%] h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(232,199,145,0.05), transparent 65%)" }} />
        <div className="absolute -bottom-40 left-0 h-[28rem] w-[48rem] blur-3xl" style={{ background: "radial-gradient(ellipse, rgba(255,154,60,0.04), transparent 60%)" }} />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-10 sm:px-10">
        {/* Header */}
        <div className="mb-12 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="label-eyebrow inline-flex items-center gap-2 transition-colors hover:text-brass-hi"
            >
              <ArrowLeft className="size-3" />
              Back to desk
            </Link>
            <span className="label-eyebrow">Settings · 01 / 04</span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="label-eyebrow-brass">§ Infrastructure</span>
              <h1 className="display mt-3 text-[clamp(2rem,4vw,3.2rem)] leading-[1] text-bone">
                Bank <span className="italic text-brass-hi">wiring.</span>
              </h1>
              <p className="mt-3 max-w-md text-[13px] leading-[1.7] text-bone-mute">
                The plumbing between your accounts and the desk. Unlink anytime — history stays.
              </p>
            </div>
            <ConnectBank onConnected={() => void connectionsQuery.refetch()} />
          </div>

          {/* Settings nav tabs */}
          <div className="flex items-center gap-px overflow-x-auto border-b border-[var(--stroke)]">
            {[
              { label: "Connections", active: true },
              { label: "Profile", active: false },
              { label: "Notifications", active: false },
              { label: "Security", active: false },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                className={`relative whitespace-nowrap px-4 py-3 text-[11px] uppercase tracking-[0.12em] transition-colors ${
                  t.active ? "text-brass-hi" : "text-bone-mute hover:text-bone"
                }`}
              >
                {t.label}
                {t.active ? (
                  <span className="absolute inset-x-3 -bottom-px h-[2px] bg-brass" style={{ boxShadow: "0 0 8px var(--brass-glow)" }} />
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {message ? (
          <p className="mb-8 flex items-center gap-3 rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.05)] px-4 py-2.5 text-[12px] text-brass-hi">
            <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse-dot" />
            {message}
          </p>
        ) : null}

        {connections.length === 0 ? (
          <div className="relative rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-1)] p-16 text-center cove brackets">
            <div
              className="absolute inset-0 blinds pointer-events-none opacity-30"
              aria-hidden
            />
            <div className="relative flex flex-col items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-[2px] border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
                <Plug className="size-5" />
              </div>
              <h2 className="display text-[28px] leading-tight text-bone">
                No wiring yet.
              </h2>
              <p className="max-w-sm text-[13px] text-bone-mute">
                Connect a bank to start pulling transactions into the desk.
              </p>
              <div className="mt-2">
                <ConnectBank onConnected={() => void connectionsQuery.refetch()} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 pb-2">
              <span className="label-eyebrow">Conn</span>
              <span className="label-eyebrow">Accounts</span>
              <span className="label-eyebrow hidden lg:inline">Last sync</span>
              <span className="label-eyebrow text-right">Action</span>
            </div>
            {connections.map((conn) => (
              <article
                key={conn.id}
                className="group relative rounded-[2px] border border-[var(--stroke)] bg-[var(--ink-1)] p-5 transition-colors hover:border-[var(--stroke-2)] cove"
              >
                <div className="grid gap-5 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center lg:gap-6">
                  <div className="flex size-10 items-center justify-center rounded-[2px] border border-[var(--stroke-2)] bg-[var(--ink-0)] text-brass-hi">
                    <Building2 className="size-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="text-[14px] text-bone">
                        {conn.accounts.length} account{conn.accounts.length === 1 ? "" : "s"}
                      </span>
                      <StatusPill status={conn.status} />
                      <span className="num text-[10px] text-bone-faint">
                        #{conn.id.slice(0, 8)}
                      </span>
                    </div>
                    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-bone-mute">
                      {conn.accounts.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-bone">{a.name}</span>
                          {a.mask ? (
                            <span className="num text-bone-faint">··{a.mask}</span>
                          ) : null}
                          <span className="label-eyebrow">{a.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="hidden flex-col items-end gap-0.5 lg:flex">
                    <span className="num text-[11px] text-bone">
                      {new Date(conn.updatedAt).toLocaleDateString()}
                    </span>
                    <span className="label-eyebrow">
                      {new Date(conn.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {conn.lastTransactionDate ? (
                      <span className="label-eyebrow">
                        LAST TX · {conn.lastTransactionDate.slice(5)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {conn.status === "error" ? (
                      <ConnectBank
                        connectionId={conn.id}
                        label="Reconnect"
                        onReconnected={() => void connectionsQuery.refetch()}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => unlink(conn.id)}
                      disabled={unlinkMutation.isPending && unlinkMutation.variables?.id === conn.id}
                      className="inline-flex h-10 items-center gap-2 rounded-[2px] border border-[rgba(194,106,72,0.3)] bg-[rgba(194,106,72,0.06)] px-4 text-[11px] uppercase tracking-[0.12em] text-oxide-hi transition-colors hover:border-[rgba(194,106,72,0.5)] hover:bg-[rgba(194,106,72,0.12)] disabled:opacity-50"
                    >
                      <Trash2 className="size-3" />
                      {unlinkMutation.isPending && unlinkMutation.variables?.id === conn.id ? "Unlinking…" : "Unlink"}
                    </button>
                  </div>
                </div>

                <div className="pointer-events-none absolute left-0 top-0 h-px w-0 bg-brass transition-all duration-500 group-hover:w-full" />
              </article>
            ))}
          </div>
        )}

        <footer className="mt-16 grid gap-8 border-t border-[var(--stroke)] pt-8 sm:grid-cols-3">
          <div>
            <span className="label-eyebrow">Data stays</span>
            <p className="mt-2 text-[12px] text-bone-mute">
              Unlinking keeps all transaction history in your ledger.
            </p>
          </div>
          <div>
            <span className="label-eyebrow">Plaid cursor</span>
            <p className="mt-2 text-[12px] text-bone-mute">
              Sync runs on-demand and via webhook on new transactions.
            </p>
          </div>
          <div>
            <span className="label-eyebrow">Security</span>
            <p className="mt-2 text-[12px] text-bone-mute">
              ES256-verified webhooks. Tokens server-side only.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "pill pill-sage",
    error: "pill pill-amber",
    revoked: "pill pill-oxide",
  };
  const cls = map[status] ?? "pill pill-bone";
  return (
    <span className={cls}>
      {status === "active" ? (
        <span className="h-1 w-1 rounded-full bg-[var(--sage-hi)] animate-pulse-dot" />
      ) : null}
      {status}
    </span>
  );
}
