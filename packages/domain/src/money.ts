/**
 * Money arithmetic on integer minor units (ADR-006). `MinorUnits` is branded
 * to prevent accidentally mixing raw numbers with money. The minor-unit
 * exponent (and default currency) are country-configuration seams and are NOT
 * hardcoded here (ADR-005).
 */
declare const minorUnitsBrand: unique symbol;

export type MinorUnits = number & { readonly [minorUnitsBrand]: true };

export interface Money {
  readonly amount: MinorUnits;
  readonly currency: string;
}

/** Construct `MinorUnits`, rejecting non-integers. */
export function toMinorUnits(value: number): MinorUnits {
  if (!Number.isInteger(value)) {
    throw new RangeError(`MinorUnits must be an integer, received ${value}`);
  }
  return value as MinorUnits;
}

export function addMinorUnits(a: MinorUnits, b: MinorUnits): MinorUnits {
  return toMinorUnits(a + b);
}

export function sumMinorUnits(values: readonly MinorUnits[]): MinorUnits {
  return values.reduce<MinorUnits>((acc, v) => addMinorUnits(acc, v), toMinorUnits(0));
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: addMinorUnits(a.amount, b.amount), currency: a.currency };
}

/**
 * Format integer minor units as a decimal string. `exponent` (minor units per
 * major unit) MUST be supplied by the caller — the platform default is a
 * country-config seam and is deliberately not hardcoded.
 */
export function formatMinorUnits(amount: MinorUnits, exponent: number): string {
  if (!Number.isInteger(exponent) || exponent < 0) {
    throw new RangeError(`exponent must be a non-negative integer, received ${exponent}`);
  }
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const divisor = 10 ** exponent;
  const major = Math.floor(abs / divisor);
  const minor = abs % divisor;
  const minorStr = exponent > 0 ? `.${String(minor).padStart(exponent, '0')}` : '';
  return `${negative ? '-' : ''}${major}${minorStr}`;
}
