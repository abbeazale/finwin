import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  replaySymbols,
  type ReplayInput,
  type ReplaySymbol,
} from "@/lib/screener-replay";

const floatSnapshotSchema = z.object({
  symbol: z.enum(replaySymbols),
  shares: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  effectiveAt: z.iso.datetime(),
  publishedAt: z.iso.datetime(),
  source: z.string().trim().min(1).max(200),
});
const floatFileSchema = z.object({
  snapshots: z.array(floatSnapshotSchema).max(10_000),
});
type FloatSnapshot = z.infer<typeof floatSnapshotSchema>;
type NewsArticle = {
  headline: string;
  url: string;
  publishedAt: string;
  source: string;
};
type NewsCoverage =
  | {
      status: "available";
      from: number;
      through: number;
      articles: NewsArticle[];
    }
  | { status: "unavailable"; reason: string };
export type ReplayResearch = {
  floats: readonly FloatSnapshot[];
  news: ReadonlyMap<ReplaySymbol, NewsCoverage>;
};

// Optional, sourced historical records. Absence or malformed metadata must never
// break price-only screens or be interpreted as a zero float.
export async function loadReplayFloats(): Promise<FloatSnapshot[]> {
  try {
    const contents = await readFile(
      path.join(process.cwd(), ".local/databento-probe/float.json"),
      "utf8",
    );
    const parsed = floatFileSchema.safeParse(JSON.parse(contents));
    return parsed.success ? parsed.data.snapshots : [];
  } catch {
    return [];
  }
}

const articleSchema = z.object({
  datetime: z.number().int().positive(),
  headline: z.string().trim().min(1),
  url: z
    .url()
    .refine((value) => ["https:", "http:"].includes(new URL(value).protocol)),
  source: z.string().trim().min(1),
  related: z.string(),
});
const newsCache = new Map<
  string,
  { expires: number; promise: Promise<NewsCoverage> }
>();
const MAX_CACHE_ENTRIES = 100;

async function requestNews(
  symbol: ReplaySymbol,
  from: number,
  through: number,
  apiKey: string,
): Promise<NewsCoverage> {
  try {
    const query = new URLSearchParams({
      symbol,
      from: new Date(from).toISOString().slice(0, 10),
      to: new Date(through).toISOString().slice(0, 10),
    });
    const response = await fetch(
      `https://finnhub.io/api/v1/company-news?${query}`,
      {
        headers: { "X-Finnhub-Token": apiKey },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok)
      return {
        status: "unavailable",
        reason:
          "Finnhub historical news could not be retrieved. Retry later or disable the news filter.",
      };
    const parsed = z.array(articleSchema).safeParse(await response.json());
    if (!parsed.success)
      return {
        status: "unavailable",
        reason: "Finnhub returned incomplete news records.",
      };
    // Finnhub's historical archive can be corrected later; this is a publication-
    // time replay, not proof of what the vendor had delivered at that instant.
    const articles = parsed.data
      .filter((article) =>
        article.related
          .split(",")
          .map((value) => value.trim())
          .includes(symbol),
      )
      .map((article) => ({
        headline: article.headline,
        url: article.url,
        source: article.source,
        publishedAt: new Date(article.datetime * 1000).toISOString(),
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    return { status: "available", from, through, articles };
  } catch {
    return {
      status: "unavailable",
      reason:
        "Finnhub historical news is unavailable. Retry later or disable the news filter.",
    };
  }
}

export async function loadReplayNews(
  input: ReplayInput,
  apiKey: string | undefined,
): Promise<ReadonlyMap<ReplaySymbol, NewsCoverage>> {
  if (!input.news) return new Map();
  const through = Date.parse(`${input.session}T${input.time}:00-04:00`);
  const from = through - input.news.hours * 3_600_000;
  if (!apiKey)
    return new Map(
      replaySymbols.map((symbol) => [
        symbol,
        {
          status: "unavailable" as const,
          reason: "Historical news requires a configured Finnhub connection.",
        },
      ]),
    );
  return new Map(
    await Promise.all(
      replaySymbols.map(async (symbol) => {
        // Cache whole UTC dates so advancing one minute reuses the same response.
        const dayFrom = Date.parse(new Date(from).toISOString().slice(0, 10));
        const dayThrough =
          Date.parse(new Date(through).toISOString().slice(0, 10)) +
          86_400_000 -
          1;
        const key = `${symbol}:${dayFrom}:${dayThrough}`;
        let entry = newsCache.get(key);
        if (!entry || entry.expires <= Date.now()) {
          if (newsCache.size >= MAX_CACHE_ENTRIES) newsCache.clear();
          const promise = requestNews(symbol, dayFrom, dayThrough, apiKey);
          entry = { expires: Date.now() + 5 * 60_000, promise };
          newsCache.set(key, entry);
          void promise.then((value) => {
            if (
              value.status === "unavailable" &&
              newsCache.get(key)?.promise === promise
            )
              newsCache.delete(key);
          });
        }
        return [symbol, await entry.promise] as const;
      }),
    ),
  );
}
