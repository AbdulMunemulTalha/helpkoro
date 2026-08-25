import { Body, Controller, Delete, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  AppError,
  isUuid,
  roleAssignmentInputSchema,
  type PublicUser,
  type RoleAssignmentInput,
} from '@helpkoro/contracts';
import { isRole, PERMISSIONS, ROLES, type Role } from '@helpkoro/domain';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RequirePermission } from './auth.decorators';
import { UsersService } from './users.service';

/**
 * Administrative role management (`/v1/admin/users/:userId/roles`). Both routes
 * require the `user_role` permission — administrator only, plus a fresh step-up
 * session (enforced by the authorization guard) — and emit an audit event, per
 * identity-access-and-security.md's staff-role-change rule. Every mutation
 * returns the target user's current public view so the client stays in sync.
 */
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  @RequirePermission(PERMISSIONS.USER_ROLE_ASSIGN.resource, PERMISSIONS.USER_ROLE_ASSIGN.action)
  @HttpCode(200)
  @Post(':userId/roles')
  async assignRole(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(roleAssignmentInputSchema)) body: RoleAssignmentInput,
    @Req() request: FastifyRequest,
  ): Promise<PublicUser> {
    const principal = this.requirePrincipal(request);
    const role = this.parseRole(body.role);
    await this.requireExistingUser(userId);

    const added = await this.users.assignRole(userId, role, principal.userId);
    await this.audit.record({
      action: 'user.role_assigned',
      entityType: 'user',
      entityId: userId,
      actorType: 'user',
      actorId: principal.userId,
      sourceSessionId: principal.sessionId,
      reason: role,
      afterSummary: { role, added },
    });
    return this.publicUserOrThrow(userId);
  }

  @RequirePermission(PERMISSIONS.USER_ROLE_REVOKE.resource, PERMISSIONS.USER_ROLE_REVOKE.action)
  @Delete(':userId/roles/:role')
  async revokeRole(
    @Param('userId') userId: string,
    @Param('role') roleParam: string,
    @Req() request: FastifyRequest,
  ): Promise<PublicUser> {
    const principal = this.requirePrincipal(request);
    const role = this.parseRole(roleParam);
    await this.requireExistingUser(userId);

    // Prevent an administrator from removing their own administrator role and
    // potentially locking the platform out of role management.
    if (role === ROLES.ADMINISTRATOR && userId === principal.userId) {
      throw new AppError('STATE_CONFLICT', 'You cannot revoke your own administrator role.');
    }

    const removed = await this.users.revokeRole(userId, role);
    await this.audit.record({
      action: 'user.role_revoked',
      entityType: 'user',
      entityId: userId,
      actorType: 'user',
      actorId: principal.userId,
      sourceSessionId: principal.sessionId,
      reason: role,
      afterSummary: { role, removed },
    });
    return this.publicUserOrThrow(userId);
  }

  // --- helpers --------------------------------------------------------------

  private requirePrincipal(request: FastifyRequest) {
    const principal = request.principal;
    if (!principal) {
      throw new AppError('AUTH_REQUIRED', 'Authentication required.');
    }
    return principal;
  }

  private parseRole(value: string): Role {
    if (!isRole(value)) {
      throw new AppError('VALIDATION_FAILED', 'Unknown role.', {
        fields: [{ path: 'role', message: 'must be a known platform role' }],
      });
    }
    return value;
  }

  private async requireExistingUser(userId: string): Promise<void> {
    if (!isUuid(userId)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid user id.', {
        fields: [{ path: 'userId', message: 'must be a valid id' }],
      });
    }
    const user = await this.users.findById(userId);
    if (!user) {
      throw new AppError('VALIDATION_FAILED', 'The specified user does not exist.', {
        fields: [{ path: 'userId', message: 'user not found' }],
      });
    }
  }

  private async publicUserOrThrow(userId: string): Promise<PublicUser> {
    const user = await this.users.getPublicUser(userId);
    if (!user) {
      throw new AppError('INTERNAL', 'User disappeared during role update.');
    }
    return user;
  }
}
