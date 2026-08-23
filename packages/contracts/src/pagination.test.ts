import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, paginationQuery } from './pagination';

describe('cursor', () => {
  it('round-trips through base64url', () => {
    const cursor = encodeCursor('created_at:2026-08-22|id:abc');
    expect(decodeCursor(cursor)).toBe('created_at:2026-08-22|id:abc');
  });
});

describe('paginationQuery', () => {
  it('defaults limit to 20', () => {
    expect(paginationQuery.parse({}).limit).toBe(20);
  });

  it('coerces string limits and enforces bounds', () => {
    expect(paginationQuery.parse({ limit: '50' }).limit).toBe(50);
    expect(() => paginationQuery.parse({ limit: '0' })).toThrow();
    expect(() => paginationQuery.parse({ limit: '101' })).toThrow();
  });
});
