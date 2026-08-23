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
});
