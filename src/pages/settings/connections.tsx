import { useState } from "react";
import { Building2, Plug, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useRequireSession } from "@/hooks/use-require-session";
import { ConnectBank, type ConnectBankResult } from "@/components/connect-bank";
import { PageStatus } from "@/components/page-status";
import { AppShell } from "@/components/dashboard/app-shell";
import {
  Notice,
  PageHeading,
  SettingsTabs,
  ShellLoading,
} from "@/components/dashboard/desk-ui";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  BANK_CONNECTION_STATUS_LABELS,
  getBankLinkNotice,
  type BankConnectionStatus,
} from "@/lib/bank-connection-status";

type ConnectionNotice = { text: string; tone: "info" | "warn" };

const UNLINK_NOTICES: Record<string, ConnectionNotice> = {
  revoked: {
    text: "Connection unlinked and access revoked at your bank. Transaction history stays in your ledger.",
    tone: "info",
  },
  pending: {
    text: "Connection unlinked. Your bank has not confirmed the revocation yet, so FinWin keeps retrying until it does. Transaction history stays in your ledger.",
    tone: "warn",
  },
  manual: {
    text: "Connection unlinked, but FinWin could not revoke access at your bank and cannot retry. Remove FinWin in your bank's connected-apps settings, then contact support.",
    tone: "warn",
  },
};

