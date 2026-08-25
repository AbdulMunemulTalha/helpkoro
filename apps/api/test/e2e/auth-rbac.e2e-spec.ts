import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { sessions, type DatabaseHandle } from '@helpkoro/db';
import { uuidv7 } from '@helpkoro/contracts';
import { ROLES } from '@helpkoro/domain';
import { UsersService } from '../../src/auth/users.service';
import { DATABASE } from '../../src/infra/database.module';
import { buildTestApp, flushRateLimitKeys } from './app-harness';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}
interface AuthBody {
  data: { user: { id: string }; tokens: Tokens };
}
interface PublicUserBody {
  data: { id: string; roles: string[] };
}
interface ErrorBody {
  error: { code: string; details?: { reason?: string } };
}

const PASSWORD = 'a-strong-password-123';

/** Decode a JWT payload without verifying — tests only need the session id. */
function decodeSid(accessToken: string): string {
  const payload = accessToken.split('.')[1] ?? '';
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sid: string };
  return decoded.sid;
}

describe('RBAC: admin role management (/v1/admin/users/:id/roles)', () => {
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

  async function registerUser(): Promise<{
    userId: string;
    creds: { email: string; password: string };
    tokens: Tokens;
  }> {
    const creds = { email: `user-${uuidv7()}@helpkoro.test`, password: PASSWORD };
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { ...creds, displayName: 'RBAC User' },
    });
    const body = res.json() as AuthBody;
    return { userId: body.data.user.id, creds, tokens: body.data.tokens };
  }

  async function login(creds: { email: string; password: string }): Promise<Tokens> {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: creds });
    return (res.json() as AuthBody).data.tokens;
  }

  /** Elevate a user to administrator out-of-band, then re-login for a fresh admin token. */
  async function makeAdmin(user: {
    userId: string;
    creds: { email: string; password: string };
  }): Promise<Tokens> {
    await app
      .get(UsersService, { strict: false })
      .assignRole(user.userId, ROLES.ADMINISTRATOR, user.userId);
    return login(user.creds);
  }

  it('denies role assignment to a non-administrator (403 FORBIDDEN)', async () => {
    const actor = await registerUser();
    const target = await registerUser();

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${target.userId}/roles`,
      headers: { authorization: `Bearer ${actor.tokens.accessToken}` },
      payload: { role: ROLES.REVIEWER },
    });
    expect(res.statusCode).toBe(403);
    expect((res.json() as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('lets an administrator with a fresh step-up assign a role', async () => {
    const admin = await registerUser();
    const target = await registerUser();
    const tokens = await makeAdmin(admin);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${target.userId}/roles`,
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: { role: ROLES.REVIEWER },
    });
    expect(res.statusCode).toBe(200);
    expect((res.json() as PublicUserBody).data.roles).toContain('reviewer');
  });

  it('requires step-up when the session is stale, and succeeds after re-authenticating', async () => {
    const admin = await registerUser();
    const target = await registerUser();
    const tokens = await makeAdmin(admin);
    const auth = { authorization: `Bearer ${tokens.accessToken}` };
    const assignUrl = `/v1/admin/users/${target.userId}/roles`;

    // Age the session's step-up timestamp beyond the freshness window (the guard
    // reads this from the DB, authoritatively, not from the token claim).
    const handle = app.get(DATABASE, { strict: false }) as DatabaseHandle;
    await handle.db
      .update(sessions)
      .set({ stepUpAt: new Date('2000-01-01T00:00:00.000Z') })
      .where(eq(sessions.id, decodeSid(tokens.accessToken)));

    const stale = await app.inject({
      method: 'POST',
      url: assignUrl,
      headers: auth,
      payload: { role: ROLES.SUPPORT_AGENT },
    });
    expect(stale.statusCode).toBe(403);
    const staleBody = stale.json() as ErrorBody;
    expect(staleBody.error.code).toBe('FORBIDDEN');
    expect(staleBody.error.details?.reason).toBe('STEP_UP_REQUIRED');

    // Re-authenticate via step-up (same access token, DB step-up refreshed)…
    const stepUp = await app.inject({
      method: 'POST',
      url: '/v1/auth/step-up',
      headers: auth,
      payload: { password: PASSWORD },
    });
    expect(stepUp.statusCode).toBe(200);

    // …now the same assignment is authorised.
    const afterStepUp = await app.inject({
      method: 'POST',
      url: assignUrl,
      headers: auth,
      payload: { role: ROLES.SUPPORT_AGENT },
    });
    expect(afterStepUp.statusCode).toBe(200);
    expect((afterStepUp.json() as PublicUserBody).data.roles).toContain('support_agent');
  });

  it('rejects an unknown role with VALIDATION_FAILED', async () => {
    const admin = await registerUser();
    const target = await registerUser();
    const tokens = await makeAdmin(admin);

    const res = await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${target.userId}/roles`,
      headers: { authorization: `Bearer ${tokens.accessToken}` },
      payload: { role: 'wizard' },
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as ErrorBody).error.code).toBe('VALIDATION_FAILED');
  });

  it('revokes a role and refuses self-revocation of the administrator role', async () => {
    const admin = await registerUser();
    const target = await registerUser();
    const tokens = await makeAdmin(admin);
    const auth = { authorization: `Bearer ${tokens.accessToken}` };

    // Grant then revoke a role on the target.
    await app.inject({
      method: 'POST',
      url: `/v1/admin/users/${target.userId}/roles`,
      headers: auth,
      payload: { role: ROLES.REVIEWER },
    });
    const revoke = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/users/${target.userId}/roles/${ROLES.REVIEWER}`,
      headers: auth,
    });
    expect(revoke.statusCode).toBe(200);
    expect((revoke.json() as PublicUserBody).data.roles).not.toContain('reviewer');

    // An administrator may not strip their own administrator role.
    const selfRevoke = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/users/${admin.userId}/roles/${ROLES.ADMINISTRATOR}`,
      headers: auth,
    });
    expect(selfRevoke.statusCode).toBe(409);
    expect((selfRevoke.json() as ErrorBody).error.code).toBe('STATE_CONFLICT');
  });
});
