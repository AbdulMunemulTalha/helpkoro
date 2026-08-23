import { Inject, Injectable, type LoggerService } from '@nestjs/common';
import type { Logger } from 'pino';
import { PINO_LOGGER } from './logger.tokens';

/**
 * Adapts the shared pino logger to Nest's {@link LoggerService} so framework
 * logs and application logs share one structured stream (and the request-id
 * mixin). Registered via `app.useLogger(...)` and injectable for services.
 */
@Injectable()
export class AppLogger implements LoggerService {
  constructor(@Inject(PINO_LOGGER) private readonly logger: Logger) {}

  log(message: unknown, context?: unknown): void {
    this.logger.info({ context }, String(message));
  }

  error(message: unknown, stack?: unknown, context?: unknown): void {
    this.logger.error({ context: context ?? stack }, String(message));
  }

  warn(message: unknown, context?: unknown): void {
    this.logger.warn({ context }, String(message));
  }

  debug(message: unknown, context?: unknown): void {
    this.logger.debug({ context }, String(message));
  }

  verbose(message: unknown, context?: unknown): void {
    this.logger.trace({ context }, String(message));
  }
}
