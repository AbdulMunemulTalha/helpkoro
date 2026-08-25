/**
 * Auth transport constants (ADR-006 §9 hybrid cookie/Bearer, ADR-007).
 *
 * Two transports are supported simultaneously:
 * - API/mobile clients send `Authorization: Bearer <access>` and refresh with
 *   the refresh token in the request body.
 * - First-party web/operations apps use httpOnly cookies for the access and
 *   refresh tokens plus a readable double-submit CSRF cookie.
 */

/** httpOnly access-token cookie (short-lived). */
export const ACCESS_COOKIE = 'hk_at';
/** httpOnly refresh-token cookie, scoped to the auth routes. */
export const REFRESH_COOKIE = 'hk_rt';
/** Readable (non-httpOnly) CSRF token cookie for the double-submit check. */
export const CSRF_COOKIE = 'hk_csrf';
/** Header a cookie-authenticated client must echo the CSRF cookie value in. */
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Opt-in signal for the cookie transport. API/mobile clients omit it and receive
 * tokens only in the response body (Bearer); first-party web clients send
 * `x-auth-transport: cookie` to also receive the httpOnly cookie set.
 */
export const AUTH_TRANSPORT_HEADER = 'x-auth-transport';
export const AUTH_TRANSPORT_COOKIE = 'cookie';

/** Refresh-cookie path — narrows the cookie to the endpoints that consume it. */
export const REFRESH_COOKIE_PATH = '/v1/auth';

/** JWT issuer/audience claims — verified on every access token. */
export const TOKEN_ISSUER = 'helpkoro';
export const TOKEN_AUDIENCE = 'helpkoro-api';

/** HTTP methods that mutate state and therefore require CSRF protection. */
export const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
