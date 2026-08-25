import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  AppError,
  changePasswordInputSchema,
  loginInputSchema,
  refreshInputSchema,
  registerInputSchema,
  stepUpInputSchema,
  type AuthResult,
  type ChangePasswordInput,
  type LoginInput,
  type RefreshInput,
  type RegisterInput,
  type StepUpInput,
} from '@helpkoro/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ConfigService } from '../config/config.service';
import { AUTH_TRANSPORT_COOKIE, AUTH_TRANSPORT_HEADER, REFRESH_COOKIE } from './auth.constants';
import {
  clearAuthCookies,
  setAccessCookie,
  setAuthCookies,
  type CookieSettings,
} from './auth.cookies';
import { Public, RateLimit } from './auth.decorators';
import { AuthService, type AccessTokenResponse } from './auth.service';

/**
 * Authentication endpoints under `/v1/auth` (ADR-005/006/007). All success
 * responses carry the tokens in the body for Bearer clients; clients that send
 * `x-auth-transport: cookie` additionally get the httpOnly cookie set. Sensitive
 * routes are rate-limited by IP. register/login/refresh/logout are `@Public`
 * (they establish or clear a session); step-up and change-password require an
 * authenticated principal (enforced by the global guards).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 3600, name: 'auth.register' })
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerInputSchema)) body: RegisterInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResult> {
    const result = await this.auth.register(body);
    this.applyTransport(request, reply, result.tokens);
    return result;
  }

  @Public()
  @RateLimit({ limit: 10, windowSeconds: 900, name: 'auth.login' })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginInputSchema)) body: LoginInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResult> {
    const result = await this.auth.login(body);
    this.applyTransport(request, reply, result.tokens);
    return result;
  }

  @Public()
  @RateLimit({ limit: 30, windowSeconds: 900, name: 'auth.refresh' })
  @HttpCode(200)
  @Post('refresh')
  async refresh(
    @Body(new ZodValidationPipe(refreshInputSchema)) body: RefreshInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResult> {
    const token = body.refreshToken ?? request.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new AppError('AUTH_REQUIRED', 'A refresh token is required.');
    }
    const result = await this.auth.refresh(token);
    this.applyTransport(request, reply, result.tokens);
    return result;
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(
    @Body(new ZodValidationPipe(refreshInputSchema)) body: RefreshInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ loggedOut: true }> {
    const token = body.refreshToken ?? request.cookies?.[REFRESH_COOKIE];
    await this.auth.logout(token);
    if (this.wantsCookies(request) || request.cookies?.[REFRESH_COOKIE]) {
      clearAuthCookies(reply, this.cookieSettings());
    }
    return { loggedOut: true };
  }

  @RateLimit({ limit: 10, windowSeconds: 900, name: 'auth.step_up' })
  @HttpCode(200)
  @Post('step-up')
  async stepUp(
    @Body(new ZodValidationPipe(stepUpInputSchema)) body: StepUpInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AccessTokenResponse> {
    const principal = this.requirePrincipal(request);
    const result = await this.auth.stepUp(principal.userId, principal.sessionId, body.password);
    if (this.wantsCookies(request)) {
      setAccessCookie(reply, result.accessToken, this.cookieSettings());
    }
    return result;
  }

  @RateLimit({ limit: 10, windowSeconds: 900, name: 'auth.change_password' })
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @Body(new ZodValidationPipe(changePasswordInputSchema)) body: ChangePasswordInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AccessTokenResponse> {
    const principal = this.requirePrincipal(request);
    const result = await this.auth.changePassword(
      principal.userId,
      principal.sessionId,
      body.currentPassword,
      body.newPassword,
    );
    if (this.wantsCookies(request)) {
      setAccessCookie(reply, result.accessToken, this.cookieSettings());
    }
    return result;
  }

  // --- helpers --------------------------------------------------------------

  private requirePrincipal(request: FastifyRequest) {
    const principal = request.principal;
    if (!principal) {
      throw new AppError('AUTH_REQUIRED', 'Authentication required.');
    }
    return principal;
  }

  private wantsCookies(request: FastifyRequest): boolean {
    const header = request.headers[AUTH_TRANSPORT_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    return value?.toLowerCase() === AUTH_TRANSPORT_COOKIE;
  }

  private applyTransport(
    request: FastifyRequest,
    reply: FastifyReply,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    if (this.wantsCookies(request)) {
      setAuthCookies(reply, tokens, this.cookieSettings());
    }
  }

  private cookieSettings(): CookieSettings {
    return {
      secure: this.config.get('AUTH_COOKIE_SECURE'),
      domain: this.config.get('AUTH_COOKIE_DOMAIN'),
      accessTtlSeconds: this.config.get('AUTH_ACCESS_TOKEN_TTL_SECONDS'),
      refreshTtlSeconds: this.config.get('AUTH_REFRESH_TOKEN_TTL_SECONDS'),
    };
  }
}
