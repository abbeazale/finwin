import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { getServerEnvironment } from './src/server/env';

const env = getServerEnvironment();

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: env.databaseUrl,
  },
});
