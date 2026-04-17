import {
  boolean,
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

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
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
    accessToken: text("access_token").notNull(),
    status: text("status").notNull(), // "active" | "error" | "revoked"
    lastCursor: text("last_cursor"),
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
