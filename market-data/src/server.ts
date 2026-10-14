import { timingSafeEqual } from "node:crypto";
import {
  isSession,
  newYorkDate,
  sessionClose,
  sessionOpen,
  sessionsBetween,
} from "../../src/lib/market-calendar";
import { config } from "./config";
import { sql } from "./db";

// Read-only API for FinWin. Every route except /v1/health needs the bearer
// token. Postgres stays on localhost; Tailscale Funnel exposes only this port.
const token = Buffer.from(config.token());
const symbols = new Set(config.symbols());
const MAX_MINUTE_SESSIONS = 130;
const MAX_DAILY_SESSIONS = 600;

class RequestError extends Error {}

function authorized(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const given = Buffer.from(header.replace(/^Bearer /, ""));
  return given.length === token.length && timingSafeEqual(given, token);
}

function symbolList(url: URL) {
  const list = (url.searchParams.get("symbols") ?? "").split(",");
  if (list.length === 0 || list.some((symbol) => !symbols.has(symbol)))
    throw new RequestError("Unknown or missing symbols.");
  return list;
}

function sessionRange(url: URL, limit: number) {
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!isSession(from) || !isSession(to) || from > to)
    throw new RequestError("from and to must be trading sessions, from <= to.");
  const sessions = sessionsBetween(from, to);
  if (sessions.length > limit)
    throw new RequestError(`At most ${limit} sessions per request.`);
  return sessions;
}

const units = (value: bigint) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error("Unsafe integer.");
  return number;
};

// Regular-session minutes only: [start, open, high, low, close, volume].
async function minutes(url: URL) {
  const list = symbolList(url);
  const sessions = sessionRange(url, MAX_MINUTE_SESSIONS);
  const rows = await sql`
    select symbol, start_ms, open, high, low, close, volume from minute_bars
    where symbol in ${sql(list)}
      and start_ms >= ${BigInt(sessionOpen(sessions[0]))}
      and start_ms < ${BigInt(sessionClose(sessions.at(-1) as string))}
    order by symbol, start_ms`;
  const inSession = new Set(sessions);
  const result: Record<string, number[][]> = Object.fromEntries(
    list.map((symbol) => [symbol, []]),
  );
  for (const row of rows) {
    const start = Number(row.start_ms);
    const session = newYorkDate(start);
    if (
      !inSession.has(session) ||
      start < sessionOpen(session) ||
      start >= sessionClose(session)
    )
      continue;
    result[row.symbol].push([
      start,
      units(row.open),
      units(row.high),
      units(row.low),
      units(row.close),
      units(row.volume),
    ]);
  }
  return { from: sessions[0], to: sessions.at(-1), symbols: result };
}

// [session, open, high, low, close, volume] per symbol.
async function daily(url: URL) {
  const list = symbolList(url);
  const sessions = sessionRange(url, MAX_DAILY_SESSIONS);
  const rows = await sql`
    select symbol, session, open, high, low, close, volume from daily_bars
    where symbol in ${sql(list)}
      and session >= ${sessions[0]} and session <= ${sessions.at(-1)}
    order by symbol, session`;
  const result: Record<string, (string | number)[][]> = Object.fromEntries(
    list.map((symbol) => [symbol, []]),
  );
  for (const row of rows)
    result[row.symbol].push([
      row.session,
      units(row.open),
      units(row.high),
      units(row.low),
      units(row.close),
      units(row.volume),
    ]);
  return { from: sessions[0], to: sessions.at(-1), symbols: result };
}

async function floats(url: URL) {
  const list = symbolList(url);
  const rows = await sql`
    select ticker, effective_date, free_float, first_seen from float_history
    where ticker in ${sql(list)}
    order by ticker, effective_date, first_seen`;
  return {
    floats: rows.map(
      (row: {
        ticker: string;
        effective_date: string;
        free_float: bigint;
        first_seen: string;
      }) => ({
        symbol: row.ticker,
        shares: units(row.free_float),
        effectiveDate: row.effective_date,
        firstSeen: row.first_seen,
      }),
    ),
  };
}

// The sessions every configured symbol has, for both minute and daily bars.
async function coverage() {
  const minuteRows = await sql`
    select symbol, min(start_ms) as first, max(start_ms) as last
    from minute_bars group by symbol`;
  const dailyRows = await sql`
    select symbol, min(session) as first, max(session) as last
    from daily_bars group by symbol`;
  const [floatRow] = await sql`
    select count(*) as rows, max(first_seen) as last_seen from float_history`;
  const span = (rows: { symbol: string; first: string; last: string }[]) => {
    if (rows.length < symbols.size) return null;
    return {
      from: rows.map((row) => row.first).sort().at(-1),
      through: rows.map((row) => row.last).sort()[0],
    };
  };
  return {
    symbols: [...symbols],
    minutes: span(
      minuteRows.map(
        (row: { symbol: string; first: bigint; last: bigint }) => ({
          symbol: row.symbol,
          first: newYorkDate(Number(row.first)),
          last: newYorkDate(Number(row.last)),
        }),
      ),
    ),
    daily: span(dailyRows),
    floats: {
      rows: Number(floatRow?.rows ?? 0),
      lastSeen: floatRow?.last_seen ?? null,
    },
  };
}

const routes: Record<string, (url: URL) => Promise<unknown>> = {
  "/v1/coverage": coverage,
  "/v1/minutes": minutes,
  "/v1/daily": daily,
  "/v1/floats": floats,
};

function respond(request: Request, status: number, body: unknown) {
  const json = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if ((request.headers.get("accept-encoding") ?? "").includes("gzip")) {
    headers["Content-Encoding"] = "gzip";
    return new Response(Bun.gzipSync(json), { status, headers });
  }
  return new Response(json, { status, headers });
}

const server = Bun.serve({
  hostname: config.host(),
  port: config.port(),
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET")
      return respond(request, 405, { error: "Method not allowed." });
    if (url.pathname === "/v1/health") return respond(request, 200, { ok: true });
    const route = routes[url.pathname];
    if (!route) return respond(request, 404, { error: "Not found." });
    if (!authorized(request))
      return respond(request, 401, { error: "Unauthorized." });
    try {
      return respond(request, 200, await route(url));
    } catch (error) {
      if (error instanceof RequestError)
        return respond(request, 400, { error: error.message });
      console.error(error);
      return respond(request, 500, { error: "Internal error." });
    }
  },
});
console.log(`Market data API on http://${server.hostname}:${server.port}`);
