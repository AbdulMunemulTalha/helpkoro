import { z } from 'zod';

/**
 * Stable API error codes (ADR-006 / repository-and-api-contract.md). Clients may
 * switch on these; they must remain stable. `INTERNAL` covers unmapped 5xx.
 */
export const STABLE_ERROR_CODES = [
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'VALIDATION_FAILED',
  'STATE_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'PAYMENT_PENDING',
  'REVIEW_REQUIRED',
  'INTERNAL',
] as const;

export const stableErrorCode = z.enum(STABLE_ERROR_CODES);
export type StableErrorCode = z.infer<typeof stableErrorCode>;

/** Default HTTP status for each stable code. */
export const ERROR_STATUS: Record<StableErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  VALIDATION_FAILED: 400,
  STATE_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  PAYMENT_PENDING: 402,
  REVIEW_REQUIRED: 409,
  INTERNAL: 500,
};
