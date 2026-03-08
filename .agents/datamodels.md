# FinWin Data Model v0.1

Two-level default categories, banking transactions, budgets, and income events.

---

## Conventions

### Money sign convention (recommended)

- `transactions.amount` is **positive = expense (money out)**, **negative = income/refund (money in)**.
- This makes budgeting “spent so far” naturally `SUM(amount)` for expenses, with a filter to exclude negative amounts.

### IDs

- Use `uuid` PKs for all tables.

### “Spent so far”

- Do **not** store `spent_so_far` on `budgets`. It is derived from `transactions` by month and category.

---

# 1) category_groups

Top-level categories (parents). Examples: Food, Transport, Bills, Income.

### Columns

- `id` uuid **PK**
- `name` text **UNIQUE NOT NULL**
- `sort_order` int **NOT NULL DEFAULT 0**
- `created_at` timestamptz **NOT NULL DEFAULT now()**

### Indexes

- Unique index on `name`

### Notes

- `sort_order` is only for UI ordering.
- Default-only for now (global seed data, not user-generated).

---

# 2) categories

Subcategories under a group. Examples: Food → Groceries, Food → Restaurants.

### Columns

- `id` uuid **PK**
- `group_id` uuid **FK -> category_groups.id NOT NULL**
- `name` text **NOT NULL**
- `default_budgetable` boolean **NOT NULL DEFAULT true**
- `sort_order` int **NOT NULL DEFAULT 0**
- `created_at` timestamptz **NOT NULL DEFAULT now()**

### Constraints

- **UNIQUE (group_id, name)**

### Indexes

- Index on `group_id`
- Unique index on `(group_id, name)`

### Notes

- Transactions get assigned to `categories.id` (subcategory level).
- Set `default_budgetable = false` for subcategories under Income/Transfers.

---

---

# 3) Users

Represents application users who own accounts, transactions, budgets, and portfolios.

### Columns

- `id` uuid **PK**
- `email` text **UNIQUE NOT NULL**
- `name` text NULL
- `avatar_url` text NULL
- `auth_provider` text **NOT NULL** (example: `clerk | authjs | google`)
- `auth_provider_id` text **NOT NULL** (external auth user id)
- `default_currency` text **NOT NULL DEFAULT 'CAD'**
- `timezone` text **NOT NULL DEFAULT 'UTC'**
- `created_at` timestamptz **NOT NULL DEFAULT now()**
- `updated_at` timestamptz **NOT NULL DEFAULT now()**

### Indexes

- Unique index on `email`
- Index on `(auth_provider, auth_provider_id)`

### Notes

- All financial records are scoped to `user_id`.
- Authentication is handled by an external provider (Clerk or Auth.js), but the application keeps a local `users` table for relationships and metadata.
- `default_currency` allows future support for multi‑currency users.
- `timezone` is important for correctly grouping transactions and budgets by month.

---

# 4) bank_connections

Represents a bank login/institution connection (Plaid “Item”).

### Columns

