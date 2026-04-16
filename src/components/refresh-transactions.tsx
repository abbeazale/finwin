import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";

type RefreshResult = { added: number; modified: number; removed: number };

type Props = {
  onRefreshed?: (totals: RefreshResult) => void;
};

export function RefreshTransactions({ onRefreshed }: Props) {
  const [error, setError] = useState<string | null>(null);

  const syncTransactions = trpc.plaid.syncTransactions.useMutation({
    onSuccess: (data) => {
      const totals = data.results.reduce(
        (acc, r) => ({
          added: acc.added + r.added,
          modified: acc.modified + r.modified,
          removed: acc.removed + r.removed,
        }),
        { added: 0, modified: 0, removed: 0 },
      );
      onRefreshed?.(totals);
    },
    onError: (e) => {
      setError(e.message ?? "Sync failed");
    },
  });

  const loading = syncTransactions.isPending;

  function refresh() {
    setError(null);
    syncTransactions.mutate({});
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        className="btn-ghost disabled:opacity-60"
      >
        <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Syncing…" : "Sync"}
      </button>
      {error ? <span className="text-[11px] text-oxide-hi">{error}</span> : null}
    </div>
  );
}
