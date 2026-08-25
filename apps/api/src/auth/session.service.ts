import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { sessions, type DatabaseHandle, type SessionRevokedReason } from '@helpkoro/db';
import { uuidv7 } from '@helpkoro/contracts';
import { DATABASE } from '../infra/database.module';
import { TokenService } from './token.service';

/** SHA-256 hex digest — binds a stored session to the exact refresh token issued. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface CreatedSession {
  sessionId: string;
  refreshToken: string;
  stepUpAt: Date | null;
}

export type RotateResult =
  | {
      ok: true;
      userId: string;
      sessionId: string;
      refreshToken: string;
      stepUpAt: Date | null;
    }
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'reuse'; userId: string; sessionId: string };

/**
 * Refresh-session lifecycle (ADR-005/ADR-007). Only the hash of the current
 * refresh token and a rotating nonce are stored. Presenting a superseded token
 * (nonce/hash mismatch) is treated as theft: the whole session is revoked.
 * Access tokens are stateless and are NOT tracked here.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(DATABASE) private readonly handle: DatabaseHandle,
    private readonly tokens: TokenService,
  ) {}

  private get db() {
    return this.handle.db;
  }

  /** Open a new session and mint its first refresh token. */
  async create(userId: string, options: { stepUp: boolean }): Promise<CreatedSession> {
    const sessionId = uuidv7();
    const rnonce = randomBytes(16).toString('hex');
    const { token } = await this.tokens.signRefreshToken({ userId, sessionId, rnonce });
    const now = new Date();
    const stepUpAt = options.stepUp ? now : null;
    const expiresAt = new Date(now.getTime() + this.tokens.refreshTtlSeconds * 1000);

    await this.db.insert(sessions).values({
      id: sessionId,
      userId,
      refreshTokenHash: hashToken(token),
      refreshNonce: rnonce,
      stepUpAt,
      lastUsedAt: now,
      expiresAt,
    });

    return { sessionId, refreshToken: token, stepUpAt };
  }

  /**
   * Validate + rotate a refresh token. On success the old token is invalidated
   * and a fresh one returned. On reuse the session is revoked and the caller is
   * expected to audit the event.
   */
  async rotate(refreshToken: string): Promise<RotateResult> {
    let claims;
    try {
      claims = await this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      return { ok: false, reason: 'invalid' };
    }

    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, claims.sid),
    });
    if (!session || session.userId !== claims.sub) {
      return { ok: false, reason: 'invalid' };
    }
    if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) {
      return { ok: false, reason: 'invalid' };
    }

    const nonceMatches = session.refreshNonce === claims.rnonce;
    const hashMatches = session.refreshTokenHash === hashToken(refreshToken);
    if (!nonceMatches || !hashMatches) {
      // A superseded/tampered token was presented — assume theft, revoke all.
      await this.revoke(session.id, 'reuse_detected');
      return { ok: false, reason: 'reuse', userId: session.userId, sessionId: session.id };
    }

    const rnonce = randomBytes(16).toString('hex');
    const { token } = await this.tokens.signRefreshToken({
      userId: session.userId,
      sessionId: session.id,
      rnonce,
    });
    await this.db
      .update(sessions)
      .set({ refreshNonce: rnonce, refreshTokenHash: hashToken(token), lastUsedAt: new Date() })
      .where(eq(sessions.id, session.id));

    return {
      ok: true,
      userId: session.userId,
      sessionId: session.id,
      refreshToken: token,
      stepUpAt: session.stepUpAt,
    };
  }

  /** Record a fresh step-up on the session and return the timestamp used. */
  async markStepUp(sessionId: string): Promise<Date> {
    const now = new Date();
    await this.db
      .update(sessions)
      .set({ stepUpAt: now, lastUsedAt: now })
      .where(eq(sessions.id, sessionId));
    return now;
  }

  /** Load an active (not revoked, not expired) session, else undefined. */
  async getActive(sessionId: string) {
    const session = await this.db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) });
    if (!session) return undefined;
    if (session.revokedAt !== null || session.expiresAt.getTime() <= Date.now()) return undefined;
    return session;
  }

  async revoke(sessionId: string, reason: SessionRevokedReason): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
  }

  /** Revoke every active session for a user, optionally sparing one. */
  async revokeAllForUser(
    userId: string,
    reason: SessionRevokedReason,
    exceptSessionId?: string,
  ): Promise<void> {
    const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
    if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(...conditions));
  }
}
