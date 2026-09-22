/** Bounded, read-only FMP access check. No response bodies or keys are logged. */
import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local", quiet: true });
config({ quiet: true });
const key = process.env.FMP_API_KEY?.trim();
if (!key) {
  console.log("FMP_API_KEY is not configured. Add it to .env.local, then rerun this check.");
  process.exit(1);
}
const recordSchema = z.record(z.string(), z.unknown());
const checks = [
  ["Current share float", "/stable/shares-float", { symbol: "AAPL" }],
  ["All shares float (full-market scan)", "/stable/shares-float-all", { page: "0", limit: "1000" }],
  ["Historical stock news", "/stable/news/stock", { symbols: "AAPL", from: "2026-09-14", to: "2026-09-15", limit: "5" }],
  ["Stock split history", "/stable/splits", { symbol: "AAPL", from: "2026-08-01", to: "2026-09-15" }],
] as const;
for (const [name, endpoint, parameters] of checks) {
  const url = new URL(endpoint, "https://financialmodelingprep.com");
  for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, value);
  url.searchParams.set("apikey", key);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) { console.log(JSON.stringify({ name, status: response.status, available: false })); continue; }
    const data = z.array(recordSchema).safeParse(await response.json());
    console.log(JSON.stringify({
      name, status: response.status, available: data.success,
      rows: data.success ? data.data.length : null,
      fields: data.success && data.data.length ? Object.keys(data.data[0]) : [],
      dates: data.success ? data.data.slice(0, 3).map(row => {
        const date = row.date ?? row.publishedDate;
        return typeof date === "string" && /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?$/.test(date) ? date : null;
      }) : [],
    }));
  } catch {
    console.log(JSON.stringify({ name, available: false, reason: "Request or response parsing failed" }));
  }
}
