import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { Logger } from 'pino';
import { AppLogger } from './app-logger.service';
import { PINO_LOGGER } from './logger.tokens';

/**
 * Global logger module. The pino instance is created in the composition root
 * (so it can also be handed to the Fastify adapter) and injected here as a
 * value, keeping a single logger across framework and application code.
 */
@Global()
@Module({})
export class LoggerModule {
  static forRoot(logger: Logger): DynamicModule {
    return {
      module: LoggerModule,
      providers: [{ provide: PINO_LOGGER, useValue: logger }, AppLogger],
      exports: [PINO_LOGGER, AppLogger],
    };
  }
}
