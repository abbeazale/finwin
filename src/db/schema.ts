import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    twoFactorEnabled: boolean("twoFactorEnabled").notNull().default(false),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    uniqueIndex("user_email_unique").on(table.email),
  ]),
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => ([
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ]),
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    uniqueIndex("account_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
    index("account_user_id_idx").on(table.userId),
  ]),
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("verification_identifier_idx").on(table.identifier),
  ]),
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("publicKey").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credentialID").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("deviceType").notNull(),
    backedUp: boolean("backedUp").notNull(),
    transports: text("transports"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    aaguid: text("aaguid"),
  },
  (table) => ([
    index("passkey_user_id_idx").on(table.userId),
    uniqueIndex("passkey_credential_id_unique").on(table.credentialID),
  ]),
);

export const twoFactor = pgTable(
  "twoFactor",
  {
    id: text("id").primaryKey(),
    secret: text("secret").notNull(),
    backupCodes: text("backupCodes").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean("verified").notNull().default(true),
  },
  (table) => ([
    index("two_factor_secret_idx").on(table.secret),
    index("two_factor_user_id_idx").on(table.userId),
  ]),
);

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    firstName: varchar("firstName", { length: 255 }),
    lastName: varchar("lastName", { length: 255 }),
    age: integer("age"),
    currency: varchar("currency", { length: 16 }).notNull().default("CAD"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("America/Toronto"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    uniqueIndex("user_profiles_user_id_unique").on(table.userId),
  ]),
);

// ─── Financial tables ────────────────────────────────────────────────────────

export const categoryGroups = pgTable(
  "category_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    uniqueIndex("category_groups_name_unique").on(table.name),
  ]),
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => categoryGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultBudgetable: boolean("default_budgetable").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("categories_group_id_idx").on(table.groupId),
    uniqueIndex("categories_group_name_unique").on(table.groupId, table.name),
  ]),
);

export const bankConnections = pgTable(
  "bank_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "plaid"
    providerItemId: text("provider_item_id").notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    accessTokenKeyVersion: text("access_token_key_version").notNull(),
    status: text("status").notNull(), // "active" | "error"
    lastCursor: text("last_cursor"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    syncErrorCode: text("sync_error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("bank_connections_user_id_idx").on(table.userId),
    uniqueIndex("bank_connections_provider_item_id_unique").on(table.providerItemId),
  ]),
);

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(
      () => bankConnections.id,
      { onDelete: "set null" },
    ),
    providerAccountId: text("provider_account_id").notNull(),
    name: text("name").notNull(),
    nickname: text("nickname"),
    type: text("type").notNull(), // "depository" | "credit" | "loan" | "investment"
    subtype: text("subtype"),
    mask: text("mask"),
    currency: varchar("currency", { length: 16 }).notNull().default("CAD"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("bank_accounts_user_id_idx").on(table.userId),
    index("bank_accounts_connection_id_idx").on(table.connectionId),
    uniqueIndex("bank_accounts_provider_account_id_unique").on(table.providerAccountId),
  ]),
);

export const securities = pgTable(
  "securities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plaidSecurityId: text("plaid_security_id").notNull(),
    tickerSymbol: text("ticker_symbol"),
    name: text("name"),
    type: text("type"),
    isCashEquivalent: boolean("is_cash_equivalent").notNull().default(false),
    closePrice: numeric("close_price", { precision: 12, scale: 4 }),
    closePriceAsOf: date("close_price_as_of"),
    isoCurrencyCode: text("iso_currency_code"),
    unofficialCurrencyCode: text("unofficial_currency_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    uniqueIndex("securities_plaid_security_id_unique").on(table.plaidSecurityId),
  ]),
);

export const investmentHoldings = pgTable(
  "investment_holdings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    securityId: uuid("security_id")
      .notNull()
      .references(() => securities.id),
    quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),
    costBasis: numeric("cost_basis", { precision: 12, scale: 2 }),
    institutionPrice: numeric("institution_price", { precision: 12, scale: 4 }).notNull(),
    institutionPriceAsOf: date("institution_price_as_of"),
    isoCurrencyCode: text("iso_currency_code"),
    unofficialCurrencyCode: text("unofficial_currency_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("investment_holdings_user_id_idx").on(table.userId),
    index("investment_holdings_account_id_idx").on(table.accountId),
    uniqueIndex("investment_holdings_account_security_unique").on(
      table.accountId,
      table.securityId,
    ),
  ]),
);

export const investmentTransactions = pgTable(
  "investment_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    securityId: uuid("security_id").references(() => securities.id),
    plaidInvestmentTransactionId: text("plaid_investment_transaction_id").notNull(),
    date: date("date").notNull(),
    name: text("name").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 8 }),
    plaidAmount: numeric("plaid_amount", { precision: 12, scale: 2 }).notNull(),
    price: numeric("price", { precision: 12, scale: 4 }),
    fees: numeric("fees", { precision: 12, scale: 2 }),
    type: text("type").notNull(),
    subtype: text("subtype"),
    isoCurrencyCode: text("iso_currency_code"),
    unofficialCurrencyCode: text("unofficial_currency_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("investment_transactions_user_date_idx").on(table.userId, table.date),
    index("investment_transactions_account_id_idx").on(table.accountId),
    uniqueIndex("investment_transactions_plaid_id_unique").on(
      table.plaidInvestmentTransactionId,
    ),
  ]),
);

export const currencyRates = pgTable(
  "currency_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    baseCurrency: text("base_currency").notNull(),
    quoteCurrency: text("quote_currency").notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    uniqueIndex("currency_rates_base_quote_unique").on(
      table.baseCurrency,
      table.quoteCurrency,
    ),
  ]),
);

export const sandboxPortfolios = pgTable(
  "sandbox_portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startingCash: numeric("starting_cash", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    check("sandbox_portfolios_starting_cash_check", sql`${table.startingCash} >= 0`),
    index("sandbox_portfolios_user_id_idx").on(table.userId),
    uniqueIndex("sandbox_portfolios_user_name_unique").on(table.userId, table.name),
  ]),
);

export const sandboxTrades = pgTable(
  "sandbox_trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => sandboxPortfolios.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 8 }).notNull(),
    price: numeric("price", { precision: 12, scale: 4 }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    check("sandbox_trades_side_check", sql`${table.side} in ('buy', 'sell')`),
    check("sandbox_trades_quantity_check", sql`${table.quantity} > 0`),
    check("sandbox_trades_price_check", sql`${table.price} >= 0`),
    index("sandbox_trades_portfolio_executed_at_idx").on(
      table.portfolioId,
      table.executedAt,
    ),
    index("sandbox_trades_user_id_idx").on(table.userId),
  ]),
);

// amount sign convention: positive = money in, negative = money out
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    providerTransactionId: text("provider_transaction_id").notNull(),
    date: date("date").notNull(),
    authorizedDate: date("authorized_date"),
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 16 }).notNull().default("CAD"),
    pending: boolean("pending").notNull().default(false),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_account_date_idx").on(table.accountId, table.date),
    index("transactions_user_category_date_idx").on(table.userId, table.categoryId, table.date),
    uniqueIndex("transactions_provider_transaction_id_unique").on(table.providerTransactionId),
  ]),
);

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    month: date("month").notNull(), // first day of month, e.g. "2026-03-01"
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ([
    index("budgets_user_month_idx").on(table.userId, table.month),
    index("budgets_user_category_month_idx").on(table.userId, table.categoryId, table.month),
    uniqueIndex("budgets_user_category_month_unique").on(table.userId, table.categoryId, table.month),
  ]),
);