- `id` uuid **PK**
- `user_id` uuid **FK -> [users.id](http://users.id) NOT NULL**
- `provider` text **NOT NULL** (example: `plaid`)
- `provider_item_id` text **UNIQUE NOT NULL**
- `access_token_encrypted` text **NOT NULL**
- `status` text **NOT NULL** (example: `active | error | revoked`)
- `last_cursor` text NULL (for Plaid transactions sync)
- `created_at` timestamptz **NOT NULL DEFAULT now()**
- `updated_at` timestamptz **NOT NULL DEFAULT now()**

### Indexes

- Index on `user_id`
- Unique index on `provider_item_id`

### Notes

- Store access tokens encrypted at rest.
- `last_cursor` enables incremental sync (faster and cheaper than full backfills).

---

# 5) bank_accounts

Accounts under a connection (checking, credit card, etc). Plaid “Account”.

### Columns

- `id` uuid **PK**
- `user_id` uuid **FK -> [users.id](http://users.id) NOT NULL**
- `connection_id` uuid **FK -> bank_[connections.id](http://connections.id) NOT NULL**
- `provider_account_id` text **UNIQUE NOT NULL**
- `name` text **NOT NULL**
- `type` text **NOT NULL** (example: `depository | credit | loan | investment`)
- `subtype` text NULL
- `mask` text NULL
- `currency` text **NOT NULL DEFAULT 'CAD'**
- `is_active` boolean **NOT NULL DEFAULT true**
- `created_at` timestamptz **NOT NULL DEFAULT now()**

### Indexes

- Index on `user_id`
- Index on `connection_id`
- Unique index on `provider_account_id`

### Notes

- Keep `user_id` here even though it is derivable through connection, it simplifies filtering and indexing.

---

# 6) transactions

Core banking ledger (imported transactions).

### Columns

- `id` uuid **PK**
- `user_id` uuid **FK -> [users.id](http://users.id) NOT NULL**
- `account_id` uuid **FK -> bank_[accounts.id](http://accounts.id) NOT NULL**
- `provider_transaction_id` text **UNIQUE NOT NULL**
- `date` date **NOT NULL**
- `authorized_date` date NULL
- `name` text **NOT NULL** (transaction description)
- `merchant_name` text NULL
- `amount` numeric(12,2) **NOT NULL**
- `currency` text **NOT NULL DEFAULT 'CAD'**
- `pending` boolean **NOT NULL DEFAULT false**
- `category_id` uuid NULL **FK -> [categories.id](http://categories.id)**
- `category_confidence` numeric(3,2) NULL (0.00–1.00, for future auto-categorization)
- `notes` text NULL
- `created_at` timestamptz **NOT NULL DEFAULT now()**

### Indexes

- Index on `(user_id, date)`
- Index on `(account_id, date)`
- Index on `(user_id, category_id, date)`

### Notes

- `category_id` is nullable so you can support “Uncategorized”.
- If Plaid updates a pending transaction into a posted one, you update the same row (because provider_transaction_id stays stable in most cases).
- For “spent so far”, you will typically sum only expenses: `amount > 0`.

---

# 7) budgets

Monthly budget per user per subcategory.

### Columns

- `id` uuid **PK**
- `user_id` uuid **FK -> [users.id](http://users.id) NOT NULL**
- `category_id` uuid **FK -> [categories.id](http://categories.id) NOT NULL**
- `month` date **NOT NULL** (store as first day of month, example `2026-03-01`)
- `amount` numeric(12,2) **NOT NULL**
- `created_at` timestamptz **NOT NULL DEFAULT now()**

### Constraints

- **UNIQUE (user_id, category_id, month)**

### Indexes

- Index on `(user_id, month)`
- Index on `(user_id, category_id, month)`
- Unique index on `(user_id, category_id, month)`

### Notes

- “Spent so far” is derived from transactions:
  - filter by `user_id`
  - filter by `category_id`
  - filter by `date` within the budget month
  - sum `amount` where `amount > 0` (if using the positive=expense convention)

Suggested query logic (conceptual)

```sql
SELECT
  b.user_id,
  b.category_id,
  b.month,
  b.amount AS budget_amount,
  COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0) AS spent_so_far
FROM budgets b
LEFT JOIN transactions t
  ON t.user_id = b.user_id
 AND t.category_id = b.category_id
 AND t.date >= b.month
 AND t.date < (b.month + INTERVAL '1 month')
GROUP BY b.user_id, b.category_id, b.month, b.amount;

```

---

# 8) income_events (recommended)

Normalizes income events to support investing contributions and forecasting.

### Columns

- `id` uuid **PK**
- `user_id` uuid **FK -> [users.id](http://users.id) NOT NULL**
- `source` text **NOT NULL** (example: `manual | detected | recurring_rule`)
- `date` date **NOT NULL**
- `amount` numeric(12,2) **NOT NULL**
- `description` text NULL
- `created_at` timestamptz **NOT NULL DEFAULT now()**

### Indexes

- Index on `(user_id, date)`
- Index on `(user_id, source)`

### Notes

- This table normalizes income events so they can be used consistently for investing contributions and financial forecasting.
- Sources may include manual user input, detected payroll deposits from bank transactions, or system-generated recurring income rules.
- These events can drive automatic virtual investment contributions (e.g., investing a percentage of each paycheck).

---

# Seed Data (Defaults)

## category_groups examples

- Food
- Transport
- Bills
- Housing
- Shopping
- Entertainment
- Health
- Travel
- Income
- Transfers

## categories examples

Food

- Groceries
- Restaurants
- Coffee
- Fast Food

Transport

- Gas
- Transit
- Parking
- Rideshare

Bills

- Phone
- Internet
- Insurance
- Subscriptions

Income

- Paycheck
- Refund

Transfers

- Transfer In
- Transfer Out

---

# Future additions (not in v0.1)

- `merchants` + merchant mapping rules (for better categorization)
- `recurring_rules` (for subscriptions and paychecks)
- `budget_rollups` / materialized views (only if performance becomes a problem)
- Investing tables: `symbols`, `prices_daily`, `portfolios`, `portfolio_trades`, etc (to be designed next)

---

## ER Diagram (v0.1)

```mermaid
erDiagram
  CATEGORY_GROUPS {
    uuid id PK
    text name
  }

  CATEGORIES {
    uuid id PK
    uuid group_id FK
    text name
    boolean default_budgetable
  }

  USERS {
    uuid id PK
    text email
    text auth_provider
    text auth_provider_id
  }

  BANK_CONNECTIONS {
    uuid id PK
    uuid user_id FK
    text provider
    text provider_item_id
  }

  BANK_ACCOUNTS {
    uuid id PK
    uuid user_id FK
    uuid connection_id FK
    text provider_account_id
    text type
  }

  TRANSACTIONS {
    uuid id PK
    uuid user_id FK
    uuid account_id FK
    uuid category_id FK
    date date
    numeric amount
  }

  BUDGETS {
    uuid id PK
    uuid user_id FK
    uuid category_id FK
    date month
    numeric amount
  }

  INCOME_EVENTS {
    uuid id PK
    uuid user_id FK
    date date
    numeric amount
  }

  CATEGORY_GROUPS ||--o{ CATEGORIES : "has"
  USERS ||--o{ BANK_CONNECTIONS : "has"
  USERS ||--o{ BANK_ACCOUNTS : "has"
  BANK_CONNECTIONS ||--o{ BANK_ACCOUNTS : "includes"
  USERS ||--o{ TRANSACTIONS : "has"
  BANK_ACCOUNTS ||--o{ TRANSACTIONS : "records"
  CATEGORIES ||--o{ TRANSACTIONS : "categorizes"
  USERS ||--o{ BUDGETS : "has"
  CATEGORIES ||--o{ BUDGETS : "budgeted_in"
  USERS ||--o{ INCOME_EVENTS : "earns"

```



