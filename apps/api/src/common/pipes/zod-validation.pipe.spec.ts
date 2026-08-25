import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, loginInputSchema } from '@helpkoro/contracts';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('returns the parsed (and transformed) value on success', () => {
    const pipe = new ZodValidationPipe(loginInputSchema);
    const result = pipe.transform({ email: '  USER@Example.COM ', password: 'a-long-password-1' });
    // emailSchema trims + lowercases.
    expect(result.email).toBe('user@example.com');
  });

  it('throws VALIDATION_FAILED with field paths on failure', () => {
    const pipe = new ZodValidationPipe(loginInputSchema);
    try {
      pipe.transform({ email: 'not-an-email', password: 'short' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe('VALIDATION_FAILED');
      const fields = (appErr.details as { fields: { path: string }[] }).fields;
      const paths = fields.map((f) => f.path);
      expect(paths).toContain('email');
      expect(paths).toContain('password');
    }
  });

  it('never echoes the submitted values in the error details', () => {
    const pipe = new ZodValidationPipe(loginInputSchema);
    const secret = 'sup3r-secret-value';
    try {
      pipe.transform({ email: 'nope', password: secret });
      expect.unreachable('should have thrown');
    } catch (err) {
      const serialized = JSON.stringify((err as AppError).details);
      expect(serialized).not.toContain(secret);
    }
  });

  it('labels the root when the payload itself is the wrong type', () => {
    const pipe = new ZodValidationPipe(z.object({ a: z.string() }));
    try {
      pipe.transform('not-an-object');
      expect.unreachable('should have thrown');
    } catch (err) {
      const fields = ((err as AppError).details as { fields: { path: string }[] }).fields;
      expect(fields[0]?.path).toBe('(root)');
    }
  });
});
