import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AppError } from '@helpkoro/contracts';
import { platformAuthorizer, type Role } from '@helpkoro/domain';
import { ConfigService } from '../../config/config.service';
import {
  IS_PUBLIC_KEY,
  PERMISSION_KEY,
  ROLES_KEY,
  type RequiredPermission,
} from '../auth.decorators';
import { SessionService } from '../session.service';

/**
 * Authorization (ADR-006 / authorization-model.md). Runs after {@link AuthGuard}
 * and enforces, in order: `@Roles` (holds one of N roles) and
 * `@RequirePermission` (the domain policy matrix by role/ownership/state). When
 * the matched policy rule is step-up-sensitive, the *session's* step-up
 * timestamp is re-checked against the DB (authoritative — this also rejects a
 * revoked session), not merely the token claim. Routes with neither annotation
 * require only authentication (already enforced upstream).
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = request.principal;
    if (!principal) {
      throw new AppError('AUTH_REQUIRED', 'Authentication required.');
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const holds = principal.roles.some((r) => requiredRoles.includes(r));
      if (!holds) {
        throw new AppError('FORBIDDEN', 'You do not have access to this resource.', {
          reason: 'ROLE_NOT_PERMITTED',
        });
      }
    }

    const permission = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permission) {
      const decision = platformAuthorizer({
        roles: principal.roles,
        resource: permission.resource,
        action: permission.action,
        actorId: principal.userId,
        resourceOwnerId: permission.self ? principal.userId : undefined,
      });
      if (decision.effect === 'deny') {
        throw new AppError('FORBIDDEN', 'You do not have access to this resource.', {
          reason: decision.reason,
        });
      }
      if (decision.requiresStepUp) {
        await this.assertFreshStepUp(principal.sessionId);
      }
    }

    return true;
  }

  /** Confirm the session is active and stepped-up within the configured window. */
  private async assertFreshStepUp(sessionId: string): Promise<void> {
    const session = await this.sessions.getActive(sessionId);
    if (!session) {
      throw new AppError('AUTH_REQUIRED', 'Session is no longer active.');
    }
    const windowSeconds = this.config.get('AUTH_STEP_UP_WINDOW_SECONDS');
    const fresh =
      session.stepUpAt !== null &&
      (Date.now() - session.stepUpAt.getTime()) / 1000 <= windowSeconds;
    if (!fresh) {
      throw new AppError('FORBIDDEN', 'Step-up authentication required for this action.', {
        reason: 'STEP_UP_REQUIRED',
      });
    }
  }
}
