import type { RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { MiniPill, Panel, PanelStatus } from "./panel";
import {
  formatNativeMoney,
  formatNullableMoney,
  formatPercent,
  isStaleDate,
  trimDecimal,
} from "./format";

type Holding = RouterOutputs["investments"]["getHoldings"]["holdings"][number];

function priceDetail(
  source: Holding["priceSource"],
  asOf: string | null | undefined,
) {
  const label =
    source === "close"
      ? "Close"
      : source === "institution"
        ? "Institution"
        : "No price";
  return asOf ? `${label} · ${asOf}` : label;
}

export function HoldingsPanel({
  holdings,
  loading,
}: {
  holdings: Holding[];
  loading: boolean;
}) {
  return (
    <Panel
      title="Holdings"
      meta={`${holdings.length} position${holdings.length === 1 ? "" : "s"}`}
    >
      {loading ? (
        <PanelStatus label="Loading holdings..." />
      ) : holdings.length === 0 ? (
        <PanelStatus label="No holdings reported for the selected account scope." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="table-head border-b border-[var(--stroke)]">
              <tr>
                <th className="px-6 py-2.5 font-normal">Security</th>
                <th className="px-3 py-2.5 text-right font-normal">Shares</th>
                <th className="px-3 py-2.5 text-right font-normal">Price</th>
                <th className="px-3 py-2.5 text-right font-normal">
                  Market value
                </th>
                <th className="px-3 py-2.5 text-right font-normal">
                  Cost basis
                </th>
                <th className="px-6 py-2.5 text-right font-normal">
                  Gain / loss
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--stroke)]">
              {holdings.map((holding) => {
                const flags = [
                  holding.isCashEquivalent && { label: "Cash" as const },
                  holding.excludedFromUsd && {
                    label: holding.nativeCurrency ?? "FX",
                    tone: "amber" as const,
                  },
                  holding.fxRateStale && {
                    label: "Stale FX",
                    tone: "amber" as const,
                  },
                  holding.priceSource === "close" && {
                    label: "Close price",
                    tone: "amber" as const,
                  },
                  holding.priceSource === "missing" && {
                    label: "No price",
                    tone: "oxide" as const,
                  },
                  isStaleDate(holding.institutionPriceAsOf) && {
                    label: "Stale price",
                    tone: "oxide" as const,
                  },
                ].filter(Boolean) as { label: string; tone?: "amber" | "oxide" }[];
                return (
                  <tr
                    key={holding.holdingId}
                    className="transition-colors hover:bg-[rgba(232,225,210,0.03)]"
                  >
                    <td className="max-w-[18rem] px-6 py-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="font-medium text-bone">
                          {holding.tickerSymbol ??
                            holding.securityName ??
                            "Unlabeled security"}
                        </span>
                        <span className="truncate text-[12px] text-bone-faint">
                          {holding.tickerSymbol
                            ? (holding.securityName ??
                              holding.securityType ??
                              "")
                            : (holding.securityType ?? "")}
                        </span>
                      </div>
                      {flags.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {flags.map((flag) => (
                            <MiniPill
                              key={flag.label}
                              label={flag.label}
                              tone={flag.tone}
                            />
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-bone-mute">
                      {trimDecimal(holding.quantity)}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums"
                      title={priceDetail(
                        holding.priceSource,
                        holding.institutionPriceAsOf,
                      )}
                    >
                      {formatNativeMoney(
                        holding.institutionPriceNative,
                        holding.priceCurrency,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums">
                      {formatNativeMoney(
                        holding.marketValueNative,
                        holding.marketValueCurrency,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-bone-mute">
                      {formatNativeMoney(
                        holding.costBasisNative,
                        holding.costBasisCurrency,
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-right font-mono tabular-nums">
                      {holding.gainLossUsd === null ? (
                        <span className="text-bone-faint">-</span>
                      ) : (
                        <>
                          <span
                            className={cn(
                              Number(holding.gainLossUsd) < 0
                                ? "text-oxide-hi"
                                : "text-sage-hi",
                            )}
                          >
                            {formatNullableMoney(holding.gainLossUsd, true)}
                          </span>
                          <span className="ml-2 text-[12px] text-bone-faint">
                            {formatPercent(holding.gainLossPct)}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
