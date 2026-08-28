import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type AppDatabase = PostgresJsDatabase<typeof schema>;

export interface DatabaseHandle {
  db: AppDatabase;
  sql: postgres.Sql;
  close: () => Promise<void>;
}

/**
 * Create a Drizzle database handle over a postgres.js connection pool. Callers
 * own the lifecycle and must `close()` on shutdown. Migrations use `max: 1`.
 *
 * `prepare: false` is required when connecting through a transaction-mode
 * connection pooler (Supabase's port-6543 pooler / PgBouncer), which does not
 * support the prepared-statement protocol. Leave it on (the default) for a
 * direct Postgres connection so the query planner can cache plans.
 */
export function createDatabase(
  connectionString: string,
  options: { max?: number; prepare?: boolean } = {},
): DatabaseHandle {
  const sql = postgres(connectionString, {
    max: options.max ?? 10,
    // postgres.js only accepts `prepare: false`; when prepared statements are
    // fine we simply omit the flag and take the library default (on).
    ...(options.prepare === false ? { prepare: false } : {}),
  });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end() };
}
