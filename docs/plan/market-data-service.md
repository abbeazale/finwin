# Market-data service plan

Spec: [market-data-service](../spec/market-data-service.md).

## Done on the Mac, 2026-10-12

1. `src/lib/market-calendar.ts`: NYSE sessions 2024–2027, early closes, New York time with daylight saving.
2. `market-data/`: schema, Massive client with 13-second spacing and raw archive, ingest (`backfill`, `daily`, `floats`, `verify`), read-only API with bearer token, systemd units in `deploy/`.
3. Two-year backfill of AAPL, MSFT, NVDA, SPY and IWM into `finwin_market`; the Oct 6 float snapshot imported as the first change-log entries.
4. FinWin reads the API (`src/server/screener/market-data.ts`) instead of `.local/databento-probe/`. Replay and chart use fixed 60-session intraday and 300-session daily windows. Daily candles come from daily bars. `cache.ts` and the old fixed calendar are removed. `scripts/fetch-massive-floats.py` is replaced by `ingest.ts floats`.
5. Checks: `scripts/screener-indicator-oracle.py` reads the raw Massive archive with Python Decimal and takes sessions from SPY's daily bars; `check-screener-replay.ts` and `check-screener-chart.ts` start a private API server and compare against it.

## Done on the Linux laptop, 2026-10-13

1. Postgres 18.6 (localhost only) and one system Bun at `/usr/local/bin/bun`. Old mise versions pruned, Bun removed from mise.
2. `/opt/finwin` takes pushes to `deploy`; `market-data/deploy/deploy.sh` deploys the committed HEAD from the Mac.
3. Database restored from the Mac dump (row counts match) and the raw archive copied (checksums match). One ingest run added 2026-10-13.
4. Units installed; the API runs the schema before it starts. Lid close ignored on AC and battery. Narrow sudoers rule for restart and ingest; the temporary full sudo rule is removed.
5. Tailscale Funnel on. `/v1/health` returns 200 from outside the tailnet through both relay addresses; `/v1/coverage` returns 401 without a valid token.
6. `MARKET_DATA_URL` and `MARKET_DATA_TOKEN` set in Vercel for Production. PR #34 opened against `main`.

## Next

1. Merge PR #34. Vercel deploys production from `main`. Open `/screener` on the phone.
2. After a week, read `ingest_runs` to confirm one successful run per session.
3. Reboot without the laptop: not set up. TPM2 unlock is deferred (see the README). If reboots become a problem, prefer remote unlock over Tailscale in the initramfs.

## Later

- More symbols: a validated instrument list in the app, and a backfill that resumes per symbol.
- Smaller replay responses if loading feels slow on mobile, for example per-symbol requests or delta encoding.
