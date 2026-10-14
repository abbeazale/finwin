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
3. Database restored from the Mac dump (row counts match) and the raw archive copied (checksums match).
4. Units installed; the API runs the schema before it starts. Lid close ignored on AC and battery. Narrow sudoers rule for restart and ingest.

## Next

1. Turn on Funnel in the tailnet (admin console), then `sudo tailscale funnel --bg 8787` on the laptop. Check `/v1/health` from outside the tailnet.
2. Set `MARKET_DATA_URL` and `MARKET_DATA_TOKEN` in Vercel (production) and redeploy. Open `/screener` on the phone.
3. Remove `/etc/sudoers.d/90-setup-temp` on the laptop.
4. After a week, read `ingest_runs` to confirm one successful run per session.
5. At the laptop: TPM2 unlock for the LUKS disk, so a reboot does not need the passphrase.

## Later

- More symbols: a validated instrument list in the app, and a backfill that resumes per symbol.
- Smaller replay responses if loading feels slow on mobile, for example per-symbol requests or delta encoding.
