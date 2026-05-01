# Investment Schema and Accounts

## Purpose

Define the storage needed for real investment accounts while preserving the
existing FinWin unlink model.

## Existing Table Change: `bank_accounts`

Add a nullable user-owned nickname:

- `nickname` text NULL

`bank_accounts.name` remains the provider-reported account name from Plaid.
`nickname` is the user's preferred display label and must never be overwritten
by sync.

Anywhere the UI needs an account label, use:

`displayName = nickname ?? name`

Institution name is not required for Phase 6a. If FinWin later needs
institution grouping or duplicate-connection detection, add provider
institution metadata to `bank_connections` as a separate integration field.

## Investment Account Rules

Plaid investment accounts use `bank_accounts.type = "investment"`.

Investment holdings and transactions are retained when a connection is unlinked.
Unlink continues to set:

- `bank_accounts.connection_id = NULL`
- `bank_accounts.is_active = false`

No holdings or investment transactions are deleted during unlink.

## `securities`

Shared Plaid security metadata.

Columns:

- `id` uuid PK
- `plaid_security_id` text UNIQUE NOT NULL
- `ticker_symbol` text NULL
- `name` text NULL
- `type` text NULL
- `is_cash_equivalent` boolean NOT NULL DEFAULT false
- `close_price` numeric(12,4) NULL
- `close_price_as_of` date NULL
- `iso_currency_code` text NULL
- `unofficial_currency_code` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Indexes:

- unique index on `plaid_security_id`

## `investment_holdings`

Current snapshot of positions per account. This is not an append-only ledger.

Columns:

- `id` uuid PK
- `user_id` text FK -> user.id NOT NULL
- `account_id` uuid FK -> bank_accounts.id ON DELETE CASCADE NOT NULL
- `security_id` uuid FK -> securities.id NOT NULL
- `quantity` numeric(18,8) NOT NULL
- `cost_basis` numeric(12,2) NULL
- `institution_price` numeric(12,4) NOT NULL
- `institution_price_as_of` date NULL
- `iso_currency_code` text NULL
- `unofficial_currency_code` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Constraints and indexes:

- unique `(account_id, security_id)`
- index on `user_id`
- index on `account_id`

Market value is not stored. Compute it on read as:

`quantity * institution_price`

## `investment_transactions`

Investment transaction history per account.

Columns:

- `id` uuid PK
- `user_id` text FK -> user.id NOT NULL
- `account_id` uuid FK -> bank_accounts.id ON DELETE CASCADE NOT NULL
- `security_id` uuid FK -> securities.id NULL
- `plaid_investment_transaction_id` text UNIQUE NOT NULL
- `date` date NOT NULL
- `name` text NOT NULL
- `quantity` numeric(18,8) NULL
- `plaid_amount` numeric(12,2) NOT NULL
- `price` numeric(12,4) NULL
- `fees` numeric(12,2) NULL
- `type` text NOT NULL
- `subtype` text NULL
- `iso_currency_code` text NULL
- `unofficial_currency_code` text NULL
- `created_at` timestamptz NOT NULL DEFAULT now()

Indexes:

- index on `(user_id, date)`
- index on `account_id`
- unique index on `plaid_investment_transaction_id`

## `currency_rates`

Daily FX cache for Phase 6a USD aggregation.

Columns:

- `id` uuid PK
- `base_currency` text NOT NULL
- `quote_currency` text NOT NULL
- `rate` numeric(18,8) NOT NULL
- `fetched_at` timestamptz NOT NULL
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NOT NULL DEFAULT now()

Constraints and indexes:

- unique `(base_currency, quote_currency)`

## Done

- Drizzle schema and migration exist.
- User FKs use `text` to match Better Auth's current `user.id`.
- Account nickname is nullable and sync-safe.
- Existing unlink behavior retains historical investment data.
