import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  replaySessions,
  replaySymbols,
  type ReplaySymbol,
} from "@/lib/screener-replay";
import type { ReplayBars } from "./replay";
import type { Bar } from "./candles";
import { dailySessions } from "./calendar";

const manifestSchema = z.object({
  downloads: z.object({
    "mini-minute": z.object({
      request: z.object({
        dataset: z.literal("EQUS.MINI"),
        schema: z.literal("ohlcv-1m"),
        symbols: z.literal("AAPL,MSFT,NVDA,SPY,IWM"),
        start: z.literal("2026-08-03"),
        end: z.literal("2026-09-16"),
      }),
      records: z.literal(68929),
      bytes: z.literal(15612376),
      sha256: z.literal(
        "47a68bc9cf8a05e8215ae93eaa0f467c7ceb1bf50ad2feca1e160963d4d03b69",
      ),
    }),
  }),
});
const dailyManifestSchema = z.object({
  downloads: z.object({
    "summary-daily": z.object({
      request: z.object({
        dataset: z.literal("EQUS.SUMMARY"),
        schema: z.literal("ohlcv-1d"),
        symbols: z.literal("AAPL,MSFT,NVDA,SPY,IWM"),
        start: z.literal("2025-08-01"),
        end: z.literal("2026-09-16"),
      }),
      records: z.literal(1410),
      bytes: z.literal(325739),
      sha256: z.literal(
        "b8ec64543c9327ec2192c3a394bccc514d9c40f6cd37e0a25b81ea1110655177",
      ),
    }),
  }),
});
const priceSchema = z
  .string()
  .regex(/^\d+\.\d{9}$/)
  .transform((value) => BigInt(value.replace(".", "")))
  .refine((value) => value > BigInt(0));
const candleSchema = z
  .object({
    hd: z.object({
      ts_event: z
        .string()
        .regex(/^202[56]-\d{2}-\d{2}T\d{2}:\d{2}:00\.000000000Z$/),
    }),
    symbol: z.enum(replaySymbols),
    open: priceSchema,
    high: priceSchema,
    low: priceSchema,
    close: priceSchema,
    volume: z
      .string()
      .regex(/^\d+$/)
      .transform((value) => BigInt(value)),
  })
  .refine(
    (bar) =>
      bar.low <= bar.open &&
      bar.low <= bar.close &&
      bar.high >= bar.open &&
      bar.high >= bar.close,
  );

const cached = new Map<boolean, Promise<ReplayBars>>();
export function loadReplayBars(includeDaily = true): Promise<ReplayBars> {
  const existing = cached.get(includeDaily);
  if (existing) return existing;
  const pending = readCache(includeDaily).catch((error: unknown) => {
    cached.delete(includeDaily);
    throw error;
  });
  cached.set(includeDaily, pending);
  return pending;
}

async function readCache(includeDaily: boolean): Promise<ReplayBars> {
  const directory = path.join(process.cwd(), ".local/databento-probe");
  const rawManifest: unknown = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  const manifest = manifestSchema.parse(rawManifest);
  const dailyManifest = includeDaily
    ? dailyManifestSchema.parse(rawManifest)
    : undefined;
  const [minuteLines, dailyLines] = await Promise.all([
    readVerifiedFile(
      directory,
      "mini-minute",
      manifest.downloads["mini-minute"],
    ),
    dailyManifest
      ? readVerifiedFile(
          directory,
          "summary-daily",
          dailyManifest.downloads["summary-daily"],
        )
      : Promise.resolve([]),
  ]);
  const minutes = new Map<ReplaySymbol, Map<number, Bar>>(
    replaySymbols.map((symbol) => [symbol, new Map()]),
  );
  const daily = new Map<ReplaySymbol, Map<string, bigint>>(
    replaySymbols.map((symbol) => [symbol, new Map()]),
  );
  const seen = new Set<string>();
  for (const line of minuteLines) {
    const bar = candleSchema.parse(JSON.parse(line));
    const start = Date.parse(bar.hd.ts_event);
    if (
      !Number.isFinite(start) ||
      start < Date.parse("2026-08-03T00:00Z") ||
      start >= Date.parse("2026-09-16T00:00Z")
    )
      throw new Error("Replay timestamp outside sample.");
    const key = `${bar.symbol}:${start}`;
    if (seen.has(key)) throw new Error("Duplicate replay candle.");
    seen.add(key);
    const date = new Date(start).toISOString().slice(0, 10);
    const open = Date.parse(`${date}T09:30:00-04:00`);
    if (
      replaySessions.includes(date) &&
      start >= open &&
      start < open + 390 * 60_000
    )
      minutes.get(bar.symbol)?.set(start, {
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      });
  }
  const dates = new Set(dailySessions.map((session) => session.date));
  for (const line of dailyLines) {
    const bar = candleSchema.parse(JSON.parse(line));
    const date = bar.hd.ts_event.slice(0, 10);
    if (!dates.has(date) || bar.hd.ts_event.slice(11) !== "00:00:00.000000000Z")
      throw new Error("Daily candle outside expected calendar.");
    if (daily.get(bar.symbol)?.has(date))
      throw new Error("Duplicate daily candle.");
    daily.get(bar.symbol)?.set(date, bar.close);
  }
  for (const symbol of replaySymbols)
    if (
      !minutes.get(symbol)?.size ||
      (includeDaily && !daily.get(symbol)?.size)
    )
      throw new Error("Missing replay symbol.");
  return { minutes, daily };
}

async function readVerifiedFile(
  directory: string,
  name: string,
  entry: { bytes: number; records: number; sha256: string },
) {
  const file = path.join(directory, `${name}.jsonl`);
  if ((await stat(file)).size !== entry.bytes)
    throw new Error("Replay cache size mismatch.");
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error("Replay cache checksum mismatch.");
  const lines = bytes.toString("utf8").trim().split("\n");
  if (lines.length !== entry.records)
    throw new Error("Replay cache record count mismatch.");
  return lines;
}
