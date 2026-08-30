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
//
// REQUEST BRIDGE: we drive Fastify with `app.inject()` and copy the buffered
// result onto Vercel's `res`, rather than the fire-and-forget
// `server.emit('request', req, res)` pattern. `emit` returns immediately and
// relies on Fastify to finalise Vercel's response shim; that works for plain
// JSON but a response carrying `Set-Cookie` headers (cookie-transport auth:
// register/login/refresh) never finalises there, so `res.end()` never fires,
// the invocation hangs to its max duration, and — with no `functions.maxDuration`
// tuning — stacked hangs starve the single function until even `/health` times
// out. `inject` is the exact path the `auth cookie transport + CSRF` e2e suite
// exercises, so it is proven to serialise these cookies correctly; buffering its
// result and calling `res.end()` ourselves makes finalisation deterministic.
import 'reflect-metadata';
import type { IncomingMessage, OutgoingHttpHeaders, ServerResponse } from 'node:http';
import type { HTTPMethods } from 'fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
// NOTE: `../dist/bootstrap` is the tsc output produced by `nest build` during the
// Vercel build; it does not exist at lint/typecheck time and that is expected.
import { createApp } from '../dist/bootstrap';

let appPromise: Promise<NestFastifyApplication> | null = null;

async function bootstrap(): Promise<NestFastifyApplication> {
  const { app } = await createApp();
  await app.init();
  // Fastify must be `ready()` before its router can handle injected requests.
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

/** Buffer the raw request body so it can be replayed verbatim through `inject`. */
async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await (appPromise ??= bootstrap());
  try {
    const response = await app.inject({
      method: (req.method ?? 'GET') as HTTPMethods,
      url: req.url ?? '/',
      headers: req.headers,
      payload: await readBody(req),
    });
    // `response.headers['set-cookie']` is an array when several cookies are set;
    // `writeHead` emits one `Set-Cookie` line per array element.
    res.writeHead(response.statusCode, response.headers as OutgoingHttpHeaders);
    res.end(response.rawPayload);
  } catch {
    // A bridge failure must still finalise the response — never leave Vercel
    // holding an open invocation (that is the very hang this entry avoids).
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"error":{"code":"INTERNAL","message":"Request bridge failure"}}');
  }
}
