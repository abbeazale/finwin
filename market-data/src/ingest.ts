import { parseArgs } from "node:util";
import {
  isSession,
  newYorkDate,
  sessionClose,
  sessionLength,
  sessionOpen,
  sessionsBefore,
  sessionsBetween,
} from "../../src/lib/market-calendar";
import { config } from "./config";
import { migrate, sql } from "./db";
import {
  aggregates,
  latestFloats,
  priceUnits,
  volumeUnits,
  type Aggregate,
  type FloatRow,
} from "./massive";

// Usage:
//   bun src/ingest.ts backfill --from 2024-10-14   first load
//   bun src/ingest.ts daily                         scheduled run
//   bun src/ingest.ts floats --import <snapshot>    load a saved float file
const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: { from: { type: "string" }, import: { type: "string" } },
});
const mode = positionals[0];

// Minute requests stay under Massive's 50,000-row page: 40 calendar days hold
// at most 29 sessions of about 960 extended-hours minutes.
const MINUTE_CHUNK_DAYS = 40;
// Daily runs fetch again the last sessions they already hold, so a session
// that was fetched before the provider finished it is replaced.
const REFETCH_SESSIONS = 3;
const BATCH = 5_000;

function addDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function bar(row: Aggregate) {
  const open = priceUnits(row.o);
  const high = priceUnits(row.h);
  const low = priceUnits(row.l);
  const close = priceUnits(row.c);
  if (low > open || low > close || high < open || high < close)
    throw new Error(`Inconsistent bar at ${row.t}.`);
  return { open, high, low, close, volume: volumeUnits(row.v) };
}

async function storeMinutes(symbol: string, rows: Aggregate[]) {
  const records = rows.map((row) => {
    if (row.t % 60_000 !== 0) throw new Error(`Unaligned minute ${row.t}.`);
    return { symbol, start_ms: BigInt(row.t), ...bar(row) };
  });
  for (let index = 0; index < records.length; index += BATCH)
    await sql`
      insert into minute_bars ${sql(records.slice(index, index + BATCH))}
      on conflict (symbol, start_ms) do update set
        open = excluded.open, high = excluded.high, low = excluded.low,
        close = excluded.close, volume = excluded.volume`;
  return records.length;
}

async function storeDaily(symbol: string, rows: Aggregate[]) {
  const records = rows.map((row) => {
    const session = newYorkDate(row.t);
    if (!isSession(session))
      throw new Error(`${symbol} daily bar on non-session ${session}.`);
    return { symbol, session, ...bar(row) };
  });
  if (records.length > 0)
    await sql`
      insert into daily_bars ${sql(records)}
      on conflict (symbol, session) do update set
        open = excluded.open, high = excluded.high, low = excluded.low,
        close = excluded.close, volume = excluded.volume`;
  return records.length;
}

async function fetchRange(symbol: string, from: string, to: string) {
  let minutes = 0;
  for (let start = from; start <= to; start = addDays(start, MINUTE_CHUNK_DAYS)) {
    const end = [addDays(start, MINUTE_CHUNK_DAYS - 1), to].sort()[0];
    minutes += await storeMinutes(
      symbol,
      await aggregates(symbol, "minute", start, end),
    );
  }
  const daily = await storeDaily(
    symbol,
    await aggregates(symbol, "day", from, to),
  );
  console.log(`${symbol}: ${minutes} minute bars, ${daily} daily bars, ${from} to ${to}.`);
}

// The last session whose regular close has passed in New York.
function lastClosedSession() {
  const today = newYorkDate(Date.now());
  if (isSession(today) && Date.now() >= sessionClose(today)) return today;
  return sessionsBefore(today, 1)[0];
}

async function latestStoredSession(symbol: string) {
  const [row] = await sql`
    select max(start_ms) as latest from minute_bars where symbol = ${symbol}`;
  return row?.latest ? newYorkDate(Number(row.latest)) : undefined;
}

async function backfill(from: string) {
  const to = lastClosedSession();
  for (const symbol of config.symbols()) await fetchRange(symbol, from, to);
}

async function daily() {
  const to = lastClosedSession();
  for (const symbol of config.symbols()) {
    const latest = await latestStoredSession(symbol);
    if (!latest)
      throw new Error(`${symbol} has no stored minutes. Run backfill first.`);
    const from = sessionsBefore(addDays(latest, 1), REFETCH_SESSIONS)[0];
    await fetchRange(symbol, from, to);
  }
  await floats();
  // Massive can publish a session hours after the close. The run fails so
  // systemd starts it again later (Restart= in the ingest unit).
  const missing: string[] = [];
  for (const symbol of config.symbols()) {
    const [row] = await sql`
      select 1 from daily_bars where symbol = ${symbol} and session = ${to}`;
    if (!row) missing.push(symbol);
  }
  if (missing.length)
    throw new Error(`Massive has not published ${to} for ${missing.join(", ")}.`);
}

