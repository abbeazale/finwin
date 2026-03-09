import "dotenv/config";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || typeof databaseUrl !== "string") {
  throw new Error("DATABASE_URL is not set.");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to reset the database in production.");
}

async function resetDatabase() {
  if (!databaseUrl || typeof databaseUrl !== "string") {
    throw new Error("DATABASE_URL is not set.");
  }
  const sql = neon(databaseUrl);

  console.log("Dropping public schema...");
  await sql.query("drop schema if exists public cascade;");

  console.log("Recreating public schema...");
  await sql.query("create schema public;");

  console.log("Applying migrations...");
  const db = drizzle(databaseUrl);
  await migrate(db, {
    migrationsFolder: "./drizzle",
  });

  console.log("Database reset complete.");
}

resetDatabase().catch((error) => {
  console.error("Database reset failed.");
  console.error(error);
  process.exit(1);
});
