import { describe, expect, it } from 'vitest';

import { formatDate, formatMoney, formatNumber } from './format';

const BENGALI_DIGIT = /[০-৯]/;
const ASCII_DIGIT = /[0-9]/;

describe('formatNumber', () => {
  it('renders Bengali digits for bn and Western digits for en', () => {
    const bn = formatNumber(2026, 'bn');
    const en = formatNumber(2026, 'en');
    expect(bn).toMatch(BENGALI_DIGIT);
    expect(bn).not.toMatch(ASCII_DIGIT);
    expect(en).toMatch(ASCII_DIGIT);
    expect(en).not.toMatch(BENGALI_DIGIT);
  });
});

describe('formatMoney', () => {
  it('converts minor units to major using the currency exponent (never a hardcoded 2)', () => {
    // Same integer minor units, different exponents — the strongest proof the
    // exponent is derived from the ISO code and not assumed to be 2 decimals.
    const usd = formatMoney(1000, 'USD', 'en'); // exponent 2 -> 10.00
    const jpy = formatMoney(1000, 'JPY', 'en'); // exponent 0 -> 1,000
    expect(usd).toContain('10');
    expect(usd).not.toContain('1,000');
    expect(jpy).toContain('1,000');
  });

  it('formats BDT minor units into major taka', () => {
    // 150000 poisha = 1,500 taka (BDT exponent 2).
    const en = formatMoney(150_000, 'BDT', 'en');
    expect(en).toContain('1,500');
  });

  it('uses Bengali digits for the bn locale', () => {
    const bn = formatMoney(150_000, 'BDT', 'bn');
    expect(bn).toMatch(BENGALI_DIGIT);
    expect(bn).not.toMatch(ASCII_DIGIT);
  });
});

describe('formatDate', () => {
  it('returns an empty string for an unparseable date', () => {
    expect(formatDate('not-a-date', 'en')).toBe('');
    expect(formatDate('', 'bn')).toBe('');
  });

  it('formats a valid ISO date in the locale digit system', () => {
    const iso = '2026-08-24T12:00:00Z';
    expect(formatDate(iso, 'en')).toContain('2026');
    expect(formatDate(iso, 'bn')).toContain('২০২৬');
  });
});
