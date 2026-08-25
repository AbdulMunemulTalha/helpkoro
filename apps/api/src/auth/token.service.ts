import { Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { AppError } from '@helpkoro/contracts';
import { ConfigService } from '../config/config.service';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from './auth.constants';
import type { AccessTokenClaims, RefreshTokenClaims } from './auth.types';

interface SignedToken {
  token: string;
  /** Lifetime in seconds. */
  expiresIn: number;
}

/** Current time in epoch seconds. */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Signs and verifies the JWTs behind the auth layer (ADR-005). Access tokens
 * are short-lived and stateless — verified per request without a DB round-trip.
 * Refresh tokens carry a rotating nonce; the session store detects reuse. Both
 * use HS256 with independent secrets (enforced distinct by the env schema).
 */
@Injectable()
export class TokenService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(config: ConfigService) {
    const encoder = new TextEncoder();
    this.accessSecret = encoder.encode(config.get('AUTH_ACCESS_TOKEN_SECRET'));
    this.refreshSecret = encoder.encode(config.get('AUTH_REFRESH_TOKEN_SECRET'));
    this.accessTtl = config.get('AUTH_ACCESS_TOKEN_TTL_SECONDS');
    this.refreshTtl = config.get('AUTH_REFRESH_TOKEN_TTL_SECONDS');
  }

  get accessTtlSeconds(): number {
    return this.accessTtl;
  }

  get refreshTtlSeconds(): number {
    return this.refreshTtl;
  }

  async signAccessToken(input: {
    userId: string;
    sessionId: string;
    roles: readonly string[];
    stepUpAt?: number;
  }): Promise<SignedToken> {
    const iat = nowSeconds();
    const exp = iat + this.accessTtl;
    const payload: JWTPayload = { sid: input.sessionId, roles: [...input.roles] };
    if (input.stepUpAt !== undefined) {
      payload.sua = input.stepUpAt;
    }
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.accessSecret);
    return { token, expiresIn: this.accessTtl };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret, {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      const sub = payload.sub;
      const sid = payload.sid;
      const roles = payload.roles;
      if (typeof sub !== 'string' || typeof sid !== 'string' || !Array.isArray(roles)) {
        throw new AppError('AUTH_REQUIRED', 'Malformed access token.');
      }
      return {
        sub,
        sid,
        roles: roles.filter((r): r is string => typeof r === 'string'),
        sua: typeof payload.sua === 'number' ? payload.sua : undefined,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('AUTH_REQUIRED', 'Invalid or expired access token.');
    }
  }

  async signRefreshToken(input: {
    userId: string;
    sessionId: string;
    rnonce: string;
  }): Promise<SignedToken> {
    const iat = nowSeconds();
    const exp = iat + this.refreshTtl;
    const token = await new SignJWT({ sid: input.sessionId, rnonce: input.rnonce })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(input.userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.refreshSecret);
    return { token, expiresIn: this.refreshTtl };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret, {
        issuer: TOKEN_ISSUER,
        audience: TOKEN_AUDIENCE,
      });
      const sub = payload.sub;
      const sid = payload.sid;
      const rnonce = payload.rnonce;
      if (typeof sub !== 'string' || typeof sid !== 'string' || typeof rnonce !== 'string') {
        throw new AppError('AUTH_REQUIRED', 'Malformed refresh token.');
      }
      return { sub, sid, rnonce };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('AUTH_REQUIRED', 'Invalid or expired refresh token.');
    }
  }
}
