import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getServerEnvironment } from "@/server/env";

const pool = new Pool({ connectionString: getServerEnvironment().databaseUrl });

export const db = drizzle(pool);
