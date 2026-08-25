import 'server-only';

import { cookies } from 'next/headers';
import { AppError, type StableErrorCode } from '@helpkoro/contracts';

import { env } from '@/env';

/**
 * Server-side BFF fetch (ADR-009). The API runs with no CORS and httpOnly auth
 * cookies, so the browser can never call it directly — every request is proxied
 * server-to-server from here. This module:
 *
 * - opts into the API's cookie transport (`x-auth-transport: cookie`), so tokens
 *   travel as cookies and never touch the client bundle;
 * - forwards the caller's cookies (read via `next/headers`) as the upstream
 *   `Cookie` header, so `hk_at` authenticates organizer reads;
 * - echoes the readable CSRF cookie in `x-csrf-token` on state-changing methods
 *   (double-submit; trivially satisfied server-to-server);
 * - unwraps the ADR-006 success envelope `{ data, meta }` and maps the error
 *   envelope `{ error }` back to a stable code — **preserving the true HTTP
 *   status**, which the code alone does not encode (a 404 carries
 *   `VALIDATION_FAILED`, whose default status is 400);
 * - never caches: every proxied read is per-request/SSR-dynamic.
 *
 * Reads use {@link apiFetch} (throws on error → error boundary). Callers that
 * must branch on status (e.g. detail 404 → `notFound()`) or persist rotated
 * cookies use {@link apiRequest} and inspect the discriminated result.
 */

/** Readable double-submit CSRF cookie (mirrors the API's `hk_csrf`). */
const CSRF_COOKIE = 'hk_csrf';
/** Header the CSRF cookie value is echoed in on unsafe methods. */
const CSRF_HEADER = 'x-csrf-token';
/** Methods that require the CSRF echo when a CSRF cookie is present. */
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface ApiRequestInit {
  method?: string;
  /** JSON-serialisable request body; presence sets `content-type: application/json`. */
  body?: unknown;
  /** Query parameters; `undefined`/empty values are omitted. */
  query?: Record<string, string | number | undefined>;
}

interface ApiResultBase {
  /** The upstream HTTP status, preserved verbatim (never inferred from the code). */
  status: number;
  /** Raw `Set-Cookie` values from the API, for a cookie-writable caller to persist. */
  setCookies: string[];
}

export type ApiFailure = ApiResultBase & {
  ok: false;
  error: { code: StableErrorCode; message: string; details?: unknown };
};

export type ApiResult<T> = (ApiResultBase & { ok: true; data: T }) | ApiFailure;

/** Read the caller's cookies for forwarding, plus the CSRF token if present. */
async function forwardedCookies(): Promise<{ header?: string; csrf?: string }> {
  const store = await cookies();
  const all = store.getAll();
  if (all.length === 0) return {};
  return {
    header: all.map((c) => `${c.name}=${c.value}`).join('; '),
    csrf: store.get(CSRF_COOKIE)?.value,
  };
}

function isEnvelope(value: unknown): value is { data: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value;
}

function extractError(
  parsed: unknown,
  status: number,
): { code: StableErrorCode; message: string; details?: unknown } {
  if (parsed && typeof parsed === 'object' && 'error' in parsed) {
    const error = (parsed as { error: { code: StableErrorCode; message: string; details?: unknown } })
      .error;
    return { code: error.code, message: error.message, details: error.details };
  }
  return {
    code: status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED',
    message: 'The request failed.',
  };
}

/** Low-level proxied request. Returns a discriminated result; only throws when the API is unreachable. */
export async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<ApiResult<T>> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = new URL(`/v1${path}`, env.API_URL);
  if (init.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const { header: cookieHeader, csrf } = await forwardedCookies();
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-auth-transport': 'cookie',
    'x-request-id': globalThis.crypto.randomUUID(),
  };
  if (cookieHeader) headers.cookie = cookieHeader;
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (UNSAFE_METHODS.has(method) && csrf) headers[CSRF_HEADER] = csrf;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    throw new AppError('INTERNAL', 'Could not reach the HelpKoro API.', {
      reason: 'UPSTREAM_UNREACHABLE',
    });
  }

  // `getSetCookie` exists on the runtime (undici) Headers; guard for type portability.
  const getSetCookie = (response.headers as { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(response.headers) : [];

  const raw = await response.text();
  let parsed: unknown;
  if (raw.length > 0) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        status: response.status,
        setCookies,
        error: { code: 'INTERNAL', message: 'The API returned an unreadable response.' },
      };
    }
  }

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      setCookies,
      data: (isEnvelope(parsed) ? parsed.data : parsed) as T,
    };
  }

  return { ok: false, status: response.status, setCookies, error: extractError(parsed, response.status) };
}

/** Proxied read that throws {@link AppError} on any non-2xx (surfaces via the error boundary). */
export async function apiFetch<T>(path: string, init?: ApiRequestInit): Promise<T> {
  const result = await apiRequest<T>(path, init);
  if (result.ok) return result.data;
  throw new AppError(result.error.code, result.error.message, result.error.details);
}
