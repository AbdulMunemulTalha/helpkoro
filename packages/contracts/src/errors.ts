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

/**
 * Domain/application error carrying a stable, client-safe error code. Any layer
 * (domain rules, services) may throw it without importing app/framework code;
 * the API's exception filter maps it to the wire error envelope + HTTP status.
 * The `message` must be safe to expose — never embed secrets, raw provider
 * errors, or stack context. `details` is optional structured, safe context.
 */
export class AppError extends Error {
  readonly code: StableErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: StableErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
    // Preserve prototype chain when compiled to older targets.
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** True if `value` is an {@link AppError} (safe across realms via the name tag). */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
