import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, and } from "drizzle-orm";
import { categoryGroups, categories } from "../src/db/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not set.");

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

type CategoryDef = { name: string; defaultBudgetable?: boolean };
type GroupDef = { name: string; sortOrder: number; categories: CategoryDef[] };

const TAXONOMY: GroupDef[] = [
  {
    name: "Income", sortOrder: 0,
    categories: [
      { name: "Paycheck", defaultBudgetable: false },
      { name: "Other Income", defaultBudgetable: false },
    ],
  },
  {
    name: "Essentials", sortOrder: 1,
    categories: [
      { name: "Groceries" },
      { name: "Rent & Utilities" },
      { name: "Transportation" },
      { name: "Gas" },
      { name: "Healthcare" },
      { name: "Insurance" },
    ],
  },
  {
    name: "Lifestyle", sortOrder: 2,
    categories: [
      { name: "Restaurants" },
      { name: "Entertainment" },
      { name: "Shopping" },
      { name: "Subscriptions" },
      { name: "Personal Care" },
      { name: "Travel" },
    ],
  },
  {
    name: "Financial", sortOrder: 3,
    categories: [
      { name: "Loan Payments" },
      { name: "Credit Card Payment", defaultBudgetable: false },
      { name: "Bank Fees" },
    ],
  },
  {
    name: "Transfers", sortOrder: 4,
    categories: [{ name: "Transfer", defaultBudgetable: true }],
  },
  {
    name: "Other", sortOrder: 5,
    categories: [{ name: "Uncategorized", defaultBudgetable: false }],
  },
];

async function seedCategories() {
  console.log("Seeding category groups and categories...");
  for (const group of TAXONOMY) {
    const existing = await db
      .select({ id: categoryGroups.id })
      .from(categoryGroups)
      .where(eq(categoryGroups.name, group.name))
      .limit(1);

    let groupId: string;
    if (existing.length > 0) {
      groupId = existing[0].id;
      console.log(`  Group "${group.name}" already exists`);
    } else {
      const [inserted] = await db
        .insert(categoryGroups)
        .values({ name: group.name, sortOrder: group.sortOrder })
        .returning({ id: categoryGroups.id });
      groupId = inserted.id;
      console.log(`  Created group "${group.name}"`);
    }

    for (let i = 0; i < group.categories.length; i++) {
      const cat = group.categories[i];
      const existingCat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.groupId, groupId), eq(categories.name, cat.name)))
        .limit(1);

      if (existingCat.length > 0) {
        console.log(`    Category "${cat.name}" already exists`);
      } else {
        await db.insert(categories).values({
          groupId,
          name: cat.name,
          defaultBudgetable: cat.defaultBudgetable ?? true,
          sortOrder: i,
        });
        console.log(`    Created category "${cat.name}"`);
      }
    }
  }
  console.log("Seeding complete.");
  await pool.end();
}

seedCategories().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
