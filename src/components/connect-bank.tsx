import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus, RotateCw } from "lucide-react";

type ConnectBankProps = {
  /** Pass to reconnect (Plaid Link update mode) an existing connection. */
  connectionId?: string;
  label?: string;
  className?: string;
  onConnected?: (result: { connectionId: string; accountCount: number }) => void;
  onReconnected?: (connectionId: string) => void;
};

export function ConnectBank({
  connectionId,
  label,
  className,
  onConnected,
  onReconnected,
}: ConnectBankProps) {
  const isUpdate = Boolean(connectionId);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback(
    async (public_token: string) => {
      setLoading(true);
      setError(null);
      try {
        if (isUpdate && connectionId) {
          // Update mode: no public_token exchange; just flip status.
          const res = await fetch(`/api/plaid/connections/${connectionId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ status: "active" }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Reactivate failed");
          onReconnected?.(connectionId);
          return;
        }
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Exchange failed");
        const data = (await res.json()) as { connectionId: string; accountCount: number };
        onConnected?.(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    [isUpdate, connectionId, onConnected, onReconnected],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token) => {
      void handleSuccess(public_token);
    },
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  async function startLink() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(connectionId ? { connectionId } : {}),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Link token request failed");
      const { link_token } = (await res.json()) as { link_token: string };
      setLinkToken(link_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link token request failed");
    } finally {
      setLoading(false);
    }
  }

  const buttonClass = className ?? (isUpdate ? "btn-ghost" : "btn-brass");

  const Icon = isUpdate ? RotateCw : Plus;

  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" onClick={startLink} disabled={loading} className={buttonClass}>
        <Icon className="size-3.5" />
        {loading ? "Connecting…" : label ?? (isUpdate ? "Reconnect" : "Connect bank")}
      </button>
      {error ? <span className="text-[11px] text-oxide-hi">{error}</span> : null}
    </div>
  );
}
