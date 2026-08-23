import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseHandle } from '@helpkoro/db';
import { DATABASE } from '../infra/database.module';

/**
 * Reads DB-backed feature flags for staged rollouts. A missing flag is treated
 * as disabled — flags must be explicitly enabled to take effect (fail-closed).
 */
@Injectable()
export class FeatureFlagsService {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  async isEnabled(key: string): Promise<boolean> {
    const flag = await this.handle.db.query.featureFlags.findFirst({
      where: (flags, { eq }) => eq(flags.key, key),
      columns: { enabled: true },
    });
    return flag?.enabled ?? false;
  }
}
