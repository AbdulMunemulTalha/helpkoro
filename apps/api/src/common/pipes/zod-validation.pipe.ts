import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { AppError } from '@helpkoro/contracts';

/**
 * Validates (and transforms) a request payload against a Zod schema, mapping any
 * failure to a `VALIDATION_FAILED` {@link AppError} that the exception filter
 * renders as the ADR-006 error envelope. Only field *paths* and messages are
 * surfaced in `details.fields` — never the submitted values, so passwords and
 * other sensitive inputs are not echoed back or logged.
 *
 * Use per-parameter: `@Body(new ZodValidationPipe(loginInputSchema))`.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      }));
      throw new AppError('VALIDATION_FAILED', 'Request validation failed.', { fields });
    }
    return result.data;
  }
}
