import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
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
