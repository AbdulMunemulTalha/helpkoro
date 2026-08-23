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

const databaseProvider: FactoryProvider<DatabaseHandle> = {
  provide: DATABASE,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => createDatabase(config.get('DATABASE_URL')),
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
