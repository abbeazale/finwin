# Free stock float sources

Checked official provider pages on 2026-10-05. This is source research, not a tested integration. No accounts, authenticated API requests, subscriptions or product changes.

| Source | Free access | Integration limits |
| --- | --- | --- |
| [Massive float API](https://massive.com/docs/rest/stocks/fundamentals/float) | Stocks Basic includes `GET /stocks/vX/float`. Returns `free_float`, `free_float_percent`, `effective_date` and ticker. Pagination supports up to 5,000 rows per page. | Experimental; latest measurement only, updated as needed, no history. Disclosures can lag ownership changes. The [free plan](https://massive.com/pricing) allows 5 calls/minute and is for individual use. Actual symbol coverage and app display rights still need verification. |
| [Yahoo Finance](https://finance.yahoo.com/quote/AAPL/key-statistics/) | Public statistics pages display Float separately from Shares Outstanding. | [yfinance](https://github.com/ranaroussi/yfinance) is an unofficial route to Yahoo data and describes the API as intended for personal use. Website access does not establish customer-facing display rights or a stable supported API contract. |
| [Finviz](https://finviz.com/stock?t=AAPL) | Public stock pages display Shs Float. Its [definition](https://elite.finviz.com/help/screener) excludes insiders, above-5% owners and Rule 144 shares. | [CSV/Excel exports and automated workflows](https://finviz.com/elite) are advertised as Elite features. Free webpage access is useful for manual comparison, not a verified free supported API. |
| [Stock Analysis](https://stockanalysis.com/stocks/aapl/statistics/) | Public statistics pages display Float. | [Official FAQ](https://stockanalysis.com/help/faq/api-access/) explicitly says no API, MCP server or other programmatic access; third-party licenses permit display rather than programmatic redistribution. |
| [Financial Modeling Prep](https://site.financialmodelingprep.com/developer/docs/stable/shares-float) | Official [pricing grid](https://site.financialmodelingprep.com/developer/docs/pricing) shows Company Share Float & Liquidity and All Shares Float in Basic, restricted to AAPL, TSLA, AMZN and 84 more symbols. Basic permits 250 calls/day and 500 MB per rolling 30 days. | Verified the grid's icon alt text in the browser, since text extraction loses its coverage cells. Starter covers US exchanges; Premium adds UK/Canada; Ultimate is global. [Current FAQ](https://site.financialmodelingprep.com/faqs) says only current float, despite older historical endpoint documentation. Display/redistribution requires a separate agreement. |

[Twelve Data statistics](https://twelvedata.com/docs/fundamentals/statistics) returns `float_shares`, but its documentation requires Pro for individuals or Venture for businesses and charges 50 credits per symbol. It is not a free float feed. Finnhub's free-float availability was not established by official documentation in this search; do not treat community claims as proof.

Recommendation: probe Massive's free endpoint for the intended common-stock universe before choosing a provider. Check nulls, small-cap coverage, measurement age, splits and differences against public lookup sites. No verified free point-in-time historical float series was found. Latest float must not be applied to past replay dates as though it was known then. `effective_date` alone does not establish when a measurement became available.

FinWin's existing SEC float cache contains shares outstanding. It remains a proxy and does not establish public float. Research has not changed that implementation or selected a new integration.

## Authenticated probes, 2026-10-05/06

Read-only calls with the existing keys in `.env`. No data saved, no code changed.

| Source | Result | Usable for replay history? |
| --- | --- | --- |
| Massive `GET /stocks/vX/float` | Works. AAPL 13.52B (92.1%, effective 2026-05-14), MSFT 7.42B (100%, 08-24), NVDA 23.25B (96.1%, 08-18), SOUN 405.4M (98.5%), BBAI 473.7M (98.8%). No ETF rows. `effective_date.lte` is ignored: only the latest row returns. | No. Latest only. |
| FMP `stable/shares-float` | Current only. AAPL 14.58B float (99.9%). Small caps (SOUN) return 402 on this plan. `stable/historical-shares-float` 404; legacy `v4/historical/shares_float` 403, closed to subscriptions after 2025-08-31. | No. |
| Finnhub `stock/profile2` `floatingShare` | Current only, no date, in millions. AAPL 14,445.7M; SOUN 398.91M; BBAI 475.63M. Small caps covered on this key. Field not in the main docs found. | No. |
| Yahoo/yfinance, Finviz, Stock Analysis, Twelve Data | Not probed. Official/public descriptions show current float only. | No history found. |

Providers disagree because "float" has different definitions: AAPL ranges from 13.52B (Massive, also excludes 5%+ holders) to 14.58B (FMP) against 14.59B outstanding. A threshold result depends on the chosen provider.

None of the listed sources gives point-in-time float history. Sources outside this list that advertise history (sec-api.io float API, Sharadar SHAR via Nasdaq Data Link, ORTEX) are paid and unverified here.

## Decision, 2026-10-06

User chose Massive. `scripts/fetch-massive-floats.py` replaces the SEC shares-outstanding script: it saves the full list to `.local/float-snapshots/massive-<date>.json` and rebuilds the replay file, with each value valid from its effective date. Estimating past float from today's percentage was rejected because it uses future data and can wrongly include stocks.
