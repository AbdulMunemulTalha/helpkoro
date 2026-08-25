import { AsyncLocalStorage } from 'node:async_hooks';

/** Per-request state carried implicitly through the async call tree. */
export interface RequestContext {
  requestId: string;
  /** Authenticated user id, set by the auth guard once a request is identified. */
  userId?: string;
  /** Active session id, set by the auth guard. */
  sessionId?: string;
}

/**
 * Request-scoped storage. The Fastify `onRequest` hook is the single writer of
 * `requestId`: it resolves the correlation id and runs the rest of the request
 * inside `run()`. Loggers, the envelope interceptor, the exception filter, and
 * the audit service read the id back out via {@link getRequestId}. The auth
 * guard later augments the same store with the authenticated principal via
 * {@link setRequestPrincipal}.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** The current request's correlation id, or `undefined` outside a request. */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

/**
 * Attach the authenticated principal to the current request's store so log
 * lines can be correlated to a user/session without threading it through calls.
 * No-op outside a request. Never store secrets here — ids only.
 */
export function setRequestPrincipal(userId: string, sessionId: string): void {
  const store = requestContext.getStore();
  if (store) {
    store.userId = userId;
    store.sessionId = sessionId;
  }
}

/** The current request's authenticated principal ids, if identified. */
export function getRequestPrincipal(): { userId?: string; sessionId?: string } {
  const store = requestContext.getStore();
  return { userId: store?.userId, sessionId: store?.sessionId };
}

// Surface `request.requestId` on the Fastify request for handlers that read it
// directly (interceptor/filter) without reaching into async storage.
declare module 'fastify' {
  interface FastifyRequest {
    requestId?: string;
  }
}
