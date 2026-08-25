import { describe, it, expect } from 'vitest';
import { apiEnvSchema, parseEnv } from './env';

describe('parseEnv', () => {
  it('parses a valid api env and applies defaults', () => {
    const env = parseEnv(apiEnvSchema, {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(env.PORT).toBe(3001);
    expect(env.REQUEST_ID_HEADER).toBe('x-request-id');
    expect(env.OTEL_SERVICE_NAME).toBe('helpkoro-api');
  });

  it('throws with a readable message on missing required vars', () => {
    expect(() => parseEnv(apiEnvSchema, { NODE_ENV: 'test' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('throws on an invalid url', () => {
    expect(() =>
      parseEnv(apiEnvSchema, {
        NODE_ENV: 'test',
        DATABASE_URL: 'not-a-url',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toThrow();
  });

  it('applies auth defaults outside production', () => {
    const env = parseEnv(apiEnvSchema, {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(env.AUTH_ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(env.AUTH_REFRESH_TOKEN_TTL_SECONDS).toBe(1_209_600);
    expect(env.AUTH_STEP_UP_WINDOW_SECONDS).toBe(300);
    expect(env.AUTH_COOKIE_SECURE).toBe(true);
    expect(env.AUTH_ACCESS_TOKEN_SECRET).not.toBe(env.AUTH_REFRESH_TOKEN_SECRET);
  });

  it('rejects the dev fallback secrets in production', () => {
    expect(() =>
      parseEnv(apiEnvSchema, {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
      }),
    ).toThrow(/AUTH_ACCESS_TOKEN_SECRET/);
  });

  it('rejects identical access and refresh secrets', () => {
    const shared = 'a'.repeat(40);
    expect(() =>
      parseEnv(apiEnvSchema, {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        REDIS_URL: 'redis://localhost:6379',
        AUTH_ACCESS_TOKEN_SECRET: shared,
        AUTH_REFRESH_TOKEN_SECRET: shared,
      }),
    ).toThrow(/AUTH_REFRESH_TOKEN_SECRET/);
  });

  it('accepts strong distinct secrets in production', () => {
    const env = parseEnv(apiEnvSchema, {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      REDIS_URL: 'redis://localhost:6379',
      AUTH_ACCESS_TOKEN_SECRET: 'x'.repeat(40),
      AUTH_REFRESH_TOKEN_SECRET: 'y'.repeat(40),
    });
    expect(env.NODE_ENV).toBe('production');
    expect(env.AUTH_COOKIE_SECURE).toBe(true);
  });
});
