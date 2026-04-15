import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { and, desc, eq, ne } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { getPageSession } from "@/lib/page-auth";
import { db } from "@/index";
import { bankAccounts, bankConnections, transactions } from "@/db/schema";
import { ConnectBank } from "@/components/connect-bank";

type ConnectionRow = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  accounts: { name: string; mask: string | null; type: string }[];
  lastTransactionDate: string | null;
};

export default function ConnectionsSettings({
  connections,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function unlink(id: string) {
    if (!confirm("Unlink this bank connection? Transactions stay for history.")) return;
    setUnlinkingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/plaid/connections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Unlink failed");
      setMessage("Connection revoked.");
      router.replace(router.asPath);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unlink failed");
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#050a1a] text-white">
      <div className="mx-auto w-full max-w-[900px] px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-[12px] text-[#6a7282] hover:text-[#d1d5dc]"
            >
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl tracking-[-0.02em]">Bank connections</h1>
            <p className="mt-1 text-[13px] text-[#6a7282]">
              Manage the Plaid items linked to your FinWin account.
            </p>
          </div>
          <ConnectBank
            onConnected={() => router.replace(router.asPath)}
          />
        </div>

        {message ? (
          <p className="mb-4 rounded-lg border border-white/10 bg-[#0a1628] px-3 py-2 text-sm text-[#d1d5dc]">
            {message}
          </p>
        ) : null}

        {connections.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0a1628] px-5 py-10 text-center text-[13px] text-[#6a7282]">
            No banks connected yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {connections.map((conn) => (
              <li
                key={conn.id}
                className="rounded-2xl border border-white/10 bg-[#0a1628] px-5 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[#d1d5dc]">
                        {conn.accounts.length} account{conn.accounts.length === 1 ? "" : "s"}
                      </p>
                      <StatusPill status={conn.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-[#4a5565]">
                      Connected {new Date(conn.createdAt).toLocaleDateString()} ·
                      {" "}Last synced {new Date(conn.updatedAt).toLocaleString()}
                      {conn.lastTransactionDate
                        ? ` · Last tx ${conn.lastTransactionDate}`
                        : ""}
                    </p>
                    <ul className="mt-3 space-y-1 text-[12px] text-[#6a7282]">
                      {conn.accounts.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-[#d1d5dc]">{a.name}</span>
                          {a.mask ? <span>··{a.mask}</span> : null}
                          <span className="text-[#4a5565]">({a.type})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    {conn.status === "error" ? (
                      <ConnectBank
                        connectionId={conn.id}
                        label="Reconnect"
                        onReconnected={() => router.replace(router.asPath)}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => unlink(conn.id)}
                      disabled={unlinkingId === conn.id || conn.status === "revoked"}
                      className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#f8717140] bg-[#f8717112] px-3 text-[12px] text-[#fca5a5] disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                      {unlinkingId === conn.id ? "Unlinking…" : "Unlink"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "text-[#34d399] bg-[#34d39914]",
    error: "text-[#fbbf24] bg-[#fbbf2414]",
    revoked: "text-[#6a7282] bg-white/5",
  };
  const cls = map[status] ?? "text-[#6a7282] bg-white/5";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${cls}`}>{status}</span>;
}

export const getServerSideProps: GetServerSideProps<{
  connections: ConnectionRow[];
}> = async (context) => {
  const session = await getPageSession(context);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }

  const rows = await db
    .select({
      id: bankConnections.id,
      status: bankConnections.status,
      createdAt: bankConnections.createdAt,
      updatedAt: bankConnections.updatedAt,
    })
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.userId, session.user.id),
        ne(bankConnections.status, "revoked"),
      ),
    )
    .orderBy(desc(bankConnections.createdAt));

  const connections: ConnectionRow[] = await Promise.all(
    rows.map(async (r) => {
      const accts = await db
        .select({
          name: bankAccounts.name,
          mask: bankAccounts.mask,
          type: bankAccounts.type,
        })
        .from(bankAccounts)
        .where(eq(bankAccounts.connectionId, r.id));

      const [lastTx] = await db
        .select({ date: transactions.date })
        .from(transactions)
        .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
        .where(and(eq(bankAccounts.connectionId, r.id)))
        .orderBy(desc(transactions.date))
        .limit(1);

      return {
        id: r.id,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        accounts: accts,
        lastTransactionDate: lastTx?.date ?? null,
      };
    }),
  );

  return { props: { connections } };
};
