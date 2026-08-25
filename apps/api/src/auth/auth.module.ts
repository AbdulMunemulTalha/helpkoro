import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { AdminUsersController } from './admin-users.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { AuthorizationGuard } from './guards/authorization.guard';
import { CsrfGuard } from './guards/csrf.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { MeController } from './me.controller';
import { PasswordService } from './password.service';
import { RateLimitService } from './rate-limit.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { UsersService } from './users.service';

/**
 * Authentication + authorization (ADR-005/006/007). Registers the four request
 * guards globally, in a deliberate order — every request passes through:
 *   1. {@link RateLimitGuard}     — throttle before any work (only decorated routes)
 *   2. {@link CsrfGuard}          — double-submit check for cookie clients
 *   3. {@link AuthGuard}          — verify the access token, attach the principal
 *   4. {@link AuthorizationGuard} — roles / policy matrix / step-up freshness
 * Global guards execute in registration order, so this array order is load-bearing.
 * DB/Redis/Config come from the global infra modules; audit is imported here.
 */
@Module({
  imports: [AuditModule],
  controllers: [AuthController, MeController, AdminUsersController],
  providers: [
    PasswordService,
    TokenService,
    UsersService,
    SessionService,
    RateLimitService,
    AuthService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: AuthorizationGuard },
  ],
  exports: [TokenService, UsersService, SessionService],
})
export class AuthModule {}
