import { describe, it, expect } from 'vitest';
import { localeDirection, isLocale, SUPPORTED_LOCALES } from './locale';

describe('locale', () => {
  it('treats both launch locales as left-to-right', () => {
    expect(localeDirection('bn')).toBe('ltr');
    expect(localeDirection('en')).toBe('ltr');
  });

  it('supports exactly bn and en at launch', () => {
    expect([...SUPPORTED_LOCALES].sort()).toEqual(['bn', 'en']);
  });

  it('narrows locale strings', () => {
    expect(isLocale('bn')).toBe(true);
    expect(isLocale('fr')).toBe(false);
  });
});
