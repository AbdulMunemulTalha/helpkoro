import {
  Global,
  Inject,
  Module,
  type FactoryProvider,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { createDatabase, type DatabaseHandle } from '@helpkoro/db';
import { ConfigService } from '../config/config.service';

/** DI token for the shared {@link DatabaseHandle} (Drizzle + postgres-js pool). */
export const DATABASE = Symbol('DATABASE');

/**
 * Supabase's transaction-mode pooler (used for serverless/Vercel deploys) speaks
 * on port 6543 and/or advertises `pgbouncer=true`. It does not support prepared
 * statements, and each serverless instance should hold only a tiny pool so many
 * concurrent instances don't exhaust the database's connection slots. A direct
 * connection (local dev, a long-running host) gets the normal pool + prepares.
 */
function poolOptionsFor(url: string): { max?: number; prepare?: boolean } {
  const usesTransactionPooler = url.includes('pgbouncer=true') || /:6543(?![0-9])/.test(url);
  return usesTransactionPooler ? { max: 1, prepare: false } : {};
}

const databaseProvider: FactoryProvider<DatabaseHandle> = {
  provide: DATABASE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const url = config.get('DATABASE_URL');
    return createDatabase(url, poolOptionsFor(url));
  },
};

/**
 * Global database module. postgres-js connects lazily on first query, so the
 * pool is created at boot without requiring the DB to be up; the connection is
 * closed on graceful shutdown.
 */
@Global()
@Module({
  providers: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  async onApplicationShutdown(): Promise<void> {
    await this.handle.close();
  }
}
