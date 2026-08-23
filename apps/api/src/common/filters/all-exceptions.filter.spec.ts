import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { mapHttpStatusToCode } from './all-exceptions.filter';

describe('mapHttpStatusToCode', () => {
  it('maps known statuses to their stable codes', () => {
    expect(mapHttpStatusToCode(400)).toBe('VALIDATION_FAILED');
    expect(mapHttpStatusToCode(422)).toBe('VALIDATION_FAILED');
    expect(mapHttpStatusToCode(401)).toBe('AUTH_REQUIRED');
    expect(mapHttpStatusToCode(402)).toBe('PAYMENT_PENDING');
    expect(mapHttpStatusToCode(403)).toBe('FORBIDDEN');
    expect(mapHttpStatusToCode(409)).toBe('STATE_CONFLICT');
  });

  it('maps 5xx to INTERNAL and other 4xx to VALIDATION_FAILED', () => {
    expect(mapHttpStatusToCode(500)).toBe('INTERNAL');
    expect(mapHttpStatusToCode(503)).toBe('INTERNAL');
    expect(mapHttpStatusToCode(404)).toBe('VALIDATION_FAILED');
    expect(mapHttpStatusToCode(429)).toBe('VALIDATION_FAILED');
  });

  it('is exercised by a real HttpException status', () => {
    const status = new HttpException('nope', 403).getStatus();
    expect(mapHttpStatusToCode(status)).toBe('FORBIDDEN');
  });
});
