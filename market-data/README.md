# FinWin market-data service

A small Bun service that downloads Massive price and float data into Postgres and
serves it to FinWin's screener through a read-only API. It runs on a machine you
control, so stored history is not limited by Neon's free storage. FinWin calls it
over HTTPS with a bearer token. Postgres never accepts connections from outside
the machine.

```
Massive ──(daily ingest)──▶ Postgres ◀── API (127.0.0.1:8787) ◀── Tailscale Funnel ◀── FinWin
```

## What it stores

| Table | Content |
|---|---|
| `minute_bars` | Unadjusted one-minute bars, extended hours included. Prices in billionths of a USD, volume in millionths of a share. |
| `daily_bars` | Unadjusted daily bars with the official close. |
| `float_history` | Change log of Massive free float. A row is added only when a (ticker, effective date, float) combination is new. |
| `ingest_runs` | One row per ingest run, with its status and any data issues. |

Raw Massive responses are also kept, gzipped, in `MARKET_DATA_ARCHIVE`. They let
you rebuild the database, and `scripts/screener-indicator-oracle.py` checks the
app against them.

The symbol list is `MARKET_DATA_SYMBOLS` (default `AAPL,MSFT,NVDA,SPY,IWM`).
Massive's free plan allows 5 requests per minute, so the ingest waits 13 seconds
between requests. The first two-year download takes about 4 minutes per symbol.

## Commands

Run from the repository root, so Bun loads the root `.env`:

```sh
bun market-data/src/migrate.ts                       # create tables
bun market-data/src/ingest.ts backfill --from 2024-10-14
bun market-data/src/ingest.ts daily                  # new bars + floats
bun market-data/src/ingest.ts floats                 # floats only
bun market-data/src/ingest.ts floats --import .local/float-snapshots/massive-2026-10-06.json
bun market-data/src/ingest.ts verify                 # report data gaps
bun market-data/src/server.ts                        # API on 127.0.0.1:8787
```

`daily` downloads the last three stored sessions again, so a session fetched
before Massive finished it is replaced. Gaps are reported in the log and in
`ingest_runs`; they do not stop the run, because the screener already excludes
an instrument that has a missing candle.

## API

Every route except `/v1/health` needs `Authorization: Bearer <MARKET_DATA_TOKEN>`.
Responses are gzipped when the client accepts it.

| Route | Returns |
|---|---|
| `GET /v1/health` | `{ ok: true }` |
| `GET /v1/coverage` | Sessions every symbol has, for minutes and daily bars, and the float row count |
| `GET /v1/minutes?symbols=AAPL,SPY&from=2026-07-01&to=2026-10-09` | Regular-session minutes, `[start, open, high, low, close, volume]`, at most 130 sessions |
| `GET /v1/daily?symbols=…&from=…&to=…` | `[session, open, high, low, close, volume]`, at most 600 sessions |
| `GET /v1/floats?symbols=…` | Float change log for the symbols |

## Local development on a Mac

```sh
createdb finwin_market                      # Postgres.app
bun market-data/src/migrate.ts
bun market-data/src/ingest.ts backfill --from 2024-10-14
MARKET_DATA_TOKEN=$(openssl rand -hex 32) bun market-data/src/server.ts
```

Then set `MARKET_DATA_URL=http://127.0.0.1:8787` and the same `MARKET_DATA_TOKEN`
in FinWin's `.env`. The screener checks start their own server on a private port.

## Linux server setup

Not done yet. Steps for the always-on Linux laptop:

1. Install Postgres, Bun and Tailscale. Keep Postgres on localhost.
2. Clone the repository to `/opt/finwin`, run `bun install` in `market-data/`.
3. Create the database and a `finwin` system user. Copy
   `deploy/finwin-market-data.env.example` to `/etc/finwin-market-data.env`
   (mode 600) and fill it in.
4. Run `migrate`, then `backfill`, or restore a dump of the Mac database
   (`pg_dump finwin_market | psql …`) and copy the raw archive.
5. Install the units in `deploy/`: the API service and the weekday 21:30 New York
   ingest timer. `journalctl -u finwin-market-data-ingest` shows each run.
6. Stop the laptop from sleeping on lid close: `HandleLidSwitch=ignore` in
   `/etc/systemd/logind.conf`. Turn on "restore on AC power" in the firmware if it
   has one.
7. Expose the API: `tailscale funnel --bg 8787`. Put the resulting
   `https://<machine>.<tailnet>.ts.net` URL and the token in Vercel as
   `MARKET_DATA_URL` and `MARKET_DATA_TOKEN`.

While the server is off or offline, the screener shows "Market data unavailable".
The rest of FinWin keeps working.
