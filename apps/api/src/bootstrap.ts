import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import type { IncomingMessage } from 'node:http';
import { apiEnvSchema, isUuid, parseEnv, uuidv7, type ApiEnv } from '@helpkoro/contracts';
import { AppModule } from './app.module';
import { createRequestIdHook } from './common/hooks/request-id.hook';
import { AppLogger } from './common/logger/app-logger.service';
import { createLogger } from './common/logger/logger';

export interface CreatedApp {
  app: NestFastifyApplication;
  env: ApiEnv;
}

/**
 * Build and configure the Nest + Fastify application, but do not listen.
 * Shared by `main.ts` (which then listens) and the e2e harness (which uses
 * `app.inject`), so the wiring is identical in production and tests.
 */
export async function createApp(): Promise<CreatedApp> {
  const env = parseEnv(apiEnvSchema);
  const logger = createLogger(env);
  const headerName = env.REQUEST_ID_HEADER.toLowerCase();

  const adapter = new FastifyAdapter({
    loggerInstance: logger,
    // In production the API runs behind a platform proxy (Vercel). Trust the
    // `X-Forwarded-*` headers so `request.ip` is the real client address, which
    // the auth rate limiter keys on (rate-limit.guard.ts). Without this every
    // request would share the proxy's IP and collapse into one global bucket.
    // Left off in dev/test where there is no proxy and the socket is authoritative.
    // NOTE (hardening): `true` trusts the whole forwarded chain; pin the hop count
    // once Vercel's proxy topology is confirmed so `X-Forwarded-For` can't be spoofed.
    trustProxy: env.NODE_ENV === 'production',
    // The canonical correlation id: honour a valid inbound header, else mint a
    // fresh UUIDv7. This becomes `request.id`; the onRequest hook propagates it.
    genReqId(req: IncomingMessage): string {
      const inbound = req.headers[headerName];
      const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
      return candidate && isUuid(candidate) ? candidate : uuidv7();
    },
  });
  adapter.getInstance().addHook('onRequest', createRequestIdHook(headerName));

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot({ logger }),
    adapter,
    { bufferLogs: true },
  );

  app.useLogger(app.get(AppLogger));
  app.flushLogs();
  // Cookie transport for the hybrid auth model (ADR-006 §9): parses request
  // cookies and enables reply.setCookie/clearCookie. Tokens are self-contained
  // JWTs and the CSRF token is random, so no cookie signing secret is needed.
  await app.register(fastifyCookie);
  // Business routes live under /v1; health probes stay unversioned (ADR-006).
  app.setGlobalPrefix('v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.enableShutdownHooks();

  return { app, env };
}
