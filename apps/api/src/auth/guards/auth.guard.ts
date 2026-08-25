import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AppError } from '@helpkoro/contracts';
import { isRole, type Role } from '@helpkoro/domain';
import { setRequestPrincipal } from '../../common/request-context';
import { ACCESS_COOKIE } from '../auth.constants';
import { IS_PUBLIC_KEY } from '../auth.decorators';
import { TokenService } from '../token.service';

/** Read a Bearer access token from the Authorization header, if present. */
function bearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : undefined;
}

/**
 * Authenticates requests from a verified access token (ADR-005). Accepts the
 * token from `Authorization: Bearer` (API/mobile) or the httpOnly access cookie
 * (web). Verification is stateless — no DB round-trip — so ordinary reads stay
 * cheap; session-revocation-sensitive actions re-check the session in the
 * authorization guard. Routes marked `@Public` skip authentication entirely.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = bearerToken(request) ?? request.cookies?.[ACCESS_COOKIE];
    if (!token) {
      throw new AppError('AUTH_REQUIRED', 'Authentication required.');
    }

    const claims = await this.tokens.verifyAccessToken(token);
    const roles: Role[] = claims.roles.filter(isRole);
    request.principal = {
      userId: claims.sub,
      sessionId: claims.sid,
      roles,
      stepUpAt: claims.sua,
    };
    setRequestPrincipal(claims.sub, claims.sid);
    return true;
  }
}
