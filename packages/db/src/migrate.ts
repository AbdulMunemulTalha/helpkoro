import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { apiEnvSchema, parseEnv } from '@helpkoro/contracts';
import { createDatabase } from './client';

/** Apply all pending migrations from ./drizzle, then exit. Run via `pnpm migrate`. */
async function main(): Promise<void> {
  const env = parseEnv(apiEnvSchema);
  const { db, close } = createDatabase(env.DATABASE_URL, { max: 1 });
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  try {
    await migrate(db, { migrationsFolder });
    console.log('migrations applied');
  } finally {
    await close();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
