# Screener replay calculation contract

Implemented 2026-09-16. Historical replay supports price/SMA, optional RSI and optional same-time relative volume. This is not the complete screener or a live-data contract.

## Inputs and access

- `/screener` and `screener.replay` are available to signed-in FinWin accounts. The user explicitly removed the owner allowlist requirement. No bank connection or new environment variable is required.
- Fixed universe: AAPL, MSFT, NVDA, SPY, IWM. Read only existing `.local/databento-probe/` downloads. Require recorded requests, byte/record counts and pinned SHA256 before parsing. No network fetches, subscriptions or database writes.
- Prices and relative volume use Databento EQUS.MINI minute bars. Daily SMA/RSI use EQUS.SUMMARY daily bars. The table labels the sources separately. Daily cache is loaded only when a selected condition requires it; intraday-only screens still work without the daily file.
- All prices are raw, unadjusted USD values. There is no corporate-action normalization. MINI volume is feed-specific, not consolidated US volume. Historical archives can contain later corrections; the sample does not prove point-in-time publication or revision history.
- Files stay outside public assets and git. The process caches validated data in memory; restart after restoring/replacing files. A missing or invalid required file returns unavailable, never an empty successful screen.

## Time and calendar

- Selectable replay sessions: August 3 through September 15, 2026. Exclude weekends and Labor Day, September 7. There are no shortened sessions in this intraday sample.
- Daily history spans August 1, 2025 through September 15, 2026. The bounded calendar excludes exchange holidays, includes the November 28 and December 24, 2025 early closes, and uses the appropriate Eastern offset across the November 2025 and March 2026 DST changes. It must not be extended outside this interval without updating its calendar.
- Calendar references: [NYSE 2025 calendar](https://www.nyse.com/publicdocs/ICE_NYSE_2025_Yearly_Trading_Calendar.pdf), [NYSE 2026 calendar](https://www.nyse.com/publicdocs/nyse/ICE_NYSE_2026_Yearly_Trading_Calendar.pdf), [NYSE early-close hours](https://www.nyse.com/trade/hours-calendars).
- Replay times are New York time, 09:31 through 16:00 at whole-minute precision. All selectable replay dates are EDT. At 10:30 the 10:29 minute candle is available; the 10:30 candle is not. The comparison price is the latest completed one-minute close, not a quote or intra-minute trade.
- Five-minute candles align to 09:30. At 10:34 the latest completed candle ends at 10:30; at 10:35 it ends at 10:35. Require every constituent minute. Overnight time is excluded; early-session indicators can use preceding sessions.
- Daily indicators always stop at the preceding session, including at replay time 16:00. SUMMARY publication latency is unproven, so today's finalized daily bar is never introduced merely because the clock reaches the close.
- Results show applied time and each indicator's candle end. Editing controls does not change results until Run screen. Advance result 1 minute advances the last applied setup and resets controls to it. No automatic live refresh or closed-session replay.

## Conditions and SMA

- Price/SMA is required in this slice. RSI and relative volume are optional. Every enabled condition must pass; disabled conditions do not require their history. Exclusions take precedence over an ordinary nonmatch when an enabled condition cannot be evaluated.
- SMA intervals: one minute, five minutes and daily. Integer periods 1–200, presets 9/20/200. Strict above/below; equality matches neither.
- SMA is the arithmetic mean of the last N expected completed closes. A missing required candle excludes the instrument. Do not fill, substitute zero or stretch the window to older observed bars. Insufficient sample history excludes it too. Gaps outside the required SMA window do not exclude it.
- Store prices as integer billionths of a dollar. Compare price times period against the sum using BigInt. Convert to numbers only for display; display rounding does not change SMA membership.

## RSI

- RSI chooses its own one-minute, five-minute or daily interval, independently of SMA. Period defaults to 14; supported integer range is 2–200. Threshold is 0–100 with strict above/below comparison.
- Use Wilder smoothing. Seed average gain and average loss with the arithmetic means of the first N changes from N+1 consecutive closes. Each later average is `(previous * (N - 1) + current) / N`. RSI is `100 * averageGain / (averageGain + averageLoss)`.
- Gain-only runs produce 100, loss-only runs 0. Completely flat runs produce 50, an explicit FinWin convention. This flat convention and gap behavior should not be assumed identical to every library. [TA-Lib RSI source](https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_RSI.c) is a reference for the Wilder recurrence, not an assertion of complete output compatibility.
- Compute through the entire contiguous run available since the sample begins. A missing expected candle breaks that run and resets the seed. Require N+1 new consecutive closes after it; never compute a price change across the gap. The table shows the seed-start candle timestamp so this reset is visible.
- RSI uses double-precision arithmetic without display rounding before comparison. The independent Decimal oracle is required to agree within 1e-9 on sampled real values. A different history start, feed, adjustment policy or initialization can produce a different RSI.

## Same-time relative volume

- Accumulate MINI minute volume from 09:30 through the last completed minute today. Divide by mean accumulated MINI volume through the same elapsed session minute across exactly 20 preceding trading sessions.
- Never use full-day SUMMARY volume in this denominator. All 20 baseline sessions must exist, with every required minute through the comparison time. Today's prefix must also be complete. Missing a minute excludes the symbol; later gaps beyond the comparison time do not matter.
- A zero baseline excludes the symbol. Zero current volume with a positive baseline produces zero. Insufficient prior sessions excludes it. No shortened sessions occur in the supported intraday interval; extending relative-volume replay to such dates requires an explicit comparison policy first.
- Minimum threshold is inclusive, from 0 to 1000 with at most three decimal places. Compare `current * 20 * 1000` with `sumOfBaselineVolumes * minimumInThousandths` using BigInt. The table shows ratio, current volume and baseline average. Display rounding cannot affect membership.

## Verification and remaining scope

Run `bun scripts/check-screener-replay.ts`. It verifies 50 intraday SMA cases including the screenshot's period 30, then uses `scripts/screener-indicator-oracle.py` to independently calculate 45 combinations of symbol, timestamp and interval directly from raw JSONL with Python Decimal. These cases check daily SMA 200, Wilder RSI and relative volume, including real IWM gaps. It also checks future-data independence, daily publication cutoff, interval boundaries, calendar/DST/early closes, insufficient history, RSI flat/up/down/reset behavior, zero-volume baseline, optional cache loading, input validation and tRPC authentication.

At September 15, 2026, 10:30 New York, price above one-minute SMA 30 matches NVDA only. Its price is 212.74 and SMA is 212.702333333; the user's screenshot agrees for all five symbols. SMA 20 instead matches MSFT and NVDA.

`bun test scripts/screener-page.test.ts` verifies real result values, error rendering and mixed-indicator labels in page markup. The user's screenshot provides visual acceptance of the first SMA screen. New controls still need browser interaction/visual acceptance; server-side rendering is not a substitute.

Saved screens, reusable multi-condition editing beyond the current three conditions, charts/news, watchlists, corporate-action handling and live provider selection remain unimplemented. Paper-trade handoff stays disabled pending an explicit historical price/time/execution contract. The local cache is not bundled for deployment.

The prior full `verify` run stopped at unchanged Next.js 16.2.11 dependency audit findings GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4. No dependency versions changed in this indicator milestone.
