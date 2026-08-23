import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidv7 } from '@helpkoro/contracts';
import { buildTestApp } from './app-harness';

describe('envelope + correlation (ADR-006)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('wraps success in { data, meta } and echoes a generated x-request-id', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/_diagnostics/echo?message=hi' });
    expect(res.statusCode).toBe(200);

    const body = res.json() as { data: { message: string }; meta: { requestId: string } };
    expect(body.data.message).toBe('hi');
    expect(body.meta.requestId).toBeTruthy();
    expect(res.headers['x-request-id']).toBe(body.meta.requestId);
  });

  it('honours a valid inbound x-request-id', async () => {
    const requestId = uuidv7();
    const res = await app.inject({
      method: 'GET',
      url: '/v1/_diagnostics/echo',
      headers: { 'x-request-id': requestId },
    });

    const body = res.json() as { meta: { requestId: string } };
    expect(body.meta.requestId).toBe(requestId);
    expect(res.headers['x-request-id']).toBe(requestId);
  });

  it('maps a thrown AppError to the error envelope with a stable code', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/_diagnostics/boom' });
    expect(res.statusCode).toBe(409);

    const body = res.json() as {
      error: { code: string; message: string };
      meta: { requestId: string };
    };
    expect(body.error.code).toBe('STATE_CONFLICT');
    expect(body.error.message).toContain('Diagnostics boom');
    expect(body.meta.requestId).toBeTruthy();
    expect(res.headers['x-request-id']).toBe(body.meta.requestId);
  });
});
