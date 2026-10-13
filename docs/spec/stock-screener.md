# Stock screener design

Status: accepted, 2026-09-16. The user confirmed the consolidated design after grilling questions 1 through 34. Product implementation has not started. Provider feasibility and the explicitly deferred prototype details below remain to be resolved.

## Purpose

Make FinWin a place to build a personal stock screen, understand why instruments match, save a setup, and return to it. The screener is a main reason to use FinWin alongside budgeting and paper trading, accessible without linking a bank.

The first workflow is finding price and volume conditions worth investigating during the trading day. Beginners can start from explained templates; experienced users can configure their own conditions. Both use the same builder.

## Scope and layout

- US exchange-listed common stocks and ETFs, including low-priced stocks. Offer Stocks / ETFs / Both selection. OTC stocks, preferred shares, warrants and other security types are deferred.
- Regular trading sessions only. Follow the exchange calendar, including closures and shortened sessions; do not mix extended-hours prices into regular-session results.
- One consistent workspace: filter builder, results table and instrument research panel.
- Save filters, visible columns, column order and sorting per screen.
- Desktop-first screen creation/editing. Mobile supports running saved screens, researching results and managing watchlists. A full mobile editor is deferred.
- Draggable panels are a v2 direction.

## Screen rules

Every condition must match. A user saves separate screens for alternative setups; grouped OR conditions are deferred.

| Filter family | Agreed behavior |
| --- | --- |
| Basic | Price range, daily percentage change, regular-session trading volume, market cap, sector and exchange |
| Instrument type | Stocks, ETFs or both |
| SMA | Latest quote above/below a simple moving average built from completed candle closes |
| RSI | User-selected thresholds, default period 14 |
| Relative volume | Same-time accumulated regular-session volume relative to the prior 20 trading sessions |

### Indicators

- Support one-minute, five-minute and daily candles.
- Each indicator condition chooses its own timeframe. A screen can mix daily and intraday conditions.
- Periods are editable. SMA presets are 9, 20 and 200; RSI defaults to 14.
- Indicators use completed candles, not the candle still forming. Current quotes, daily change and accumulated volume can still update each minute.
- Display the indicator's timeframe and latest completed candle time. A daily indicator using the prior completed session is not itself evidence of stale intraday data.
- Same-time relative volume compares today's accumulated regular-session volume with average accumulated volume through the same session time across the previous 20 trading sessions. A value of 2 means twice the usual activity for that point in the session.
- If any required field or sufficient history is unavailable, exclude the instrument from that screen and show a missing-data exclusion count. Never substitute zero or silently omit a condition. Missing fields not used by the screen do not exclude the instrument.

Exact numerical conventions require a documented calculation contract during the data evaluation: RSI smoothing/initialization, adjustments, candle boundaries, no-trade intervals, shortened-session volume comparisons, zero-volume baselines, maximum editable periods and quote timestamps. They must be consistent across providers and verified before pilot use. No particular provider's indicator semantics are accepted solely because an endpoint exists.

## Saving and starting screens

- Screens are private to the account in v1.
- Explicit Save and Save as new; also rename, duplicate and delete.
- Editing a saved screen does not silently overwrite it.
- Offer a blank screen and explained, editable templates.
- Proposed template families discussed in the interview: unusual activity, price above a moving average and an RSI range. Exact template values remain a prototype-review detail; the user accepted both entry paths, not a particular trading strategy or threshold.
- Templates are examples to customize, not trade recommendations.

## Results and updates

- Target one-minute freshness for intraday market data. This is a desired capability, not a verified FMP guarantee.
- Automatically refresh results every 60 seconds while the screen is visible. Provide manual refresh, pause and a last-updated timestamp.
- Refresh the table's membership and ordering, while keeping an open research panel attached to its selected instrument.
- If that instrument stops matching, keep its panel open and label it "No longer matches."
- On a provider failure, retain the last successful results with a prominent stale label and timestamp. They are not represented as current matches.
- With no successful snapshot, show unavailable rather than fabricated results or an empty success state.
- Outside regular hours, show the last completed regular-session snapshot, labeled "Market closed" with its timestamp. Users can edit and run screens against that snapshot. Automatic market-data refresh resumes next session.
- The exact stale threshold and source-time handling must be defined and tested during feasibility; a fresh HTTP response is not proof of fresh market data.

## Research panel

- Candlestick chart and trading volume.
- SMA overlays and RSI panel, using supported intervals.
- Matched-condition explanations show actual values beside thresholds, including timeframe and indicator period.
- News headlines, publisher, publication time and links to original articles, subject to the relevant provider agreement.
- No AI-generated explanations, hosted articles, chart drawing tools or annotations in v1.
- Actions to add the instrument to a watchlist or start a paper trade.

### Watchlists

Allow several named watchlists with one default list initially. A screen can search the supported market or a selected watchlist. Membership is user-maintained and independent of current screen matches.

