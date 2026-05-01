# Investment Schema and Accounts — Plan

Companion to [spec/investments-schema-accounts.md](../spec/investments-schema-accounts.md).

Order: 1 — implement before Plaid sync, API/UI, and FX.

Status: complete as of 2026-04-30.

## Goal

Add the storage foundation for investment accounts without changing Plaid sync
behavior yet.

## Phase 0 — Current Schema Check

- Confirm Better Auth `user.id` remains `text`.
- Confirm `bank_accounts.type` already supports `"investment"`.
- Confirm unlink still uses "delete pipe, keep data".

Exit: no unresolved schema assumptions.

## Phase 1 — Account Nickname

- Add nullable `nickname` to `bank_accounts`.
- Update Drizzle schema.
- Generate migration with `bunx drizzle-kit generate`.
- Ensure Plaid account sync never overwrites nickname.

Exit: account display can use `nickname ?? name`.

## Phase 2 — Investment Tables

Add Drizzle tables:

- `securities`
- `investment_holdings`
- `investment_transactions`
- `currency_rates`

Important details:

- user-owned tables use `text` user FKs to `user.id`
- holdings are unique by `(account_id, security_id)`
- investment transactions are unique by `plaid_investment_transaction_id`
- native `iso_currency_code` and `unofficial_currency_code` are preserved

Exit: migration applies cleanly.

## Phase 3 — Schema Smoke Test

- Run `bunx tsc --noEmit`.
- Run targeted lint on `src/db/schema.ts`.
- If a disposable DB is acceptable, run migration/reset flow and inspect tables.

Exit: schema compiles and generated migration matches the intended model.

## Files

- `src/db/schema.ts`
- `drizzle/*.sql`
- `drizzle/meta/*`

## Done

- Account nickname exists.
- Investment tables exist.
- Existing unlink behavior remains intact.
- No Plaid sync code depends on the new tables yet.
