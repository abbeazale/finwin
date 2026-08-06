import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, and } from "drizzle-orm";
import { categoryGroups, categories } from "../src/db/schema";
import { CATEGORY_TAXONOMY } from "../src/server/lib/category-taxonomy";
import { getServerEnvironment } from "../src/server/env";

const databaseUrl = getServerEnvironment().databaseUrl;

const pool = new Pool({ connectionString: databaseUrl });
const db = drizzle(pool);

async function seedCategories() {
  console.log("Seeding category groups and categories...");
  for (const group of CATEGORY_TAXONOMY) {
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
