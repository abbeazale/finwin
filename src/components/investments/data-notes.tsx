import { CircleAlert } from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import { isStaleDate } from "./format";

type Holding = RouterOutputs["investments"]["getHoldings"]["holdings"][number];
type Totals = RouterOutputs["investments"]["getHoldings"]["totals"];

type DataNote = { short: string; long: string };

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

// Every caveat the totals depend on, in one list the page can summarize.
export function collectDataNotes(
  totals: Totals | undefined,
  holdings: Holding[],
): DataNote[] {
  const notes: DataNote[] = [];
  const excluded = totals?.excludedHoldingCount ?? 0;
  const staleFx = totals?.staleFxRateCount ?? 0;
  const missingCostBasis = holdings.filter(
    (holding) => holding.costBasisNative === null,
  ).length;
  const closeFallback = holdings.filter(
    (holding) => holding.priceSource === "close",
  ).length;
  const missingPrice = holdings.filter(
    (holding) => holding.priceSource === "missing",
  ).length;
  const stalePrice = holdings.filter((holding) =>
    isStaleDate(holding.institutionPriceAsOf),
  ).length;

  if (excluded)
    notes.push({
      short: `${excluded} outside totals`,
      long: `${excluded} ${plural(excluded, "holding is", "holdings are")} visible below but excluded from USD market-value totals because price or FX data is missing.`,
    });
  if (staleFx)
    notes.push({
      short: `${staleFx} stale FX`,
      long: `${staleFx} ${plural(staleFx, "holding uses", "holdings use")} FX rates older than 7 days.`,
    });
  if (missingCostBasis)
    notes.push({
      short: `${missingCostBasis} without cost basis`,
      long: `${missingCostBasis} ${plural(missingCostBasis, "holding is", "holdings are")} missing institution cost basis, so gain/loss is suppressed instead of shown as zero.`,
    });
  if (closeFallback)
    notes.push({
      short: `${closeFallback} on close price`,
      long: `${closeFallback} ${plural(closeFallback, "holding is", "holdings are")} using the security close price because the institution holding price is zero or missing.`,
    });
  if (missingPrice)
    notes.push({
      short: `${missingPrice} without price`,
      long: `${missingPrice} ${plural(missingPrice, "holding is", "holdings are")} missing a usable institution or security close price.`,
    });
  if (stalePrice)
    notes.push({
      short: `${stalePrice} stale price`,
      long: `${stalePrice} ${plural(stalePrice, "holding has", "holdings have")} price data older than 7 days.`,
    });
  return notes;
}


// Each caveat used to occupy its own full-width banner, so a portfolio with
// several of them pushed the holdings off the screen. One strip carries the
// same facts, with the full sentences one click away.
export function DataNotes({ notes }: { notes: DataNote[] }) {
  if (notes.length === 0) return null;
  return (
    <details className="rounded-[14px] border border-[var(--stroke-brass)] bg-[rgba(201,164,107,0.05)] px-4 py-3 text-[13px] text-brass-hi">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <CircleAlert className="size-3.5 shrink-0" />
        <span className="font-medium">
          {notes.length} note{notes.length === 1 ? "" : "s"} on this data
        </span>
        <span className="truncate text-bone-mute">
          {notes.map((note) => note.short).join(" · ")}
        </span>
      </summary>
      <ul className="mt-3 flex flex-col gap-2 border-t border-[var(--stroke-brass)] pt-3 text-bone-mute">
        {notes.map((note) => (
          <li key={note.short}>{note.long}</li>
        ))}
      </ul>
    </details>
  );
}
