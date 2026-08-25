import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { apiFieldErrors, authFieldErrors } from './forms';

describe('authFieldErrors', () => {
  it('maps displayable fields to their message keys', () => {
    const schema = z.object({
      email: z.string().min(3),
      password: z.string().min(12),
      displayName: z.string().min(1),
    });
    const parsed = schema.safeParse({ email: 'a', password: 'x', displayName: '' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    expect(authFieldErrors(parsed.error)).toEqual({
      email: 'errors.email',
      password: 'errors.password',
      displayName: 'errors.displayName',
    });
  });

  it('ignores fields we do not surface', () => {
    const schema = z.object({ email: z.string().min(3), captcha: z.string().min(1) });
    const parsed = schema.safeParse({ email: 'a', captcha: '' });
    if (parsed.success) throw new Error('expected failure');

    expect(authFieldErrors(parsed.error)).toEqual({ email: 'errors.email' });
  });
});

describe('apiFieldErrors', () => {
  it('maps the API details.fields shape to message keys', () => {
    const details = {
      fields: [
        { path: 'email', message: 'Invalid email' },
        { path: 'password', message: 'Too short' },
      ],
    };
    expect(apiFieldErrors(details)).toEqual({
      email: 'errors.email',
      password: 'errors.password',
    });
  });

  it('reduces a dotted path to its head segment', () => {
    expect(apiFieldErrors({ fields: [{ path: 'email.address', message: 'x' }] })).toEqual({
      email: 'errors.email',
    });
  });

  it.each([
    ['no displayable field', { fields: [{ path: 'captcha', message: 'x' }] }],
    ['fields not an array', { fields: 'nope' }],
    ['no fields key', { foo: 'bar' }],
    ['null', null],
    ['a string', 'oops'],
  ])('returns undefined for %s', (_label, details) => {
    expect(apiFieldErrors(details)).toBeUndefined();
  });
});