// Adds only (ticker, effective date, float) combinations not seen before.
async function recordFloats(rows: FloatRow[], seenOn: string) {
  const records = rows
    .filter((row) => row.ticker && row.free_float && row.effective_date)
    .map((row) => ({
      ticker: row.ticker as string,
      effective_date: row.effective_date as string,
      free_float: BigInt(row.free_float as number),
      free_float_percent: row.free_float_percent ?? null,
      first_seen: seenOn,
    }));
  let added = 0;
  for (let index = 0; index < records.length; index += BATCH) {
    const inserted = await sql`
      insert into float_history ${sql(records.slice(index, index + BATCH))}
      on conflict do nothing
      returning ticker`;
    added += inserted.length;
  }
  return { rows: records.length, added };
}

async function floats() {
  const rows = await latestFloats();
  const result = await recordFloats(rows, newYorkDate(Date.now()));
  console.log(`Float: ${result.rows} rows read, ${result.added} new.`);
}

// Reads a saved snapshot ({ fetchedAt, rows }) or an archived float page
// (.json.gz). To rebuild the change log, import the pages oldest first.
async function importFloats(file: string) {
  const bytes = await Bun.file(file).bytes();
  const snapshot = JSON.parse(
    new TextDecoder().decode(file.endsWith(".gz") ? Bun.gunzipSync(bytes) : bytes),
  ) as {
    fetchedAt: string;
    rows?: FloatRow[];
    body?: { results?: FloatRow[] };
  };
  const result = await recordFloats(
    snapshot.rows ?? snapshot.body?.results ?? [],
    newYorkDate(Date.parse(snapshot.fetchedAt)),
  );
  console.log(`Imported ${file}: ${result.rows} rows, ${result.added} new.`);
}

// Reports sessions whose regular-hours minutes are incomplete, and checks the
// calendar against SPY's daily bars. Problems are logged; they do not stop
// the run, because the screener already excludes instruments with gaps.
async function verify() {
  const issues: string[] = [];
  for (const symbol of config.symbols()) {
    const [range] = await sql`
      select min(session) as first, max(session) as last
      from daily_bars where symbol = ${symbol}`;
    if (!range?.first) continue;
    const expected = sessionsBetween(range.first, range.last);
    const stored = new Set(
      (
        await sql`select session from daily_bars where symbol = ${symbol}`
      ).map((row: { session: string }) => row.session),
    );
    const missing = expected.filter((session) => !stored.has(session));
    if (missing.length)
      issues.push(`${symbol} daily bars missing: ${missing.join(", ")}`);
    const counts = await sql`
      select start_ms from minute_bars
      where symbol = ${symbol}
        and start_ms >= ${BigInt(sessionOpen(expected[0]))}
        and start_ms < ${BigInt(sessionClose(expected.at(-1) as string))}`;
    const perSession = new Map<string, number>();
    for (const row of counts as { start_ms: bigint }[]) {
      const start = Number(row.start_ms);
      const session = newYorkDate(start);
      if (
        isSession(session) &&
        start >= sessionOpen(session) &&
        start < sessionClose(session)
      )
        perSession.set(session, (perSession.get(session) ?? 0) + 1);
    }
    const short = expected.filter(
      (session) => (perSession.get(session) ?? 0) !== sessionLength(session),
    );
    if (short.length)
      issues.push(
        `${symbol} sessions with missing regular minutes: ${short
          .map((session) => `${session} (${perSession.get(session) ?? 0})`)
          .join(", ")}`,
      );
  }
  for (const issue of issues) console.warn(issue);
  return issues;
}

async function run(kind: string, task: () => Promise<void>) {
  await migrate();
  const [record] = await sql`
    insert into ingest_runs (kind) values (${kind}) returning id`;
  try {
    await task();
    const issues = await verify();
    await sql`
      update ingest_runs set finished_at = now(), status = 'ok',
        detail = ${JSON.stringify({ issues })}
      where id = ${record.id}`;
  } catch (error) {
    await sql`
      update ingest_runs set finished_at = now(), status = 'failed',
        detail = ${JSON.stringify({ error: String(error) })}
      where id = ${record.id}`;
    throw error;
  } finally {
    await sql.close();
  }
}

if (mode === "backfill") {
  const from = values.from;
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from))
    throw new Error("backfill needs --from YYYY-MM-DD.");
  await run("backfill", () => backfill(from));
} else if (mode === "daily") {
  await run("daily", daily);
} else if (mode === "floats") {
  const file = values.import;
  await run("floats", () => (file ? importFloats(file) : floats()));
} else if (mode === "verify") {
  await run("verify", async () => {});
} else {
  console.error("Usage: bun src/ingest.ts backfill --from YYYY-MM-DD | daily | floats [--import file] | verify");
  process.exit(2);
}
