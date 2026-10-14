# Market-data service plan

Spec: [market-data-service](../spec/market-data-service.md).

## Done on the Mac, 2026-10-12

1. `src/lib/market-calendar.ts`: NYSE sessions 2024–2027, early closes, New York time with daylight saving.
2. `market-data/`: schema, Massive client with 13-second spacing and raw archive, ingest (`backfill`, `daily`, `floats`, `verify`), read-only API with bearer token, systemd units in `deploy/`.
3. Two-year backfill of AAPL, MSFT, NVDA, SPY and IWM into `finwin_market`; the Oct 6 float snapshot imported as the first change-log entries.
4. FinWin reads the API (`src/server/screener/market-data.ts`) instead of `.local/databento-probe/`. Replay and chart use fixed 60-session intraday and 300-session daily windows. Daily candles come from daily bars. `cache.ts` and the old fixed calendar are removed. `scripts/fetch-massive-floats.py` is replaced by `ingest.ts floats`.
5. Checks: `scripts/screener-indicator-oracle.py` reads the raw Massive archive with Python Decimal and takes sessions from SPY's daily bars; `check-screener-replay.ts` and `check-screener-chart.ts` start a private API server and compare against it.

## Next, on the Linux laptop

1. Install Postgres, Bun, Tailscale. Clone to `/opt/finwin`.
2. Move the data: `pg_dump finwin_market` from the Mac and the raw archive, or run `backfill` again (about 20 minutes).
3. Install `deploy/` units and `/etc/finwin-market-data.env`. Turn off lid-close sleep.
4. `tailscale funnel --bg 8787`. Check `/v1/health` from outside the tailnet.
5. Set `MARKET_DATA_URL` and `MARKET_DATA_TOKEN` in Vercel (production) and redeploy. Open `/screener` on the phone.
6. After a week, read `ingest_runs` to confirm one successful run per session.

## Later

- More symbols: a validated instrument list in the app, and a backfill that resumes per symbol.
- Smaller replay responses if loading feels slow on mobile, for example per-symbol requests or delta encoding.
