import { z } from 'zod';

/**
 * Money is stored as integer minor units with an explicit currency (ADR-006).
 * The default currency and its minor-unit exponent are deliberately NOT fixed
 * here — that is a country-configuration seam (ADR-005). Arithmetic helpers
 * live in `@helpkoro/domain`.
 */
export const minorUnits = z.number().int();

/** ISO-4217-style 3-letter currency code. */
export const currencyCode = z
  .string()
  .regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO 4217 currency code');

export const money = z.object({
  amount: minorUnits,
  currency: currencyCode,
});

export type Money = z.infer<typeof money>;
export type CurrencyCode = z.infer<typeof currencyCode>;
