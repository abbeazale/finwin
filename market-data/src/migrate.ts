import { migrate, sql } from "./db";

await migrate();
await sql.close();
console.log("Market-data schema is up to date.");
