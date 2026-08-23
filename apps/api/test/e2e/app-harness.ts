import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createApp } from '../../src/bootstrap';

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
