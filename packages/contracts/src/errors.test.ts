import { describe, it, expect } from 'vitest';
import { AppError, isAppError, ERROR_STATUS } from './errors';

describe('AppError', () => {
  it('carries the stable code and derives the default HTTP status', () => {
    const err = new AppError('VALIDATION_FAILED', 'bad input');
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.status).toBe(ERROR_STATUS.VALIDATION_FAILED);
    expect(err.message).toBe('bad input');
    expect(err).toBeInstanceOf(Error);
  });

  it('keeps optional structured details', () => {
    const err = new AppError('STATE_CONFLICT', 'wrong state', { from: 'draft' });
    expect(err.details).toEqual({ from: 'draft' });
    expect(err.status).toBe(409);
  });

  it('is recognised by the isAppError guard', () => {
    expect(isAppError(new AppError('FORBIDDEN', 'no'))).toBe(true);
    expect(isAppError(new Error('plain'))).toBe(false);
    expect(isAppError('nope')).toBe(false);
  });
});
