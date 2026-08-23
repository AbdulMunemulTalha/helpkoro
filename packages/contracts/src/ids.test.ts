import { describe, it, expect } from 'vitest';
import { uuidv7, isUuid } from './ids';

describe('uuidv7', () => {
  it('produces a syntactically valid uuid with version nibble 7', () => {
    const id = uuidv7();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe('7');
    expect('89ab').toContain(id[19]!); // variant nibble
  });

  it('is time-ordered by its high bytes', () => {
    const earlier = uuidv7(1_000);
    const later = uuidv7(2_000_000);
    expect(earlier.slice(0, 8) < later.slice(0, 8)).toBe(true);
  });

  it('rejects non-uuid strings', () => {
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid('')).toBe(false);
  });
});
