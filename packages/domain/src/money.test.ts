import { describe, it, expect } from 'vitest';
import { toMinorUnits, addMoney, addMinorUnits, sumMinorUnits, formatMinorUnits } from './money';

describe('minor units', () => {
  it('rejects non-integers', () => {
    expect(() => toMinorUnits(1.5)).toThrow(RangeError);
  });

  it('adds and sums', () => {
    expect(addMinorUnits(toMinorUnits(100), toMinorUnits(250))).toBe(350);
    expect(sumMinorUnits([toMinorUnits(1), toMinorUnits(2), toMinorUnits(3)])).toBe(6);
  });
});

describe('money', () => {
  it('adds same-currency amounts', () => {
    const total = addMoney(
      { amount: toMinorUnits(100), currency: 'USD' },
      { amount: toMinorUnits(50), currency: 'USD' },
    );
    expect(total.amount).toBe(150);
    expect(total.currency).toBe('USD');
  });

  it('refuses to add mismatched currencies', () => {
    expect(() =>
      addMoney(
        { amount: toMinorUnits(100), currency: 'USD' },
        { amount: toMinorUnits(50), currency: 'EUR' },
      ),
    ).toThrow(/Currency mismatch/);
  });
});

describe('formatMinorUnits', () => {
  it('formats with a two-digit exponent', () => {
    expect(formatMinorUnits(toMinorUnits(12345), 2)).toBe('123.45');
    expect(formatMinorUnits(toMinorUnits(5), 2)).toBe('0.05');
    expect(formatMinorUnits(toMinorUnits(-12345), 2)).toBe('-123.45');
  });

  it('formats a zero-exponent currency', () => {
    expect(formatMinorUnits(toMinorUnits(1000), 0)).toBe('1000');
  });

  it('rejects a negative exponent', () => {
    expect(() => formatMinorUnits(toMinorUnits(1), -1)).toThrow(RangeError);
  });
});
