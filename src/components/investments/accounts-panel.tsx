import type { RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { MiniPill } from "./panel";
import { formatNullableMoney, formatPercent } from "./format";

type Account = RouterOutputs["investments"]["getAccounts"]["accounts"][number];

// Accounts read as a filter, not a reference list, so they sit across the top
// as selectable cards and leave the full width to the holdings table.
export function AccountsStrip({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: Account[];
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
}) {
  return (
    <section aria-label="Accounts" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="display text-[26px] leading-none text-bone">Accounts</h2>
        {selectedAccountId !== "all" ? (
          <button
            type="button"
            onClick={() => onSelect("all")}
            className="text-[13px] text-brass-hi transition-colors hover:text-bone"
          >
            Show all accounts
          </button>
        ) : (
          <span className="text-[13px] text-bone-faint">
            Select one to filter the holdings and activity below
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const selected = account.accountId === selectedAccountId;
          const gain = Number(account.totalGainLossUsd ?? 0);
          return (
            <button
              key={account.accountId}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(selected ? "all" : account.accountId)}
              className={cn(
                "flex items-start justify-between gap-4 rounded-[16px] border px-5 py-4 text-left transition-colors cove",
                selected
                  ? "border-[var(--stroke-brass-hi)] bg-[rgba(201,164,107,0.07)]"
                  : "border-[var(--stroke-2)] bg-[var(--ink-1)] hover:border-[var(--stroke-3)] hover:bg-[var(--ink-2-solid)]",
              )}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14px] text-bone">
                    {account.accountName}
                  </span>
                  {!account.isActive ? (
                    <MiniPill label="Inactive" tone="oxide" />
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-[12px] text-bone-faint">
                  {account.accountSubtype ?? "Investment"}
                  {account.accountMask ? ` · ${account.accountMask}` : ""} ·{" "}
                  {account.holdingCount} holding
                  {account.holdingCount === 1 ? "" : "s"}
                </span>
              </span>
              <span className="whitespace-nowrap text-right">
                <span className="block font-mono text-[14px] tabular-nums text-bone">
                  {formatNullableMoney(account.totalValueUsd)}
                </span>
                {account.totalGainLossUsd === null ? null : (
                  <span
                    className={cn(
                      "mt-0.5 block font-mono text-[12px] tabular-nums",
                      gain < 0 ? "text-oxide-hi" : "text-sage-hi",
                    )}
                  >
                    {formatPercent(account.totalGainLossPct)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
