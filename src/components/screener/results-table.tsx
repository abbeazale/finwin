import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReplaySymbol } from "@/lib/screener-replay";
import type { ReplayResult } from "@/server/screener/replay";
import { cn } from "@/lib/utils";
import { replayClock, replayDecimal } from "./format";

type Row = ReplayResult["rows"][number];

// Timestamps repeat across rows, so they belong under the table once rather
// than in a column beside every value.
function sharedValue(rows: Row[], pick: (row: Row) => string | null) {
  const values = new Set<string>();
  for (const row of rows) {
    const value = pick(row);
    if (value) values.add(value);
  }
  return values.size === 1 ? [...values][0] : null;
}

function clock(iso: string) {
  return replayClock.format(new Date(iso));
}

function conditions(input: ReplayResult["input"]) {
  const list: string[] = [];
  if (input.priceRange)
    list.push(`Price $${input.priceRange.minimum}–$${input.priceRange.maximum}`);
  if (input.dailyChange)
    list.push(`Daily change ≥ ${input.dailyChange.minimum}%`);
  if (input.relativeVolume)
    list.push(`Relative volume ≥ ${input.relativeVolume.minimum}×`);
  if (input.news) list.push(`News within ${input.news.hours}h`);
  if (input.float)
    list.push(`Float < ${(input.float.maximum / 1_000_000).toLocaleString("en-US")}M`);
  if (input.ema)
    list.push(
      `Price ${input.ema.comparison} EMA ${input.ema.period} (${input.ema.timeframe})`,
    );
  if (input.rsi)
    list.push(
      `RSI ${input.rsi.period} ${input.rsi.comparison} ${input.rsi.threshold} (${input.rsi.timeframe})`,
    );
  return list;
}