### Paper trading

Reuse the existing sandbox flow. Prefill the instrument and a timestamped price when appropriate, then let the user select a portfolio and quantity, review and explicitly confirm the hypothetical trade. Never silently present a stale quote as current.

Historical replay requires explicit separation from the current-time sandbox. Its historical price/date must not silently become a current paper trade. Exact replay-to-sandbox behavior remains a prototype design detail to resolve before enabling that action.

## Provider and budget

- FMP is the provisional provider, not a purchased subscription or verified production feed.
- Keep saved screen definitions owned by FinWin and isolate provider-specific data mappings. Replacing a provider must preserve setup meaning; it may require new ingestion, calculations and licensing.
- Prefer free access or trial credits. Maximum initial recurring data spend: **$50 USD/month**.
- Databento's $125 one-time credit is an evaluation option. Its available balance and eligible datasets must be checked before use. It is not a recurring allowance or approval to continue an expensive subscription after credit expiry.
- No subscription, annual payment or other purchase has been authorized by this planning discussion.
- First investigate suitable live access within the budget. If unavailable, the user accepts a historical-replay prototype using recorded market sessions, visibly labeled with historical date and time.
- Replay can establish calculation and workflow behavior. It does not establish live freshness, full-market throughput, current-news coverage or readiness for an invited live pilot.
- Full-market live scope is not silently reduced to a provider's sample symbols. Any coverage limits in a prototype must be explicit.
- News and company/ETF metadata coverage are separate requirements from price history. Databento minute bars alone do not replace the complete FMP feature set.

Provider research and links: [resources](../resources.md#screener-data-research-2026-09-15).

## Rollout and acceptance

1. Development preview available to signed-in FinWin accounts. On 2026-09-16 the user removed the proposed owner-only gate because the app has no production users.
2. Five trading sessions of personal use, with reusable setups, understandable matches and a usable research-to-paper-trade workflow. If development used replay, live freshness still needs a separate check before the next stage.
3. A small invited group after data/calculation checks pass and customer-display rights are established.
4. Paid public launch only after a later product and commercial decision. The original roughly $5 subscription idea remains a hypothesis; billing, currency, paid entitlements and customer-facing data budget are not settled.

Acceptance checks must demonstrate:

- Saved screens restore their conditions and presentation settings without silently overwriting experiments.
- Every sampled match satisfies every required condition; missing required data produces an explained exclusion.
- Indicator calculations use the selected periods, completed candles and session rules, with comparison evidence.
- Scope works for stocks, ETFs, the supported market and named watchlists.
- Selected research panels survive results refreshes and show when an instrument stops matching.
- Failed refreshes, closed sessions, insufficient history and unavailable news have truthful states.
- Paper-trade handoff preserves instrument identity and shows the actual price/date being used.
- Live data age and refresh capacity are measured under the intended market scope, not inferred from a provider's "real-time" label.
- Recurring costs fit the budget, and relevant usage/display rights are established for each rollout stage.

Profitable trading is not a product acceptance criterion.

## Design tree and outstanding work

| Branch | Decision status | Remaining work |
| --- | --- | --- |
| Product role and first user | Settled | Signed-in access without owner allowlist; standalone bank-free access within FinWin |
| Supported instruments and session | Settled | Verify provider symbol classification, coverage and calendar behavior |
| Filter semantics and timeframes | Product choices settled | Specify and prove numerical conventions against real data |
| Save, research, watchlist and paper-trade workflow | Settled | Review template defaults, chart limits and replay handoff in prototype |
| Refresh, failure, closed-market and mobile behavior | Settled | Verify timestamps, transitions and performance |
| Budget and fallback | Settled | Free preferred, $50/month ceiling; replay accepted if live access does not fit |
| Provider | Provisional | Evaluate FMP entitlements/capacity; price eligible Databento historical data if needed |
| Invited pilot | Conditional | Five-session personal acceptance plus live-data and display-rights checks |
| Paid launch and v2 | Deferred | Pricing/entitlements, commercial budget, draggable layout and broader capabilities |

Next agreed step is a bounded data feasibility evaluation. It should produce an endpoint/entitlement inventory, source timestamp samples, usable historical depth, estimated full-scope request/storage costs, calculation comparisons, and a clear live-within-budget or replay-first conclusion. It should not silently change the agreed product or incur costs beyond the approved scope.


## Implementation checkpoint, 2026-09-16

The bounded historical probe and first price/SMA replay screen are implemented. The [replay calculation contract](screener-replay-calculations.md) defines the limited initial behavior and verification. The earlier feasibility next-step paragraph describes the original design handoff; full-universe live feasibility is still open. Daily SMA, optional Wilder RSI on an independent interval, and optional 20-session same-time relative volume are now implemented. Every enabled condition must match. Saved screens and paper-trade handoff remain unimplemented.
