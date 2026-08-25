import { describe, expect, it } from 'vitest';

import { safeRedirectPath } from './safe-redirect';

describe('safeRedirectPath', () => {
  describe('rejects open-redirect vectors and falls back', () => {
    // The whole point of this helper: a hostile `next` must never escape the origin.
    it.each([
      ['protocol-relative', '//evil.com'],
      ['absolute http', 'http://evil.com'],
      ['absolute https', 'https://evil.com/path'],
      ['scheme-relative buried', '/path://evil.com'],
      ['backslash smuggle', '/\\evil.com'],
      ['double backslash', '\\\\evil.com'],
      ['no leading slash', 'campaigns'],
      ['empty string', ''],
      ['null', null],
      ['undefined', undefined],
    ])('%s -> locale-prefixed fallback', (_label, value) => {
      expect(safeRedirectPath(value, 'bn')).toBe('/bn/dashboard');
    });

    it('honours a custom fallback', () => {
      expect(safeRedirectPath('https://evil.com', 'en', '/start')).toBe('/en/start');
    });
  });

  describe('accepts internal paths and applies the active locale', () => {
    it('prefixes a bare internal path', () => {
      expect(safeRedirectPath('/campaigns', 'bn')).toBe('/bn/campaigns');
      expect(safeRedirectPath('/campaigns', 'en')).toBe('/en/campaigns');
    });

    it('rewrites an already-locale-prefixed path to the active locale', () => {
      expect(safeRedirectPath('/en/dashboard', 'bn')).toBe('/bn/dashboard');
      expect(safeRedirectPath('/bn/dashboard', 'bn')).toBe('/bn/dashboard');
    });

    it('maps root to the bare locale segment', () => {
      expect(safeRedirectPath('/', 'bn')).toBe('/bn');
      expect(safeRedirectPath('/en', 'bn')).toBe('/bn');
    });

    it('strips a trailing slash', () => {
      expect(safeRedirectPath('/campaigns/', 'bn')).toBe('/bn/campaigns');
    });

    it('does not strip a segment that merely starts with a locale code', () => {
      expect(safeRedirectPath('/bnfoo', 'en')).toBe('/en/bnfoo');
    });

    it('preserves nested paths and query strings', () => {
      expect(safeRedirectPath('/campaigns?category=medical', 'en')).toBe(
        '/en/campaigns?category=medical',
      );
    });
  });
});
