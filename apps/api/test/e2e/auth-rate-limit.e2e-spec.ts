import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, flushRateLimitKeys } from './app-harness';

/**
 * Fixed-window rate limiting on the login endpoint (identity-access-and-security.md).
 * All `app.inject` requests share one client IP, so the counter is keyed on a
 * single bucket; `flushRateLimitKeys` clears it before and after so this test is
 * independent of the rest of the suite. The login limit is 10 requests / 15 min.
 */
describe('rate limiting: login throttle (429 RATE_LIMITED)', () => {
  let app: NestFastifyApplication;
  const LOGIN_LIMIT = 10;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await flushRateLimitKeys(app);
  });

  afterEach(async () => {
    await flushRateLimitKeys(app);
  });

  it('allows requests up to the limit, then returns 429 with a Retry-After header', async () => {
    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'ratelimit@helpkoro.test', password: 'wrong-password-000' },
      });

    // The first LOGIN_LIMIT attempts are within budget (each is a normal 401 —
    // rate limiting runs before authentication, so wrong credentials still count).
    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      const res = await attempt();
      expect(res.statusCode).not.toBe(429);
    }

    // The next attempt exceeds the window and is throttled.
    const throttled = await attempt();
    expect(throttled.statusCode).toBe(429);
    expect((throttled.json() as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
    expect(throttled.headers['retry-after']).toBeDefined();
  });
});
