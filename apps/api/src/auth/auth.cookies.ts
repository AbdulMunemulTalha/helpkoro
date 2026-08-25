import { randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';

/**
 * Cookie transport for first-party web/operations clients (ADR-006 §9). Access
 * and refresh tokens are httpOnly (unreadable by JS); the refresh cookie is
 * path-scoped to `/v1/auth` so it is only ever sent to the auth endpoints. A
 * separate, readable CSRF cookie backs the double-submit check enforced by
 * `CsrfGuard`. `SameSite=Lax` blocks the cookie on cross-site POSTs while still
 * allowing top-level navigations. Only set when the client opts into the cookie
 * transport (see `AuthController.wantsCookies`).
 */
export interface CookieSettings {
  secure: boolean;
  domain?: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export function setAuthCookies(
  reply: FastifyReply,
  tokens: { accessToken: string; refreshToken: string },
  settings: CookieSettings,
): void {
  const { secure, domain } = settings;
  reply.setCookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    domain,
    sameSite: 'lax',
    path: '/',
    maxAge: settings.accessTtlSeconds,
  });
  reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    domain,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: settings.refreshTtlSeconds,
  });
  reply.setCookie(CSRF_COOKIE, randomBytes(32).toString('hex'), {
    httpOnly: false,
    secure,
    domain,
    sameSite: 'lax',
    path: '/',
    maxAge: settings.refreshTtlSeconds,
  });
}

/** Refresh just the access-token cookie (step-up / password change). */
export function setAccessCookie(
  reply: FastifyReply,
  accessToken: string,
  settings: CookieSettings,
): void {
  reply.setCookie(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: settings.secure,
    domain: settings.domain,
    sameSite: 'lax',
    path: '/',
    maxAge: settings.accessTtlSeconds,
  });
}

export function clearAuthCookies(reply: FastifyReply, settings: CookieSettings): void {
  const { secure, domain } = settings;
  reply.clearCookie(ACCESS_COOKIE, { secure, domain, sameSite: 'lax', path: '/' });
  reply.clearCookie(REFRESH_COOKIE, { secure, domain, sameSite: 'lax', path: REFRESH_COOKIE_PATH });
  reply.clearCookie(CSRF_COOKIE, { secure, domain, sameSite: 'lax', path: '/' });
}
