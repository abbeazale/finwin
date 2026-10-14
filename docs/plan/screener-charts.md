# Screener charts implementation plan

Status: implemented, 2026-10-04 (uncommitted). See Implementation notes at the end. Product contract: [historical screener charts](../spec/screener-charts.md). User selected a full-width panel below results, independent indicators, EMA rather than SMA, separate 9/20/200 toggles, candle intervals 1m/5m/10m/15m/30m/1h/Daily and regular-hours daily data with shorter history. The user accepted the coordinated screening EMA correction and indicator-following defaults on 2026-10-04. The preceding desk restyle and momentum-filter work were committed separately (e28221d, f53acbb) before unit 1.

## Delivery sequence

| Unit | Change | Proof before continuing |
| --- | --- | --- |
| 1. Full bars and indicator contract | Preserve minute OHLCV; build regular-session 1m/5m/10m/15m/30m/1h/daily aggregates and sequential EMA/RSI. Preserve existing screening source policies during extraction. | Before the intentional EMA switch, old replay benchmarks remain unchanged; new raw interval/daily/closing-bucket aggregation and independent EMA/RSI checks pass. |
| 2. Correct screening to EMA | Replace SMA condition/input/label/table value with actual EMA, using the shared implementation. Coordinate shared schema, engine, form, result formatting and checks. | Independent EMA benchmarks cover periods 1/9/20/200 and supported intervals, equality, gaps and seed provenance. Review intentional membership changes; non-moving-average filters and RSI remain unchanged. |
| 3. Authenticated chart query | Validate finite intervals and one symbol/clock/settings; return bounded regular-session candles and native/projected indicators from minute data only. | Verify auth/bounds/cutoff/JSON safety, 10m and daily source rules, no-lookahead and independence from SUMMARY/news/float. |
| 4. Selection and chart panel | Add symbol buttons, interval selector, independent EMA 9/20/200 toggles, settings and full-width client renderer. | Browser verifies each toggle, 1m/10m/daily views, interval-following/fixed behavior, insufficient history, crosshair/pan/zoom and source labels. |
| 5. State and acceptance | Verify rapid changes, filter drafts, errors, gaps, accessibility, request sizes and lifecycle cleanup; update feature docs. | Acceptance matrix and project checks pass; capture desktop/mobile evidence and actual benchmark output. |

Keep each unit reviewable and passing before the next. Do not fold the surrounding unfinished UI/filter work into chart changes. The current checkout is dirty; inspect the baseline diff and preserve unrelated work. Documentation and local tests remain uncommitted under AGENTS.md.

## Expected file changes

| File | Responsibility |
| --- | --- |
| `src/server/screener/cache.ts` | Retain validated OHLCV without weakening pinned sample integrity. |
| `src/server/screener/candles.ts` or equivalent small module | Expected-slot construction, regular-session intraday/daily aggregation, closing-bucket duration and gap handling. Preserve existing SUMMARY screening projections where needed. |
| `src/server/screener/indicators.ts` or equivalent small module | Single-pass EMA/RSI points/final values and seed provenance; preserve RSI behavior. |
| `src/server/screener/replay.ts` | Consume shared functions; intentionally replace SMA comparison with EMA, preserving other conditions. |
| `src/lib/screener-replay.ts`, `src/components/screener/screen-form.tsx`, formatting/checks | Coordinate the `sma` to `ema` condition change and truthful labels. Do not keep an input named SMA while executing EMA. No saved-screen persistence exists to migrate in the current project. |
| `src/lib/screener-chart.ts` | Shared validated chart input/domain contract. Derive client output types from tRPC rather than duplicating the wire schema. |
| `src/server/screener/chart.ts` | Pure per-symbol response, native EMA/RSI calculations, no-lookahead projection, warmup and bounded expected display slots. |
| `src/server/trpc/routers/screener.ts` | Protected chart query loading verified minute data only, including regular-session daily charts/overlays; preserve separate screen daily requirements. |
| `src/pages/screener.tsx` | Selection and independent chart settings outside keyed form/results; request derived from the applied clock. |
| `src/components/screener/results-table.tsx` | Accessible symbol-selection buttons and selected-row state, preserving links and existing columns. |
| `src/components/screener/research-panel.tsx` | Controls, header, match context, loading/error/empty states and factual accessible summary. |
| `src/components/screener/price-chart.tsx` | Client-only chart API lifecycle, series/panes, data updates, gap rendering, time formatters and container resize. |
| `package.json`, `bun.lock` | Pinned Lightweight Charts dependency installed together with Bun during implementation. |

Names are proposed; use the smallest ownership split that keeps pure calculations separate from the renderer. Do not build a general charting framework or provider abstraction for this five-symbol increment.

## Verification tool

Extend replay checks/oracle for actual EMA, then add a local rerunnable chart check comparing API output to independently aggregated raw OHLCV for every selected interval. Include 10m boundaries, short closing buckets, full regular-day aggregation, gaps, warmup, projection, auth and limits. Compare chart/screen values only for identical feed/interval/seed history; regular-session daily chart values may differ from SUMMARY daily screen context. Old SMA screenshots are not EMA evidence. Keep local verification files uncommitted unless directly requested.

Run appropriate focused checks after the calculation/API units, then typecheck, lint, tests, knip and production build for the completed feature. Run the full `verify` release gate before shipping; verify the actual branch dependency baseline rather than treating a previously fixed separate checkout as proof. Browser acceptance is required in addition to these checks.

## Decisions and gates

- Full-width below results, separate EMA 9/20/200 toggles and 1m/10m/daily choices are user requirements. Additional 5m/15m/30m/1h choices were accepted on 2026-10-04. Chart-native presets follow the candle interval; inherited screen indicators can have labeled fixed overrides. Settings remain independent of filters.
- User chose regular-hours daily charts with shorter history. Chart daily candles and all chart daily indicators derive only from MINI regular-session minute bars; no SUMMARY fallback. EMA 200 daily has insufficient history initially. Existing screen daily SUMMARY inputs retain distinct context labels; changing those sources is outside this chart data choice.
- Keep chart/table numerical agreement for identical native intervals/periods/seed/cutoff; projected line samples and native latest-value summaries carry distinct timestamps when necessary.
- Always use `loadReplayBars(false)` for chart data. All chart intervals are derived from this verified minute sample, so a missing SUMMARY file must not affect charts. Preserve required minute-file integrity checks and explicit daily-aggregate gaps.
- Clear old plotted data when the query key changes, retain controls, and render only an exact matching result. Prefer truthful loading over a mislabeled previous chart.
- No new provider requests, prices, credentials, migrations, stock downloads or subscription costs are needed. Replay deployment still depends on delivery of the existing ignored cache; this milestone does not solve cache hosting.

## Completion evidence

Record the offline raw-data comparison output, matching tRPC responses, focused/project check results, benchmark sizes/times, and browser screenshots/interaction outcomes. The milestone is complete when a signed-in user can select every available sample instrument, inspect correct historical candles/indicators and navigate replay without losing selection or seeing future/mislabeled data.
