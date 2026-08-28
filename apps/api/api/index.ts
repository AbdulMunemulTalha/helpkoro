// Vercel serverless entry for the HelpKoro API (NestJS on Fastify).
//
// Vercel treats every file under `api/` as a serverless function. The
// `vercel.json` beside this file rewrites ALL paths to `/api`, so this single
// function serves the whole app (health probes + the `/v1` surface).
//
// The Nest app is booted once per warm instance and cached in `appPromise`, so
// only a cold start pays the init cost.
//
// IMPORTANT: this imports the COMPILED app (`../dist/bootstrap`, produced by
// `nest build` / tsc during the Vercel build), not `../src`. NestJS DI relies on
// `emitDecoratorMetadata`, which Vercel's esbuild-based function bundler does not
// emit — importing source would silently break constructor injection. Importing
// the tsc output sidesteps that: the metadata is already baked into the JS. We
// import `bootstrap` (not `main`) so the process never calls `listen()` and never
// loads the OpenTelemetry auto-instrumentation, which would only add cold-start
// weight in a serverless runtime.
//
// DATABASE_URL should point at Supabase's transaction-mode pooler (port 6543);
// DatabaseModule detects that and switches postgres.js to a tiny, unprepared
// pool suited to many short-lived serverless instances.
import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
// NOTE: `../dist/bootstrap` is the tsc output produced by `nest build` during the
// Vercel build; it does not exist at lint/typecheck time and that is expected.
import { createApp } from '../dist/bootstrap';

let appPromise: Promise<NestFastifyApplication> | null = null;

async function bootstrap(): Promise<NestFastifyApplication> {
  const { app } = await createApp();
  await app.init();
  // Fastify must be `ready()` before its router can handle emitted requests.
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  appPromise ??= bootstrap();
  const app = await appPromise;
  // Hand the raw Node req/res to Fastify's router. Equivalent to a real inbound
  // connection, minus the listening socket (Vercel owns the socket).
  app.getHttpAdapter().getInstance().server.emit('request', req, res);
}