export default function ConnectionsSettings() {
  const [message, setMessage] = useState<ConnectionNotice | null>(null);

  const { session, isPending: sessionLoading } = useRequireSession();

  const connectionsQuery = trpc.plaid.listConnections.useQuery(undefined, {
    enabled: Boolean(session),
  });
  const { data: connections = [], isLoading } = connectionsQuery;

  const unlinkMutation = trpc.plaid.unlinkConnection.useMutation({
    // The bank may not confirm revocation straight away. Say which of the three
    // outcomes actually happened rather than reporting a flat success.
    onSuccess: (result) => {
      setMessage(UNLINK_NOTICES[result.revocation] ?? UNLINK_NOTICES.pending);
      void connectionsQuery.refetch();
    },
    onError: (e) => setMessage({ text: e.message, tone: "warn" }),
  });

  const retrySyncMutation = trpc.plaid.syncTransactions.useMutation({
    onSuccess: (data) => {
      const result = data.results[0];
      if (!result || result.status === "sync_failed") {
        setMessage({
          text: "The import still needs attention. Reconnect the bank if it requires a new login.",
          tone: "warn",
        });
      } else {
        setMessage({
          text: `Import recovered. Added ${result.added}, updated ${result.modified}, and removed ${result.removed} transactions.`,
          tone: "info",
        });
      }
      void connectionsQuery.refetch();
    },
    onError: (error) => {
      setMessage({ text: error.message, tone: "warn" });
      void connectionsQuery.refetch();
    },
  });

  async function handleConnected(result: ConnectBankResult) {
    setMessage(getBankLinkNotice(result));
    await connectionsQuery.refetch();
  }

  function retrySync(connectionId: string) {
    setMessage(null);
    retrySyncMutation.mutate({ connectionId });
  }

  async function unlink(id: string) {
    if (
      !confirm(
        "Unlink this bank connection? FinWin revokes access at your bank and keeps your transaction history.",
      )
    ) {
      return;
    }
    setMessage(null);
    unlinkMutation.mutate({ id });
  }

  if (isLoading || sessionLoading) {
    return (
      <AppShell>
        <ShellLoading label="Checking your bank connections…" />
      </AppShell>
    );
  }

  if (!session) return <PageStatus label="Redirecting…" />;

  return (
    <AppShell>
      <PageHeading
        kicker="Settings"
        title={
          <>
            Bank <span className="italic text-brass-hi">connections.</span>
          </>
        }
        description="The banks FinWin imports from. Unlink one at any time and its transaction history stays."
        aside={
          <ConnectBank
            onConnected={(result) => void handleConnected(result)}
          />
        }
      />
      <SettingsTabs active="connections" />

      {message ? (
        <Notice tone={message.tone === "warn" ? "warn" : "brass"}>
          {message.text}
        </Notice>
      ) : null}

      {connections.length === 0 ? (
        <div className="desk-panel p-16 text-center">
          <div className="relative flex flex-col items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-full border border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.06)] text-brass-hi">
              <Plug className="size-5" />
            </div>
            <h2 className="display text-[30px] leading-tight text-bone">
              No banks connected yet.
            </h2>
            <p className="max-w-sm text-[14px] leading-[1.7] text-bone-mute">
              Connect a bank to start importing your transactions.
            </p>
            <div className="mt-3">
              <ConnectBank
                onConnected={(result) => void handleConnected(result)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {connections.map((conn) => {
            const isSyncFailed = conn.status === "sync_failed";
            const importNeedsRetry = conn.status === "linked" || isSyncFailed;
            return (
              <article
                key={conn.id}
                className={`desk-panel p-6 transition-colors ${
                  isSyncFailed
                    ? "border-[rgba(232,140,72,0.35)] hover:border-[rgba(232,140,72,0.55)]"
                    : "hover:border-[var(--stroke-3)]"
                }`}
              >
                {isSyncFailed ? (
                  <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at top left, rgba(232,140,72,0.04), transparent 60%)" }} />
                ) : null}
                <div className="relative grid gap-5 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center lg:gap-6">
                  <div className={`flex size-11 items-center justify-center rounded-full border bg-[var(--ink-0)] ${isSyncFailed ? "border-[rgba(232,140,72,0.4)] text-amber" : "border-[var(--stroke-2)] text-brass-hi"}`}>
                    <Building2 className="size-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="display text-[22px] leading-none text-bone">
                        {conn.accounts.length} account{conn.accounts.length === 1 ? "" : "s"}
                      </span>
                      <StatusPill status={conn.status} />
                      {isSyncFailed && conn.syncErrorCode ? (
                        <span className="text-[12.5px] text-amber">
                          {formatSyncErrorCode(conn.syncErrorCode)}
                        </span>
                      ) : null}
                    </div>
                    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-bone-mute">
                      {conn.accounts.map((a, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-bone">{a.name}</span>
                          {a.mask ? (
                            <span className="num text-bone-faint">··{a.mask}</span>
                          ) : null}
                          <span className="text-[12px] capitalize text-bone-faint">{a.type}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="hidden flex-col items-end gap-0.5 lg:flex">
                    {conn.lastSyncedAt ? (
                      <>
                        <span className="text-[13px] text-bone">
                          Synced {new Date(conn.lastSyncedAt).toLocaleDateString()}
                        </span>
                        <span className="text-[12px] text-bone-faint">
                          {new Date(conn.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </>
                    ) : (
                      <span className="text-[13px] text-bone-faint">Never synced</span>
                    )}
                    {conn.lastTransactionDate ? (
                      <span className="text-[12px] text-bone-faint">
                        Latest transaction {conn.lastTransactionDate.slice(5)}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isSyncFailed ? (
                      <ConnectBank
                        connectionId={conn.id}
                        label="Reconnect"
                        onReconnected={() => retrySync(conn.id)}
                      />
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => unlink(conn.id)}
                      disabled={unlinkMutation.isPending && unlinkMutation.variables?.id === conn.id}
                      className="btn-soft btn-soft--lg text-oxide-hi hover:border-[rgba(194,106,72,0.45)] hover:text-oxide-hi"
                    >
                      <Trash2 data-icon="inline-start" />
                      {unlinkMutation.isPending && unlinkMutation.variables?.id === conn.id ? "Unlinking…" : "Unlink"}
                    </Button>
                  </div>
                </div>

                {importNeedsRetry ? (
                  <Alert
                    variant={isSyncFailed ? "destructive" : "default"}
                    className="relative mt-5 rounded-[14px]"
                  >
                    <TriangleAlert />
                    <AlertTitle>{isSyncFailed ? "Import failed" : "Import pending"}</AlertTitle>
                    <AlertDescription>
                      <p>
                        {isSyncFailed
                          ? "FinWin saved the connection, but the last import did not finish."
                          : "This connection has not completed its first import yet."}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="btn-soft mt-2"
                        onClick={() => retrySync(conn.id)}
                        disabled={
                          retrySyncMutation.isPending &&
                          retrySyncMutation.variables?.connectionId === conn.id
                        }
                      >
                        <RefreshCw
                          data-icon="inline-start"
                          className={
                            retrySyncMutation.isPending &&
                            retrySyncMutation.variables?.connectionId === conn.id
                              ? "animate-spin"
                              : undefined
                          }
                        />
                        {retrySyncMutation.isPending &&
                        retrySyncMutation.variables?.connectionId === conn.id
                          ? "Retrying import…"
                          : "Retry import"}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

              </article>
            );
          })}
        </div>
      )}

      <footer className="mt-14 grid gap-8 border-t border-[var(--stroke)] pt-8 sm:grid-cols-3">
        <div>
          <h3 className="display text-[18px] text-bone">Your history stays</h3>
          <p className="mt-2 text-[13px] leading-[1.7] text-bone-mute">
            Unlinking revokes FinWin&rsquo;s access at your bank. Every
            imported transaction stays where it is.
          </p>
        </div>
        <div>
          <h3 className="display text-[18px] text-bone">Syncing</h3>
          <p className="mt-2 text-[13px] leading-[1.7] text-bone-mute">
            New transactions arrive on their own, and you can sync at any
            time.
          </p>
        </div>
        <div>
          <h3 className="display text-[18px] text-bone">Security</h3>
          <p className="mt-2 text-[13px] leading-[1.7] text-bone-mute">
            Your bank access keys stay on FinWin&rsquo;s servers and never
            reach the browser.
          </p>
        </div>
      </footer>
    </AppShell>
  );
}

function StatusPill({ status }: { status: BankConnectionStatus }) {
  const map: Record<BankConnectionStatus, string> = {
    linked: "pill pill--soft pill-bone",
    syncing: "pill pill--soft pill-brass",
    ready: "pill pill--soft pill-sage",
    sync_failed: "pill pill--soft pill-amber",
  };
  return (
    <span className={map[status]}>
      {status === "ready" || status === "syncing" ? (
        <span className="h-1 w-1 rounded-full bg-[var(--sage-hi)] animate-pulse-dot" />
      ) : null}
      {BANK_CONNECTION_STATUS_LABELS[status]}
    </span>
  );
}

function formatSyncErrorCode(code: string): string {
  switch (code) {
    case "ITEM_LOGIN_REQUIRED":
      return "Login expired";
    case "ITEM_LOCKED":
      return "Account locked";
    case "INSUFFICIENT_CREDENTIALS":
      return "Credentials invalid";
    case "USER_SETUP_REQUIRED":
      return "Setup required";
    default:
      return "Sync error";
  }
}