export function ResultsTable({
  result,
  selected,
  onSelect,
}: {
  result: ReplayResult;
  selected: ReplaySymbol | null;
  onSelect: (symbol: ReplaySymbol) => void;
}) {
  const { input, rows } = result;
  const noMatchCount = rows.length - result.matchCount - result.excludedCount;
  const priceCandle = sharedValue(rows, (row) =>
    row.status === "excluded" ? null : row.priceCandleEnd,
  );
  const emaCandle = sharedValue(rows, (row) =>
    row.status === "excluded" ? null : (row.ema?.candleEnd ?? null),
  );
  const emaSeed = sharedValue(rows, (row) =>
    row.status === "excluded" ? null : (row.ema?.seedStart ?? null),
  );
  const rsiCandle = sharedValue(rows, (row) =>
    row.status === "excluded" ? null : (row.rsi?.candleEnd ?? null),
  );
  const rsiSeed = sharedValue(rows, (row) =>
    row.status === "excluded" ? null : (row.rsi?.seedStart ?? null),
  );
  const activeConditions = conditions(input);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div
        className="flex flex-wrap items-baseline gap-x-4 gap-y-1"
        aria-live="polite"
      >
        <p className="display text-[26px] leading-none">
          <span className="text-[var(--sage-hi)]">
            {result.matchCount} matching
          </span>
          <span className="text-muted-foreground">
            {" "}
            of {rows.length} instruments
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {noMatchCount} not matching
          {result.excludedCount
            ? ` · ${result.excludedCount} missing data`
            : ""}{" "}
          · {input.session} at {input.time} New York
        </p>
      </div>
      {activeConditions.length ? (
        <ul className="flex flex-wrap gap-2">
          {activeConditions.map((condition) => (
            <li
              key={condition}
              className="panel-lifted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {condition}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="panel min-w-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instrument</TableHead>
              <TableHead className="text-right">Price</TableHead>
              {input.dailyChange ? (
                <TableHead className="text-right">Change</TableHead>
              ) : null}
              {input.relativeVolume ? (
                <TableHead className="text-right">Rel. volume</TableHead>
              ) : null}
              {input.ema ? (
                <TableHead className="text-right">EMA</TableHead>
              ) : null}
              {input.rsi ? (
                <TableHead className="text-right">RSI</TableHead>
              ) : null}
              {input.float ? (
                <TableHead className="text-right">Float</TableHead>
              ) : null}
              {input.news ? <TableHead>Recent news</TableHead> : null}
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.symbol}
                data-state={selected === row.symbol ? "selected" : undefined}
                className={cn(
                  selected === row.symbol && "bg-[rgba(201,164,107,0.06)]",
                )}
              >
                <TableCell className="font-medium">
                  <button
                    type="button"
                    aria-label={`View ${row.symbol} chart`}
                    aria-pressed={selected === row.symbol}
                    onClick={() => onSelect(row.symbol)}
                    className={cn(
                      "rounded-md px-1.5 py-0.5 -mx-1.5 underline-offset-4 transition-colors hover:text-brass-hi hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass-hi)]",
                      selected === row.symbol && "text-brass-hi underline",
                    )}
                  >
                    {row.symbol}
                  </button>
                </TableCell>
                {row.status === "excluded" ? (
                  <TableCell
                    colSpan={
                      2 +
                      Number(Boolean(input.ema)) +
                      Number(Boolean(input.dailyChange)) +
                      Number(Boolean(input.float)) +
                      Number(Boolean(input.news)) +
                      Number(Boolean(input.rsi)) +
                      Number(Boolean(input.relativeVolume))
                    }
                    className="whitespace-normal text-muted-foreground"
                  >
                    Missing data · {row.reason}
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="text-right tabular-nums">
                      {replayDecimal.format(row.price)}
                    </TableCell>
                    {row.dailyChange ? (
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.dailyChange.value >= 0
                            ? "text-[var(--sage-hi)]"
                            : "text-[var(--oxide-hi)]",
                        )}
                        title={`From $${replayDecimal.format(row.dailyChange.previousClose)} on ${row.dailyChange.session}`}
                      >
                        {row.dailyChange.value >= 0 ? "+" : ""}
                        {row.dailyChange.value.toFixed(2)}%
                      </TableCell>
                    ) : null}
                    {row.relativeVolume ? (
                      <TableCell
                        className="text-right tabular-nums"
                        title={`${row.relativeVolume.currentVolume.toLocaleString("en-US")} traded against a ${replayDecimal.format(row.relativeVolume.baselineVolume)} average`}
                      >
                        {row.relativeVolume.value.toFixed(2)}×
                      </TableCell>
                    ) : null}
                    {row.ema ? (
                      <TableCell className="text-right tabular-nums">
                        {replayDecimal.format(row.ema.value)}
                      </TableCell>
                    ) : null}
                    {row.rsi ? (
                      <TableCell className="text-right tabular-nums">
                        {row.rsi.value.toFixed(1)}
                      </TableCell>
                    ) : null}
                    {row.float ? (
                      <TableCell
                        className="text-right tabular-nums"
                        title={`${row.float.source} · as of ${row.float.effectiveAt.slice(0, 10)}`}
                      >
                        {(row.float.shares / 1_000_000).toFixed(1)}M
                      </TableCell>
                    ) : null}
                    {row.news ? (
                      <TableCell className="max-w-xs whitespace-normal">
                        {row.news.length ? (
                          <ul className="flex flex-col gap-1">
                            {row.news.slice(0, 2).map((article, index) => (
                              <li key={`${article.url}:${index}`}>
                                <a
                                  className="underline underline-offset-4"
                                  href={article.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`${article.source} · ${article.publishedAt.slice(0, 10)} ${clock(article.publishedAt)} New York`}
                                >
                                  {article.headline}
                                </a>
                              </li>
                            ))}
                            {row.news.length > 2 ? (
                              <li className="text-xs text-muted-foreground">
                                {row.news.length - 2} more
                              </li>
                            ) : null}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                    ) : null}
                    <TableCell className="whitespace-normal">
                      {row.status === "match" ? (
                        <span className="text-[var(--sage-hi)]">Matches</span>
                      ) : (
                        <span className="text-muted-foreground">
                          {row.failedConditions.length
                            ? `Missed ${row.failedConditions.join(", ")}`
                            : "No filters on"}
                        </span>
                      )}
                      {priceCandle && row.priceCandleEnd !== priceCandle ? (
                        <span className="block text-xs text-muted-foreground">
                          Price close {clock(row.priceCandleEnd)}
                        </span>
                      ) : null}
                      {row.ema && emaCandle && row.ema.candleEnd !== emaCandle ? (
                        <span className="block text-xs text-muted-foreground">
                          EMA candle {clock(row.ema.candleEnd)}
                        </span>
                      ) : null}
                      {row.ema && row.ema.seedStart !== emaSeed ? (
                        <span className="block text-xs text-muted-foreground">
                          EMA seeded from {row.ema.seedStart.slice(0, 10)}{" "}
                          {clock(row.ema.seedStart)}
                        </span>
                      ) : null}
                      {row.rsi && rsiCandle && row.rsi.candleEnd !== rsiCandle ? (
                        <span className="block text-xs text-muted-foreground">
                          RSI candle {clock(row.rsi.candleEnd)}
                        </span>
                      ) : null}
                      {row.rsi && row.rsi.seedStart !== rsiSeed ? (
                        <span className="block text-xs text-muted-foreground">
                          RSI seeded from {row.rsi.seedStart.slice(0, 10)}{" "}
                          {clock(row.rsi.seedStart)}
                        </span>
                      ) : null}
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        {priceCandle ? `Price close ${clock(priceCandle)} New York. ` : ""}
        {input.ema && emaCandle
          ? `EMA candle ${clock(emaCandle)}, source ${result.emaDataset}. `
          : ""}
        {input.ema && emaSeed
          ? `EMA seeded from ${emaSeed.slice(0, 10)} ${clock(emaSeed)}. `
          : ""}
        {input.rsi && rsiCandle
          ? `RSI candle ${clock(rsiCandle)}, source ${result.rsiDataset}. `
          : ""}
        {input.rsi && rsiSeed
          ? `RSI seeded from ${rsiSeed.slice(0, 10)} ${clock(rsiSeed)}. `
          : ""}
        Prices from {result.dataset} in USD, unadjusted. Displayed values are
        rounded; the comparisons use full precision.
      </p>
    </div>
  );
}
