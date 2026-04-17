import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

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

  const createLinkToken = trpc.plaid.createLinkToken.useMutation();
  const exchangeToken = trpc.plaid.exchangeToken.useMutation();
  const reactivateConnection = trpc.plaid.reactivateConnection.useMutation();

  const handleSuccess = useCallback(
    async (public_token: string) => {
      setLoading(true);
      setError(null);
      try {
        if (isUpdate && connectionId) {
          // Update mode: no public_token exchange; just flip status.
          await reactivateConnection.mutateAsync({ id: connectionId });
          onReconnected?.(connectionId);
          return;
        }
        const data = await exchangeToken.mutateAsync({ publicToken: public_token });
        onConnected?.({ connectionId: data.connectionId, accountCount: data.accountCount });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    [isUpdate, connectionId, onConnected, onReconnected, reactivateConnection, exchangeToken],
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
      const data = await createLinkToken.mutateAsync(connectionId ? { connectionId } : {});
      setLinkToken(data.link_token);
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
      <Button
        type="button"
        variant="ghost"
        onClick={startLink}
        disabled={loading}
        className={buttonClass}
      >
        <Icon className="size-3.5" />
        {loading ? "Connecting…" : label ?? (isUpdate ? "Reconnect" : "Connect bank")}
      </Button>
      {error ? <span className="text-[11px] text-oxide-hi">{error}</span> : null}
    </div>
  );
}
