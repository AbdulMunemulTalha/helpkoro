import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` reads ./src/schema.ts and emits SQL into ./drizzle
// without needing a live database. The credentials below are only used by
// `push`/`studio`/`migrate` tooling.
export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://helpkoro:helpkoro@localhost:5432/helpkoro',
  },
  strict: true,
  verbose: true,
});
