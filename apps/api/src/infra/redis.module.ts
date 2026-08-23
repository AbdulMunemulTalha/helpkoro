import {
  Global,
  Inject,
  Module,
  type FactoryProvider,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '../config/config.service';

/** DI token for the shared ioredis client. */
export const REDIS = Symbol('REDIS');

const redisProvider: FactoryProvider<Redis> = {
  provide: REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    // Lazy connect: the client dials on first command (e.g. the readiness ping),
    // so boot never blocks on Redis being reachable.
    new Redis(config.get('REDIS_URL'), { lazyConnect: true, maxRetriesPerRequest: 2 }),
};

/** Global Redis module; the client is quit on graceful shutdown. */
@Global()
@Module({
  providers: [redisProvider],
  exports: [redisProvider],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}
