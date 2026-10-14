import { mkdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { config } from "./config";

const BASE = "https://api.massive.com";
// The free plan allows 5 requests per minute. 13 seconds keeps a margin.
const REQUEST_SPACING_MS = 13_000;
let nextRequestAt = 0;

async function request(url: string): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    const wait = nextRequestAt - Date.now();
    if (wait > 0) await Bun.sleep(wait);
    nextRequestAt = Date.now() + REQUEST_SPACING_MS;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.massiveApiKey()}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(60_000),
    });
    if (response.status === 429 && attempt < 4) {
      nextRequestAt = Date.now() + 60_000;
      continue;
    }
    if (!response.ok)
      throw new Error(`Massive returned HTTP ${response.status} for ${redact(url)}.`);
    return response.json();
  }
}

function redact(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.delete("apiKey");
  return parsed.toString();
}

// Raw responses are kept so the database can be rebuilt and so the offline
// oracle can check the app against provider data. Later files win.
async function archive(kind: string, name: string, url: string, body: unknown) {
  const directory = path.join(config.archiveDir(), kind);
  await mkdir(directory, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const file = path.join(
    directory,
    `${name}_${fetchedAt.replace(/[:.]/g, "-")}.json.gz`,
  );
  await Bun.write(
    file,
    Bun.gzipSync(JSON.stringify({ fetchedAt, url: redact(url), body })),
  );
}

const aggregateSchema = z.object({
  t: z.number().int(),
  o: z.number().positive(),
  h: z.number().positive(),
  l: z.number().positive(),
  c: z.number().positive(),
  v: z.number().nonnegative(),
});
const aggregatesSchema = z.object({
  status: z.enum(["OK", "DELAYED"]),
  results: z.array(aggregateSchema).optional(),
  next_url: z.string().optional(),
});
export type Aggregate = z.infer<typeof aggregateSchema>;

// Unadjusted aggregates for one symbol between two dates, inclusive.
export async function aggregates(
  symbol: string,
  span: "minute" | "day",
  from: string,
  to: string,
): Promise<Aggregate[]> {
  const rows: Aggregate[] = [];
  let url: string | undefined =
    `${BASE}/v2/aggs/ticker/${symbol}/range/1/${span}/${from}/${to}` +
    "?adjusted=false&sort=asc&limit=50000";
  let page = 0;
  while (url) {
    const body = await request(url);
    await archive(span, `${symbol}_${from}_${to}_${page}`, url, body);
    const parsed = aggregatesSchema.parse(body);
    rows.push(...(parsed.results ?? []));
    url = parsed.next_url;
    page++;
  }
  return rows;
}

// Some rows have no ticker; they are skipped, not treated as an error.
const floatRowSchema = z.object({
  ticker: z.string().min(1).optional().nullable(),
  free_float: z.number().int().positive().optional().nullable(),
  free_float_percent: z.number().optional().nullable(),
  effective_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
});
const floatPageSchema = z.object({
  status: z.enum(["OK", "DELAYED"]),
  results: z.array(floatRowSchema).optional(),
  next_url: z.string().optional(),
});
export type FloatRow = z.infer<typeof floatRowSchema>;

// Massive's experimental latest free-float list for every ticker. Only the
// latest value per ticker exists; history comes from the change log.
export async function latestFloats(): Promise<FloatRow[]> {
  const rows: FloatRow[] = [];
  let url: string | undefined =
    `${BASE}/stocks/vX/float?limit=5000&sort=ticker.asc`;
  while (url) {
    const parsed = floatPageSchema.parse(await request(url));
    rows.push(...(parsed.results ?? []));
    url = parsed.next_url;
  }
  return rows;
}

// Exact conversions. Massive prices have at most six decimals and volumes at
// most six, so rounding the scaled double gives the exact integer.
export function priceUnits(value: number): bigint {
  const scaled = Math.round(value * 1e9);
  if (!Number.isSafeInteger(scaled) || scaled <= 0)
    throw new Error(`Price ${value} is out of range.`);
  return BigInt(scaled);
}
export function volumeUnits(value: number): bigint {
  const scaled = Math.round(value * 1e6);
  if (!Number.isSafeInteger(scaled) || scaled < 0)
    throw new Error(`Volume ${value} is out of range.`);
  return BigInt(scaled);
}
