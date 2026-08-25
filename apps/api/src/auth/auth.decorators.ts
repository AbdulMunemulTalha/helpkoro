import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { Role } from '@helpkoro/domain';
import type { AuthenticatedPrincipal } from './auth.types';

/** Marks a route (or controller) as not requiring authentication. */
export const IS_PUBLIC_KEY = 'auth:isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

/** Requires the actor to hold at least one of the listed roles. */
export const ROLES_KEY = 'auth:roles';
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** A permission target checked against the domain policy matrix. */
export interface RequiredPermission {
  resource: string;
  action: string;
  /** When true, the target resource is owned by the principal themselves (e.g.
   * `/v1/me`) — the guard supplies `resourceOwnerId = principal.userId`. */
  self?: boolean;
}
export const PERMISSION_KEY = 'auth:permission';
export const RequirePermission = (
  resource: string,
  action: string,
  options?: { self?: boolean },
): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSION_KEY, { resource, action, self: options?.self ?? false });

/** Per-route rate-limit policy (fixed window, keyed by client ip + name). */
export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** Stable name segment for the Redis key (defaults to the route path). */
  name?: string;
}
export const RATE_LIMIT_KEY = 'auth:rateLimit';
export const RateLimit = (options: RateLimitOptions): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);

/** Injects the authenticated principal (or `undefined` on public routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    return request.principal;
  },
);
