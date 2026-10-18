# Screener replay calculation contract

Implemented 2026-09-16; moving average changed from SMA to EMA on 2026-10-04; data source changed from the Databento sample to the Massive market-data service on 2026-10-12 ([service spec](market-data-service.md)). Historical replay supports optional price/EMA, RSI, same-time relative volume and the other filters in the screener design. This is not the complete screener or a live-data contract.

## Inputs and access

- `/screener` and `screener.replay` are available to signed-in FinWin accounts. The user explicitly removed the owner allowlist requirement. No bank connection is required. Market data needs `MARKET_DATA_URL` and `MARKET_DATA_TOKEN`.
- Fixed universe: AAPL, MSFT, NVDA, SPY, IWM. Bars come from the market-data API, which stores Massive downloads from 2024-10-14 onward. A session outside the stored range is rejected with the available range.
- Prices, intraday indicators and relative volume use Massive minute bars, regular session only. Daily EMA/RSI and daily change use Massive daily bars, whose close is the official close. The table labels the sources separately.
- All prices are raw, unadjusted USD values. There is no corporate-action normalization. Volume is consolidated and fractional, stored in millionths of a share. Massive data can contain later corrections; it does not prove point-in-time publication.
- FinWin caches each session's bars for 10 minutes. An unreachable or misconfigured server returns "unavailable", never an empty successful screen.

## Time and calendar

- Sessions follow `src/lib/market-calendar.ts`: NYSE holidays and 13:00 early closes for 2024–2027, from the [NYSE calendars](https://www.nyse.com/trade/hours-calendars). The checks compare it with the days SPY traded.
- Replay times are New York time, 09:31 through the session close at whole-minute precision, converted with the correct offset for winter and summer time. At 10:30 the 10:29 minute candle is available; the 10:30 candle is not. The comparison price is the latest completed one-minute close, not a quote or intra-minute trade.
- Five-minute candles align to 09:30. At 10:34 the latest completed candle ends at 10:30; at 10:35 it ends at 10:35. Require every constituent minute. Overnight time is excluded; early-session indicators can use preceding sessions. The last bucket of an early-close session ends at 13:00.
- Intraday indicators and relative volume use the replay session and the 60 sessions before it. Daily indicators use the 300 sessions before it. Indicators seed at the start of their window, so a value does not depend on how much history is stored.
- Daily indicators always stop at the preceding session, including at the close. Daily bars are end-of-day data, so today's bar is never used merely because the clock reaches the close.
- Results show applied time and each indicator's candle end. Editing controls does not change results until Run screen. +1 minute advances the last applied setup and resets controls to it. No automatic live refresh.

## Conditions and EMA

- Every condition, including price/EMA, is optional. Every enabled condition must pass; disabled conditions do not require their history. Exclusions take precedence over an ordinary nonmatch when an enabled condition cannot be evaluated.
- EMA intervals: one minute, five minutes and daily. Integer periods 1–200, presets 9/20/200. Strict above/below against the unrounded EMA; equality matches neither.
- EMA uses alpha = 2/(N+1). It is seeded at the mean of the first N consecutive completed closes, computed relative to the first close so a constant price gives exactly that price; then `ema = ema + alpha * (close - ema)`. Period 1 is the close. A missing expected candle resets the seed, and N new closes are needed after it. A missing latest candle or a run shorter than N excludes the instrument. The table shows the EMA candle end and seed-start candle.
- Store prices as integer billionths of a dollar. Convert to double precision for the EMA and compare the converted latest price with the unrounded EMA. Display rounding does not change membership. `src/server/screener/indicators.ts` holds the shared EMA/RSI calculation used by the screen and the chart.
- Changing SMA to EMA changed membership in 374 of 5,400 sampled cases (10 sessions, 6 times, 3 intervals, periods 9/20/200, both directions), split evenly between match and no-match. No case changed to or from excluded.

## RSI

- RSI chooses its own one-minute, five-minute or daily interval, independently of EMA. Period defaults to 14; supported integer range is 2–200. Threshold is 0–100 with strict above/below comparison.
- Use Wilder smoothing. Seed average gain and average loss with the arithmetic means of the first N changes from N+1 consecutive closes. Each later average is `(previous * (N - 1) + current) / N`. RSI is `100 * averageGain / (averageGain + averageLoss)`.
- Gain-only runs produce 100, loss-only runs 0. Completely flat runs produce 50, an explicit FinWin convention. This flat convention and gap behavior should not be assumed identical to every library. [TA-Lib RSI source](https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_RSI.c) is a reference for the Wilder recurrence, not an assertion of complete output compatibility.
- Compute through the entire contiguous run available since the window begins. A missing expected candle breaks that run and resets the seed. Require N+1 new consecutive closes after it; never compute a price change across the gap. The table shows the seed-start candle timestamp so this reset is visible.
- RSI uses double-precision arithmetic without display rounding before comparison. The independent Decimal oracle is required to agree within 1e-9 on sampled real values. A different history start, feed, adjustment policy or initialization can produce a different RSI.

## Same-time relative volume

- Accumulate minute volume from 09:30 through the last completed minute today. Divide by mean accumulated minute volume through the same elapsed session minute across exactly 20 preceding trading sessions.
- Never use daily-bar volume in this denominator. All 20 baseline sessions must exist, with every required minute through the comparison time. Today's prefix must also be complete. Missing a minute excludes the symbol; later gaps beyond the comparison time do not matter.
- A zero baseline excludes the symbol. Zero current volume with a positive baseline produces zero. Insufficient prior sessions excludes it. If one of the 20 baseline sessions closed at 13:00 and the comparison time is later, that session has no minutes there and the symbol is excluded.
- Minimum threshold is inclusive, from 0 to 1000 with at most three decimal places. Compare `current * 20 * 1000` with `sumOfBaselineVolumes * minimumInThousandths` using BigInt. The table shows ratio, current volume and baseline average. Display rounding cannot affect membership.

## Verification and remaining scope

Run `bun scripts/check-screener-replay.ts`. It starts a private market-data server and compares the app with `scripts/screener-indicator-oracle.py`, which reads the raw Massive archive with Python Decimal, takes sessions from SPY's daily bars and keeps its own early-close list. On 2026-10-12 it passed 360 EMA values (periods 1/9/20/200, 1m/5m/daily) and 90 cases of daily EMA 200, Wilder RSI, relative volume and daily change, at six moments: a recent session, winter time, the first day of summer time, an early close, the day after a holiday and 2026-09-15. It also checks API authentication, the calendar against SPY, future-data independence, interval boundaries, the 13:00 close, equality, zero-volume baselines, input validation and tRPC access.

The ingest's own check found no missing regular-session minutes or daily bars for the five symbols from 2024-10-14 to 2026-10-12. In the raw data, the only five days with almost no SPY volume after 13:00 are the five early closes in the calendar.

`bun test scripts/screener-page.test.ts` (local, uncommitted) renders the page against the local server. Chart behavior is covered by `bun scripts/check-screener-chart.ts`: 55,830 candles against an independent aggregation of the raw archive, 8,896 EMA points and 60 chart/screen agreements.
