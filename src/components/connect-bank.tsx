import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc, type RouterOutputs } from "@/lib/trpc";

export type ConnectBankResult = Pick<
  RouterOutputs["plaid"]["exchangeToken"],
  "connectionId" | "accountCount" | "initialSync"
>;

type ConnectBankProps = {
  /** Pass to reconnect (Plaid Link update mode) an existing connection. */
  connectionId?: string;
  label?: string;
  className?: string;
  onConnected?: (result: ConnectBankResult) => void;
  onReconnected?: (connectionId: string) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

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
          await reactivateConnection.mutateAsync({ id: connectionId });
          onReconnected?.(connectionId);
          return;
        }
        const data = await exchangeToken.mutateAsync({ publicToken: public_token });
        onConnected?.({
          connectionId: data.connectionId,
          accountCount: data.accountCount,
          initialSync: data.initialSync,
        });
      } catch (e) {
        setError(getErrorMessage(e));
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
      setError(getErrorMessage(e));
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
        <Icon data-icon="inline-start" />
        {loading ? "Connecting…" : label ?? (isUpdate ? "Reconnect" : "Connect bank")}
      </Button>
      {error ? (
        <span className="max-w-xs text-right text-[11px] text-oxide-hi">{error}</span>
      ) : null}
    </div>
  );
}
