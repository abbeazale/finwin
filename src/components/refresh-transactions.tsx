import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc, type RouterOutputs } from "@/lib/trpc";

type SyncTransactionsResult = RouterOutputs["plaid"]["syncTransactions"]["results"][number];

export type RefreshResult = Pick<SyncTransactionsResult, "added" | "modified" | "removed"> & {
  hasConnectionErrors: boolean;
};

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
          hasConnectionErrors: acc.hasConnectionErrors || r.status === "sync_failed",
        }),
        { added: 0, modified: 0, removed: 0, hasConnectionErrors: false },
      );
      onRefreshed?.(totals);
    },
    onError: (e) => {
      setError(e.message);
    },
  });

  const loading = syncTransactions.isPending;

  function refresh() {
    setError(null);
    syncTransactions.mutate({});
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        onClick={refresh}
        disabled={loading}
        className="btn-ghost disabled:opacity-60"
      >
        <RefreshCw data-icon="inline-start" className={loading ? "animate-spin" : undefined} />
        {loading ? "Syncing…" : "Sync"}
      </Button>
      {error ? <span className="text-[11px] text-oxide-hi">{error}</span> : null}
    </div>
  );
}
