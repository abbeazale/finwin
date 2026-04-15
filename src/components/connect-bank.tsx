import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus } from "lucide-react";

type ConnectBankProps = {
  onConnected?: (result: { connectionId: string; accountCount: number }) => void;
};

export function ConnectBank({ onConnected }: ConnectBankProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = useCallback(
    async (public_token: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/plaid/exchange", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ public_token }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Exchange failed");
        const data = (await res.json()) as { connectionId: string; accountCount: number };
        onConnected?.(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Exchange failed");
      } finally {
        setLoading(false);
        setLinkToken(null);
      }
    },
    [onConnected],
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
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Link token request failed");
      const { link_token } = (await res.json()) as { link_token: string };
      setLinkToken(link_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link token request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={startLink}
        disabled={loading}
        className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#00d3f3] px-3 text-black disabled:opacity-60"
      >
        <Plus className="size-3.5" />
        {loading ? "Connecting…" : "Connect bank"}
      </button>
      {error ? <span className="text-[11px] text-[#f87171]">{error}</span> : null}
    </div>
  );
}
