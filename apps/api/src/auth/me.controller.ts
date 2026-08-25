import { Controller, Get, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AppError, type PublicUser } from '@helpkoro/contracts';
import { PERMISSIONS } from '@helpkoro/domain';
import { RequirePermission } from './auth.decorators';
import { UsersService } from './users.service';

/**
 * The authenticated user's own profile (`GET /v1/me`). Enforced through the
 * `user:read_self` policy rule with `self` ownership (the principal is the
 * resource owner), so it exercises the same authorization path as every other
 * route rather than a bespoke check.
 */
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @RequirePermission(PERMISSIONS.USER_READ_SELF.resource, PERMISSIONS.USER_READ_SELF.action, {
    self: true,
  })
  @Get()
  async me(@Req() request: FastifyRequest): Promise<PublicUser> {
    const principal = request.principal;
    if (!principal) {
      throw new AppError('AUTH_REQUIRED', 'Authentication required.');
    }
    const user = await this.users.getPublicUser(principal.userId);
    if (!user) {
      throw new AppError('AUTH_REQUIRED', 'This account no longer exists.');
    }
    return user;
  }
}
