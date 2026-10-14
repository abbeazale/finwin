# Screener market-data service

Status: implemented on branch `market-data-service`, 2026-10-12, running against a local Postgres on the Mac. Linux server, Tailscale Funnel and Vercel settings are not set up yet.

## Why

The screener read a fixed Databento sample (2026-08-03 to 2026-09-15) from `.local/`. The data stopped there and the deployed site had none. The user wants the screener on several devices, for personal use only, with data up to the last session, and does not want Neon's 0.5 GB free storage to limit history.

## Decisions

- **Source: Massive.** Unadjusted minute and daily aggregates from the free plan, the same key as the float data. Tested 2026-10-12: minute bars exist for 2024-10-14 and for 2026-10-09. History starts 2024-10-14 (two years). Databento is no longer used; `scripts/databento-probe.py` stays for reference.
- **Storage: Postgres on a machine the user controls**, through `market-data/`, a separate Bun service in this repository. Neon keeps only app data. Development uses Postgres.app on the Mac (`finwin_market`). Production uses the always-on Linux laptop.
- **Access: read-only HTTP API with a bearer token**, exposed through Tailscale Funnel. Postgres listens only on localhost. FinWin reads `MARKET_DATA_URL` and `MARKET_DATA_TOKEN`; both or neither.
- **No owner gate.** The user is the only account holder. Massive's free plan is for individual use; if other people get accounts, gate `/screener` first.
- **Daily ingest** after each session (weekdays 21:30 New York, systemd timer). It downloads again the last three stored sessions, so a session fetched before Massive finished it is replaced.
- **Raw archive.** Every Massive response is kept gzipped. It is the source for rebuilding the database and for the independent oracle.

## Data contract

- Prices: integer billionths of a USD. Massive prices have at most six decimals, so `round(price × 1e9)` is exact.
- Volume: integer millionths of a share. Massive reports fractional share volume (799 of 885 AAPL minutes on 2026-10-09 were fractional).
- Minute bars are stored with extended hours. The API returns regular-session minutes only.
- Daily bars are Massive's daily aggregates. Their close is the official close: on 2026-10-09 AAPL closed at 336.64, while the 15:59 minute closed at 336.63 and the 16:00 minute (closing cross) at 336.30. Daily volume (37.9M) is larger than the sum of minute volumes (32.7M), because some trade types are left out of minute bars.
- Float: change log of Massive's latest free float, as before. A value applies from the start of its effective date in New York.

## Calendar

`src/lib/market-calendar.ts` holds NYSE holidays and 13:00 early closes for 2024–2027, and converts New York wall-clock times with `Intl`, so winter time (−05:00) is correct. This replaces the fixed −04:00 offset, which was correct only for the old sample. Replay times run 09:31 to the session close; 13:01 on an early-close day is rejected. The ingest and the replay check both compare the calendar with the days SPY actually traded.

## Indicator windows

The earlier sample was small, so indicators were seeded from its first bar. With two years stored, that rule would make a value depend on how much history happens to be stored. Fixed windows replace it:

- Intraday indicators and relative volume use the replay session and the 60 sessions before it.
- Daily indicators and daily change use the 300 sessions before the replay session.

Screen and chart load the same window, so they agree. A 1h EMA 200 and a daily EMA 200 now finish warmup. An EMA seeded at the window start differs slightly from one seeded years earlier; the 5m EMA 200 effect is below 1e-9 of the price after 60 sessions, but long hourly and daily EMAs keep some seed effect.

## Changes to screener behavior

- Daily candles on the chart are Massive daily bars, the same source as daily screen values, so the old "SUMMARY and MINI can differ" note is gone.
- The session list comes from `/v1/coverage`. The page starts at 10:30 on the latest stored session.
- Volume is consolidated (all exchanges), no longer a single feed.
- If the server is off or unreachable, the screener shows "Market data unavailable". Other pages are not affected.

## Not covered

- Live intraday prices. Data reaches the previous close at most.
- More symbols. The service takes a symbol list, but the app still has five fixed symbols.
- Corporate actions. Prices stay unadjusted, so splits can distort daily change and long daily EMAs.
- Response size. A replay loads about 120,000 minute bars (about 9 MB of JSON, gzipped in transit). FinWin caches each session's bars for 10 minutes.
