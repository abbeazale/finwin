# Investment Plaid Sync — Plan

Companion to [spec/investments-plaid-sync.md](../spec/investments-plaid-sync.md).

Order: 2 — implement after schema/accounts and before API/UI.

Status: complete as of 2026-04-30; live Plaid sandbox/development verification remains.

## Goal

Import investment holdings, securities, and investment transactions from Plaid
through the existing connection model.

## Phase 0 — Product Enablement

- Add `Products.Investments` to new Plaid Link tokens.
- Keep update-mode Link behavior unchanged.
- Confirm `/settings/connections` can display investment accounts from
  `accountsGet`.

Exit: investment accounts can be selected in Link.

## Phase 1 — Securities Upsert Helper

- Add a helper that maps Plaid securities into `securities`.
- Upsert by `plaid_security_id`.
- Preserve cash-equivalent, type, ticker, name, close price, and currency fields.

Exit: both holdings and transaction sync can reuse the same securities path.

## Phase 2 — Holdings Sync

- Add `syncInvestmentHoldings(connectionId)` or a connection-row equivalent.
- Call `/investments/holdings/get`.
- Resolve provider account IDs to `bank_accounts.id`.
- Upsert holdings by `(account_id, security_id)`.
- Delete missing holdings per account inside the same transaction.

Exit: re-sync reflects current positions and removes closed positions.

## Phase 3 — Investment Transactions Sync

- Add `syncInvestmentTransactions(connectionId)`.
- Determine first-sync vs overlap date range.
- Page through `/investments/transactions/get` with `count = 500`.
- Upsert transactions by `plaid_investment_transaction_id`.
- Store Plaid raw `plaid_amount` as-is.

Exit: transaction sync is idempotent and sign semantics are preserved.

## Phase 4 — Main Sync and Webhooks

- After regular `syncConnection`, detect investment accounts for the connection.
- Run investment holdings and transaction sync when relevant.
- Dispatch investment webhooks:
  - `HOLDINGS` + `DEFAULT_UPDATE`
  - `INVESTMENTS_TRANSACTIONS` + `DEFAULT_UPDATE`

Exit: manual sync and webhook sync both update investments.

## Verification

- `bunx tsc --noEmit`
- targeted lint on Plaid sync and webhook files
- sandbox/development Plaid investment account sync
- repeat sync confirms no duplicate investment transactions

## Files

- `src/server/trpc/routers/plaid.ts`
- `src/server/plaid/sync.ts`
- `src/pages/api/plaid/webhook.ts`
- possible helper under `src/server/plaid/`

## Done

- Investment accounts import holdings and transaction history.
- Holdings replacement is atomic per account.
- Investment signs are not normalized like regular bank transactions.
