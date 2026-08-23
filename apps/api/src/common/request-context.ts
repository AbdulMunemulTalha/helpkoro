import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request state carried implicitly through the async call tree. */
export interface RequestContext {
  requestId: string;
}

/**
 * Request-scoped storage. The Fastify `onRequest` hook is the single writer: it
 * resolves the correlation id and runs the rest of the request inside `run()`.
 * Loggers, the envelope interceptor, the exception filter, and the audit service
 * read the id back out via {@link getRequestId}.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** The current request's correlation id, or `undefined` outside a request. */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

// Surface `request.requestId` on the Fastify request for handlers that read it
// directly (interceptor/filter) without reaching into async storage.
declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
  }
}
