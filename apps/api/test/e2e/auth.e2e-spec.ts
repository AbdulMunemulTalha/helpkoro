import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from '@helpkoro/contracts';
import { buildTestApp, flushRateLimitKeys } from './app-harness';

interface AuthBody {
  data: {
    user: { id: string; email: string; roles: string[]; status: string };
    tokens: { accessToken: string; refreshToken: string; tokenType: string; expiresIn: number };
  };
  meta: { requestId: string };
}

function freshCredentials() {
  return { email: `user-${uuidv7()}@helpkoro.test`, password: 'a-strong-password-123' };
}

describe('auth core (register / login / me / refresh / logout)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await flushRateLimitKeys(app);
  });

  async function register(creds = freshCredentials()) {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...creds, displayName: 'Test User' },
    });
    return { res, creds };
  }

  it('registers a new account and returns the user + tokens', async () => {
    const { res } = await register();
    expect(res.statusCode).toBe(201);
    const body = res.json() as AuthBody;
    expect(body.data.user.roles).toEqual(['donor']);
    expect(body.data.user.status).toBe('active');
    expect(body.data.tokens.tokenType).toBe('Bearer');
    expect(body.data.tokens.accessToken).toBeTruthy();
    expect(body.data.tokens.refreshToken).toBeTruthy();
  });

  it('normalises the email and rejects a duplicate registration with STATE_CONFLICT', async () => {
    const creds = freshCredentials();
    const first = await register(creds);
    expect(first.res.statusCode).toBe(201);

    const dup = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: creds.email.toUpperCase(), password: creds.password, displayName: 'Dup' },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe('STATE_CONFLICT');
  });

  it('rejects invalid registration input with VALIDATION_FAILED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email: 'not-an-email', password: 'short', displayName: '' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED');
  });

  it('logs in with valid credentials and rejects a wrong password', async () => {
    const { creds } = await register();

    const ok = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: creds });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as AuthBody).data.tokens.accessToken).toBeTruthy();

    const bad = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: creds.email, password: 'wrong-password-000' },
    });
    expect(bad.statusCode).toBe(401);
    expect((bad.json() as { error: { code: string } }).error.code).toBe('AUTH_REQUIRED');
  });

  it('GET /v1/me returns the profile with a token and 401 without one', async () => {
    const { res } = await register();
    const { accessToken, refreshToken } = (res.json() as AuthBody).data.tokens;

    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(me.statusCode).toBe(200);
    expect((me.json() as { data: { email: string } }).data.email).toContain('@helpkoro.test');

    const anon = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(anon.statusCode).toBe(401);

    // A refresh token must not be accepted as an access token.
    const wrongToken = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect(wrongToken.statusCode).toBe(401);
  });

  it('rotates refresh tokens and revokes the session on reuse', async () => {
    const { res } = await register();
    const r0 = (res.json() as AuthBody).data.tokens.refreshToken;

    // First rotation succeeds and returns a new refresh token.
    const rotate1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: r0 },
    });
    expect(rotate1.statusCode).toBe(200);
    const r1 = (rotate1.json() as AuthBody).data.tokens.refreshToken;
    expect(r1).not.toBe(r0);

    // Replaying the superseded token is treated as theft → 401.
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: r0 },
    });
    expect(replay.statusCode).toBe(401);

    // …and the whole session is revoked, so even the "good" r1 no longer works.
    const afterRevoke = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: r1 },
    });
    expect(afterRevoke.statusCode).toBe(401);
  });

  it('logs out (idempotently) and invalidates the refresh token', async () => {
    const { res } = await register();
    const refreshToken = (res.json() as AuthBody).data.tokens.refreshToken;

    const out = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(out.statusCode).toBe(200);
    expect((out.json() as { data: { loggedOut: boolean } }).data.loggedOut).toBe(true);

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refresh.statusCode).toBe(401);

    // Logging out again with the same token is still a success (idempotent).
    const again = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(again.statusCode).toBe(200);
  });
});

describe('auth cookie transport + CSRF (ADR-006 §9)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await flushRateLimitKeys(app);
  });

  it('sets httpOnly cookies for a cookie-transport client and enforces CSRF on unsafe methods', async () => {
    const creds = { email: `user-${uuidv7()}@helpkoro.test`, password: 'a-strong-password-123' };
    await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...creds, displayName: 'Cookie User' },
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'x-auth-transport': 'cookie' },
      payload: creds,
    });
    expect(login.statusCode).toBe(200);

    const cookies = login.cookies as { name: string; value: string; httpOnly?: boolean }[];
    const at = cookies.find((c) => c.name === 'hk_at');
    const rt = cookies.find((c) => c.name === 'hk_rt');
    const csrf = cookies.find((c) => c.name === 'hk_csrf');
    expect(at?.httpOnly).toBe(true);
    expect(rt?.httpOnly).toBe(true);
    expect(csrf).toBeDefined();
    expect(csrf?.httpOnly).toBeFalsy();
    if (!at || !rt || !csrf) throw new Error('expected hk_at/hk_rt/hk_csrf cookies to be set');

    // The access cookie authenticates GET /v1/me.
    const me = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: { cookie: `hk_at=${at.value}` },
    });
    expect(me.statusCode).toBe(200);

    // Unsafe method with the CSRF cookie present but no matching header → blocked.
    const noCsrf = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { cookie: `hk_csrf=${csrf.value}; hk_rt=${rt.value}` },
    });
    expect(noCsrf.statusCode).toBe(403);
    expect((noCsrf.json() as { error: { code: string } }).error.code).toBe('FORBIDDEN');

    // With the double-submit header it succeeds.
    const withCsrf = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {
        cookie: `hk_csrf=${csrf.value}; hk_rt=${rt.value}`,
        'x-csrf-token': csrf.value,
      },
    });
    expect(withCsrf.statusCode).toBe(200);
  });
});
