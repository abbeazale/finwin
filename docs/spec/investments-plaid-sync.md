# Investment Plaid Sync

## Purpose

Import real investment holdings, securities, and investment transactions through
Plaid without mixing investment semantics into regular bank transaction logic.

## Product Enablement

Add `Products.Investments` to the products array in
`plaid.createLinkToken`.

For update-mode Link, keep the existing access-token behavior.

## Investment Transaction Sign Rules

Plaid investment transaction `amount` describes the cash side:

- positive = cash is debited from the investment account, e.g. buying stock
- negative = cash is credited to the investment account, e.g. sell proceeds or
  dividends

Plaid investment transaction `quantity` describes the security side:

- positive = quantity increased, e.g. buy
- negative = quantity decreased, e.g. sell

Store Plaid's raw amount as `plaid_amount`. Do not apply
`normalizeTransactionAmount` from regular transaction sync.

For FinWin display, derive:

`cashImpact = -plaid_amount`

This keeps the app-wide account-movement intuition without losing the provider
raw value.

## Holdings Sync

Function: `syncInvestmentHoldings(connection)`

Steps:

1. Decrypt the Plaid access token.
2. Call `/investments/holdings/get`.
3. Upsert all returned securities on `plaid_security_id`.
4. For each investment account, run one database transaction:
   - resolve `security_id` FK for each holding
   - upsert holdings on `(account_id, security_id)`
   - delete holdings for that account that no longer appear in the response

If the Plaid call fails before DB replacement starts, leave the previous
snapshot intact. If one account replacement fails, rollback that account's
snapshot transaction.

## Investment Transactions Sync

Function: `syncInvestmentTransactions(connection)`

Investment transactions are date-ranged, not cursor-based.

Date range:

- first sync: today minus 730 days through today
- later syncs: most recent existing investment transaction date for the
  connection minus a 7-day overlap buffer through today

Pagination:

- request `count = 500`
- start `offset = 0`
- continue until fetched rows reach `total_investment_transactions`

Upsert:

- upsert returned securities first
- upsert transactions on `plaid_investment_transaction_id`

## Main Sync Wiring

After regular `syncConnection` runs for a connection, check whether the
connection has any active `bank_accounts.type = "investment"` rows.

If yes, also run:

- `syncInvestmentHoldings(connection)`
- `syncInvestmentTransactions(connection)`

## Webhooks

In `src/pages/api/plaid/webhook.ts`, dispatch after the existing Plaid JWT
signature verification.

- `webhook_type = "HOLDINGS"` and `webhook_code = "DEFAULT_UPDATE"`:
  call `syncInvestmentHoldings`
- `webhook_type = "INVESTMENTS_TRANSACTIONS"` and
  `webhook_code = "DEFAULT_UPDATE"`: call `syncInvestmentTransactions`

Unknown investment webhook codes should be acknowledged and logged, matching
the current webhook posture.

## Done

- Investment accounts can be linked through the existing Plaid Link flow.
- Holdings sync is atomic per account.
- Closed positions disappear on next holdings sync.
- Investment transaction pagination fetches all available pages.
- Re-syncing does not duplicate investment transactions.
- Webhooks call the correct investment sync path.
