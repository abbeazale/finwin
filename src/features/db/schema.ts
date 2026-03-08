import { integer, pgTable, varchar , date} from "drizzle-orm/pg-core";

//unique index on email 
export const usersTable = pgTable("users", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    fristname: varchar({ length: 255 }).notNull(),
    lastname: varchar({ length: 255 }).notNull(),
    age: integer().notNull(),
    auth_provider: varchar({ length: 255 }).notNull(),
    auth_provider_id: varchar({ length: 255 }).notNull(),
    currency: varchar({length: 255}).notNull().default("CAD"),
    timezone: varchar({length: 255}).notNull().default("America/Toronto"),
    email: varchar({ length: 255 }).notNull().unique(),
    created_at: date().notNull().defaultNow(),
});


export const categoryGroupsTable = pgTable("category_groups", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    sort_order: integer().notNull()
})

//unique index groupid and name
export const categoriesTable = pgTable("categories", {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    name: varchar({ length: 255 }).notNull(),
    group_id: integer().notNull().references(() => categoryGroupsTable.id),
    sort_order: integer().notNull(),
    
})