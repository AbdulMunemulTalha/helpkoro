import { Injectable } from '@nestjs/common';
import {
  AppError,
  type AuthResult,
  type AuthTokens,
  type LoginInput,
  type RegisterInput,
} from '@helpkoro/contracts';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { UsersService } from './users.service';

/** Step-up / access-refresh response (no refresh-token rotation). */
export interface AccessTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

function stepUpEpoch(date: Date | null): number | undefined {
  return date ? Math.floor(date.getTime() / 1000) : undefined;
}

/**
 * Orchestrates the authentication workflows (ADR-005/ADR-007): registration,
 * login, refresh (with reuse detection), logout, step-up re-authentication, and
 * password change. Emits audit events for security-relevant actions. Credential
 * errors are deliberately generic to avoid account enumeration.
 */
@Injectable()
export class AuthService {
  private dummyHashPromise?: Promise<string>;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const passwordHash = await this.passwords.hash(input.password);
    const userId = await this.users.createUser({
      email: input.email,
      displayName: input.displayName,
      locale: input.locale ?? 'en',
      passwordHash,
    });
    const session = await this.sessions.create(userId, { stepUp: true });
    await this.audit.record({
      action: 'user.registered',
      entityType: 'user',
      entityId: userId,
      actorType: 'user',
      actorId: userId,
      sourceSessionId: session.sessionId,
    });
    return this.buildAuthResult(userId, session.sessionId, session.refreshToken, session.stepUpAt);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      // Equalise timing with the found-user path to avoid enumeration.
      await this.passwords.verify(await this.getDummyHash(), input.password);
      throw new AppError('AUTH_REQUIRED', 'Invalid email or password.');
    }

    const hash = await this.users.getPasswordHash(user.id);
    const ok = hash ? await this.passwords.verify(hash, input.password) : false;
    if (!ok) {
      await this.audit.record({
        action: 'auth.login_failed',
        entityType: 'user',
        entityId: user.id,
        actorType: 'system',
        reason: 'INVALID_CREDENTIALS',
      });
      throw new AppError('AUTH_REQUIRED', 'Invalid email or password.');
    }

    if (user.status !== 'active') {
      throw new AppError('FORBIDDEN', 'This account is not active.', {
        reason: 'ACCOUNT_INACTIVE',
      });
    }

    const session = await this.sessions.create(user.id, { stepUp: true });
    await this.audit.record({
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      actorType: 'user',
      actorId: user.id,
      sourceSessionId: session.sessionId,
    });
    return this.buildAuthResult(user.id, session.sessionId, session.refreshToken, session.stepUpAt);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const result = await this.sessions.rotate(refreshToken);
    if (!result.ok) {
      if (result.reason === 'reuse') {
        await this.audit.record({
          action: 'auth.refresh_reuse_detected',
          entityType: 'session',
          entityId: result.sessionId,
          actorType: 'system',
          actorId: result.userId,
          sourceSessionId: result.sessionId,
          reason: 'REFRESH_TOKEN_REUSE',
        });
      }
      throw new AppError('AUTH_REQUIRED', 'Your session has expired. Please sign in again.');
    }
    return this.buildAuthResult(
      result.userId,
      result.sessionId,
      result.refreshToken,
      result.stepUpAt,
    );
  }

  /**
   * Revoke the session behind a refresh token. Public and idempotent: an absent,
   * invalid, or already-expired token is a no-op success, so logout never fails
   * the client. A structurally valid token (even a superseded one) still revokes
   * its session — logout should kill the session regardless of rotation state.
   */
  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    let claims;
    try {
      claims = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    await this.sessions.revoke(claims.sid, 'logout');
    await this.audit.record({
      action: 'user.logout',
      entityType: 'session',
      entityId: claims.sid,
      actorType: 'user',
      actorId: claims.sub,
      sourceSessionId: claims.sid,
    });
  }

  async stepUp(userId: string, sessionId: string, password: string): Promise<AccessTokenResponse> {
    const hash = await this.users.getPasswordHash(userId);
    const ok = hash ? await this.passwords.verify(hash, password) : false;
    if (!ok) {
      throw new AppError('AUTH_REQUIRED', 'Password is incorrect.');
    }
    const stepUpAt = await this.sessions.markStepUp(sessionId);
    await this.audit.record({
      action: 'auth.step_up',
      entityType: 'session',
      entityId: sessionId,
      actorType: 'user',
      actorId: userId,
      sourceSessionId: sessionId,
    });
    return this.issueAccessToken(userId, sessionId, stepUpAt);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AccessTokenResponse> {
    const hash = await this.users.getPasswordHash(userId);
    const ok = hash ? await this.passwords.verify(hash, currentPassword) : false;
    if (!ok) {
      throw new AppError('AUTH_REQUIRED', 'Current password is incorrect.');
    }
    const newHash = await this.passwords.hash(newPassword);
    await this.users.updatePasswordHash(userId, newHash);
    // Invalidate every other session; keep the current one but re-stamp step-up.
    await this.sessions.revokeAllForUser(userId, 'password_change', sessionId);
    const stepUpAt = await this.sessions.markStepUp(sessionId);
    await this.audit.record({
      action: 'user.password_changed',
      entityType: 'user',
      entityId: userId,
      actorType: 'user',
      actorId: userId,
      sourceSessionId: sessionId,
    });
    return this.issueAccessToken(userId, sessionId, stepUpAt);
  }

  // --- helpers --------------------------------------------------------------

  private async buildAuthResult(
    userId: string,
    sessionId: string,
    refreshToken: string,
    stepUpAt: Date | null,
  ): Promise<AuthResult> {
    const roles = await this.users.getRoles(userId);
    const access = await this.tokens.signAccessToken({
      userId,
      sessionId,
      roles,
      stepUpAt: stepUpEpoch(stepUpAt),
    });
    const user = await this.users.getPublicUser(userId);
    if (!user) {
      throw new AppError('INTERNAL', 'User vanished during authentication.');
    }
    const tokens: AuthTokens = {
      accessToken: access.token,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
    };
    return { user, tokens };
  }

  private async issueAccessToken(
    userId: string,
    sessionId: string,
    stepUpAt: Date | null,
  ): Promise<AccessTokenResponse> {
    const roles = await this.users.getRoles(userId);
    const access = await this.tokens.signAccessToken({
      userId,
      sessionId,
      roles,
      stepUpAt: stepUpEpoch(stepUpAt),
    });
    return { accessToken: access.token, tokenType: 'Bearer', expiresIn: access.expiresIn };
  }

  private getDummyHash(): Promise<string> {
    // Memoised so the enumeration-defence verify has a realistic cost once warm.
    this.dummyHashPromise ??= this.passwords.hash('helpkoro-timing-equaliser-not-a-secret');
    return this.dummyHashPromise;
  }
}
