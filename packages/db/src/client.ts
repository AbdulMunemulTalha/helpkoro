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
 */
export function createDatabase(
  connectionString: string,
  options: { max?: number } = {},
): DatabaseHandle {
  const sql = postgres(connectionString, { max: options.max ?? 10 });
  const db = drizzle(sql, { schema });
  return { db, sql, close: () => sql.end() };
}
