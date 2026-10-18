import { SQL } from "bun";
import { config } from "./config";

export const sql = new SQL({ url: config.databaseUrl(), bigint: true });

export async function migrate() {
  const schema = await Bun.file(new URL("./schema.sql", import.meta.url)).text();
  await sql.unsafe(schema);
}
