import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { AppError } from '@helpkoro/contracts';
import type { ConfigService } from '../config/config.service';
import { TOKEN_AUDIENCE, TOKEN_ISSUER } from './auth.constants';
import { TokenService } from './token.service';

const ACCESS_SECRET = 'access-secret-abcdefghijklmnopqrstuvwxyz-0123456789';
const REFRESH_SECRET = 'refresh-secret-abcdefghijklmnopqrstuvwxyz-0123456789';

const CONFIG: Record<string, unknown> = {
  AUTH_ACCESS_TOKEN_SECRET: ACCESS_SECRET,
  AUTH_REFRESH_TOKEN_SECRET: REFRESH_SECRET,
  AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  AUTH_REFRESH_TOKEN_TTL_SECONDS: 1_209_600,
};

function makeService(): TokenService {
  const config = { get: (key: string) => CONFIG[key] } as unknown as ConfigService;
  return new TokenService(config);
}

describe('TokenService', () => {
  const service = makeService();

  it('round-trips an access token, preserving sub/sid/roles/sua', async () => {
    const { token, expiresIn } = await service.signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      roles: ['administrator'],
      stepUpAt: 1_700_000_000,
    });
    expect(expiresIn).toBe(900);

    const claims = await service.verifyAccessToken(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.sid).toBe('session-1');
    expect(claims.roles).toEqual(['administrator']);
    expect(claims.sua).toBe(1_700_000_000);
  });

  it('omits sua when the session has never stepped up', async () => {
    const { token } = await service.signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      roles: [],
    });
    const claims = await service.verifyAccessToken(token);
    expect(claims.sua).toBeUndefined();
  });

  it('rejects a tampered access token', async () => {
    const { token } = await service.signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      roles: [],
    });
    // Corrupt the first signature character (high-order bits → guaranteed byte
    // change), so the HMAC no longer matches header.payload.
    const parts = token.split('.');
    const sig = parts[2] ?? '';
    parts[2] = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    const tampered = parts.join('.');
    await expect(service.verifyAccessToken(tampered)).rejects.toBeInstanceOf(AppError);
  });

  it('rejects an expired access token', async () => {
    const past = Math.floor(Date.parse('2020-01-01T00:00:00Z') / 1000);
    const expired = await new SignJWT({ sid: 'session-1', roles: [] })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('user-1')
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(past)
      .setExpirationTime(past + 60)
      .sign(new TextEncoder().encode(ACCESS_SECRET));
    await expect(service.verifyAccessToken(expired)).rejects.toBeInstanceOf(AppError);
  });

  it('does not accept an access token as a refresh token (separate secrets)', async () => {
    const { token } = await service.signAccessToken({
      userId: 'user-1',
      sessionId: 'session-1',
      roles: [],
    });
    await expect(service.verifyRefreshToken(token)).rejects.toBeInstanceOf(AppError);
  });

  it('round-trips a refresh token, preserving sub/sid/rnonce', async () => {
    const { token } = await service.signRefreshToken({
      userId: 'user-2',
      sessionId: 'session-2',
      rnonce: 'nonce-xyz',
    });
    const claims = await service.verifyRefreshToken(token);
    expect(claims).toEqual({ sub: 'user-2', sid: 'session-2', rnonce: 'nonce-xyz' });
  });

  it('rejects a token signed with a different secret', async () => {
    const foreign = await new SignJWT({ sid: 'session-1', roles: [] })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject('user-1')
      .setIssuer(TOKEN_ISSUER)
      .setAudience(TOKEN_AUDIENCE)
      .setIssuedAt(Math.floor(Date.parse('2025-01-01T00:00:00Z') / 1000))
      .setExpirationTime(Math.floor(Date.parse('2099-01-01T00:00:00Z') / 1000))
      .sign(new TextEncoder().encode('a-totally-different-secret-key-000000000000'));
    await expect(service.verifyAccessToken(foreign)).rejects.toBeInstanceOf(AppError);
  });
});
