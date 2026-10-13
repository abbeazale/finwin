import type { RouterOutputs } from "@/lib/trpc";
import { Panel, PanelStatus } from "./panel";
import { formatNativeMoney, trimDecimal } from "./format";

type InvestmentTransaction =
  RouterOutputs["investments"]["getTransactions"]["transactions"][number];

export function TransactionsPanel({
  transactions,
  totalCount,
  loading,
}: {
  transactions: InvestmentTransaction[];
  totalCount: number;
  loading: boolean;
}) {
  return (
    <Panel
      title="Activity"
      meta={
        totalCount > transactions.length
          ? `${transactions.length} of ${totalCount}`
          : `${transactions.length} entr${transactions.length === 1 ? "y" : "ies"}`
      }
    >
      {loading ? (
        <PanelStatus label="Loading activity..." />
      ) : transactions.length === 0 ? (
        <PanelStatus label="No investment transactions reported for the selected account scope." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="table-head border-b border-[var(--stroke)]">
              <tr>
                <th className="px-6 py-2.5 font-normal">Date</th>
                <th className="px-3 py-2.5 font-normal">Activity</th>
                <th className="px-3 py-2.5 font-normal">Security</th>
                <th className="px-3 py-2.5 text-right font-normal">Quantity</th>
                <th className="px-3 py-2.5 text-right font-normal">Price</th>
                <th className="px-6 py-2.5 text-right font-normal">
                  Cash impact
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stroke)]">
              {transactions.map((transaction) => (
                <tr
                  key={transaction.transactionId}
                  className="transition-colors hover:bg-[rgba(232,225,210,0.03)]"
                >
                  <td className="whitespace-nowrap px-6 py-3 font-mono tabular-nums text-bone-mute">
                    {transaction.date}
                  </td>
                  <td className="px-3 py-3">
                    <span className="block text-bone">{transaction.name}</span>
                    <span className="block text-[12px] text-bone-faint">
                      {transaction.type}
                      {transaction.subtype ? ` · ${transaction.subtype}` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-bone-mute">
                    {transaction.tickerSymbol ??
                      transaction.securityName ??
                      "Cash movement"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-bone-mute">
                    {trimDecimal(transaction.quantity)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-bone-mute">
                    {formatNativeMoney(
                      transaction.price,
                      transaction.nativeCurrency,
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-3 text-right font-mono tabular-nums">
                    <span
                      className={
                        Number(transaction.cashImpact ?? 0) < 0
                          ? "text-oxide-hi"
                          : "text-sage-hi"
                      }
                    >
                      {formatNativeMoney(
                        transaction.cashImpact,
                        transaction.nativeCurrency,
                        true,
                      )}
                    </span>
                    {transaction.fees && Number(transaction.fees) !== 0 ? (
                      <span className="block text-[12px] text-bone-faint">
                        Fees{" "}
                        {formatNativeMoney(
                          transaction.fees,
                          transaction.nativeCurrency,
                        )}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
