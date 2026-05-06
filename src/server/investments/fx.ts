import { eq } from "drizzle-orm";
import { z } from "zod";
import { currencyRates } from "@/db/schema";
import { db } from "@/index";
import type { FxRateLookup } from "./values";

const OER_LATEST_URL = "https://openexchangerates.org/api/latest.json";
const USD = "USD";
const STALE_AFTER_DAYS = 7;

const oerLatestSchema = z.object({
  timestamp: z.number().optional(),
  base: z.string().default(USD),
  rates: z.record(z.string(), z.number()),
});

export async function refreshOpenExchangeRates() {
  const appId = process.env.OER_KEY;
  if (!appId) {
    return { refreshed: false, reason: "missing_key" as const, rateCount: 0 };
  }

  const response = await fetch(`${OER_LATEST_URL}?app_id=${encodeURIComponent(appId)}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    return { refreshed: false, reason: "provider_error" as const, rateCount: 0 };
  }

  const payload = oerLatestSchema.parse(await response.json());
  const fetchedAt = payload.timestamp ? new Date(payload.timestamp * 1000) : new Date();
  const now = new Date();
  const entries = Object.entries(payload.rates);

  for (const [quoteCurrency, rate] of entries) {
    await db
      .insert(currencyRates)
      .values({
        baseCurrency: USD,
        quoteCurrency,
        rate: rate.toFixed(8),
        fetchedAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [currencyRates.baseCurrency, currencyRates.quoteCurrency],
        set: {
          rate: rate.toFixed(8),
          fetchedAt,
          updatedAt: now,
        },
      });
  }

  return { refreshed: true, reason: null, rateCount: entries.length };
}

export async function getUsdFxRates(): Promise<FxRateLookup> {
  const rows = await db
    .select({
      quoteCurrency: currencyRates.quoteCurrency,
      rate: currencyRates.rate,
      fetchedAt: currencyRates.fetchedAt,
    })
    .from(currencyRates)
    .where(eq(currencyRates.baseCurrency, USD));

  const map: FxRateLookup = new Map([
    [USD, { rate: 1, fetchedAt: new Date(), isStale: false }],
  ]);

  for (const row of rows) {
    map.set(row.quoteCurrency, {
      rate: Number(row.rate),
      fetchedAt: row.fetchedAt,
      isStale: isFxRateStale(row.fetchedAt),
    });
  }

  return map;
}

export function isFxRateStale(fetchedAt: Date) {
  const ageMs = Date.now() - fetchedAt.getTime();
  return ageMs > STALE_AFTER_DAYS * 86_400_000;
}
