import { timingSafeEqual } from 'node:crypto';
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AppError } from '@helpkoro/contracts';
import { CSRF_COOKIE, CSRF_HEADER, UNSAFE_METHODS } from '../auth.constants';

/** Constant-time string comparison that first guards on length. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * CSRF protection for cookie-authenticated requests (ADR-006 §9, double-submit).
 * Applies to any state-changing method that carries the CSRF cookie: the
 * `x-csrf-token` header must match the cookie value. Bearer-only clients never
 * send the cookie and are unaffected; first-contact requests (login/register,
 * before any cookie is set) are likewise skipped. Runs regardless of `@Public`.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (!UNSAFE_METHODS.has(request.method)) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE];
    if (!cookieToken) return true; // No cookie transport in use → nothing to protect.

    const headerValue = request.headers[CSRF_HEADER];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!headerToken || !safeEqual(headerToken, cookieToken)) {
      throw new AppError('FORBIDDEN', 'CSRF token missing or invalid.', {
        reason: 'CSRF_FAILED',
      });
    }
    return true;
  }
}
