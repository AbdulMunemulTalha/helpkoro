import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Redis } from 'ioredis';
import { createApp } from '../../src/bootstrap';
import { REDIS } from '../../src/infra/redis.module';

/**
 * Boot the real application for e2e tests. Uses `app.init()` + Fastify `ready()`
 * (no network port) so requests are driven via `app.inject`. Requires live
 * PostgreSQL + Redis (provided by CI / `pnpm services:up`).
 */
export async function buildTestApp(): Promise<NestFastifyApplication> {
  const { app } = await createApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/**
 * Clear all fixed-window rate-limit counters (`rl:*`). Every `app.inject`
 * request shares the same client IP, so login/register/etc. counters otherwise
 * accumulate across the serially-run suite and would make unrelated tests flaky.
 * Call in `beforeEach` so each test starts from a clean window; the dedicated
 * rate-limit test fires all its requests within a single `it` (unaffected).
 */
export async function flushRateLimitKeys(app: NestFastifyApplication): Promise<void> {
  const redis = app.get<Redis>(REDIS);
  const keys = await redis.keys('rl:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
