import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool, neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { getServerEnvironment } from "../src/server/env";

const databaseUrl = getServerEnvironment().databaseUrl;

type JournalEntry = {
  idx: number;
  tag: string;
};

type MigrationJournal = {
  entries: JournalEntry[];
};

function loadExpectedMigrationTags(): string[] {
  const journalPath = resolve(process.cwd(), "drizzle/meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as MigrationJournal;
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    throw new Error(`Migration journal is empty or invalid: ${journalPath}`);
  }

  return [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .map((entry) => entry.tag);
}

async function readAppliedMigrationCount(databaseUrl: string) {
  const sql = neon(databaseUrl);
  const rows = (await sql.query(
    `select id
     from drizzle.__drizzle_migrations
     order by created_at asc, id asc`,
  )) as Array<{ id: number }>;

  return rows.length;
}

async function migrateDatabase() {
  const expectedTags = loadExpectedMigrationTags();
  const latestExpectedTag = expectedTags[expectedTags.length - 1];

  console.log(`Applying pending migrations from ./drizzle (latest expected: ${latestExpectedTag})...`);

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }

  let appliedCount: number;
  try {
    appliedCount = await readAppliedMigrationCount(databaseUrl!);
  } catch (error) {
    console.error("Migrations ran, but the drizzle.__drizzle_migrations journal could not be read.");
    console.error(error);
    process.exit(1);
  }

  if (appliedCount < expectedTags.length) {
    console.error(
      `Migration journal is incomplete: expected at least ${expectedTags.length} applied migrations, found ${appliedCount}.`,
    );
    console.error(`Expected latest tag: ${latestExpectedTag}`);
    process.exit(1);
  }

  console.log(`Applied migrations in journal: ${appliedCount}`);
  console.log(`Repository expects ${expectedTags.length} migration files through ${latestExpectedTag}.`);
  console.log("Database migrate complete.");
}

migrateDatabase().catch((error) => {
  console.error("Database migrate failed.");
  console.error(error);
  process.exit(1);
});
