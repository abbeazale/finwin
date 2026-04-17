# Future Enhancements

Deferred ideas worth revisiting later. Not prioritised — just a holding area so nothing slips through the cracks.

---

## Budgets

- **Custom budget period start day** — budgets currently lock to the 1st of each month. Users who get paid mid-month (e.g. the 15th) would benefit from a rolling 30-day or custom start-day budget period. Wire this through user settings when it becomes a pain point.

## Categories

- **Merchant-rule persistence** — when a user reassigns a transaction's category, remember that merchant → category mapping and auto-apply it to future transactions from the same merchant. Requires a merchant-rules table and a light UI to manage rules.

## Transactions

- **Posted/pending filter toggle** — transactions page currently shows both. A filter (all / posted only / pending only) is low-hanging fruit when users ask for it.

## Dashboard

- **Recurring-spend detection** — once the core dashboard is fully live, add a deterministic pass for recurring merchants or subscriptions instead of leaving that analysis to AI copy.

- **Custom dashboard ranges** — the dashboard should stay calendar-month only for the first real analytics milestone. Revisit week, quarter, and YTD views only after the month-based metrics are trusted.
