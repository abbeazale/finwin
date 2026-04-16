import { useState } from "react";
import { RefreshCw } from "lucide-react";

type RefreshResult = { added: number; modified: number; removed: number };

type Props = {
  onRefreshed?: (totals: RefreshResult) => void;
};

export function RefreshTransactions({ onRefreshed }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/sync", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Sync failed");
      const { results } = (await res.json()) as { results: RefreshResult[] };
      const totals = results.reduce(
        (acc, r) => ({
          added: acc.added + r.added,
          modified: acc.modified + r.modified,
          removed: acc.removed + r.removed,
        }),
        { added: 0, modified: 0, removed: 0 },
      );
      onRefreshed?.(totals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setLoading(false);
    }
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
