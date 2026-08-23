import { SetMetadata } from '@nestjs/common';

/** Metadata key marking a handler/controller whose response must not be enveloped. */
export const SKIP_ENVELOPE = 'skipEnvelope';

/**
 * Opt a route out of the `{ data, meta }` success envelope — used by `/health`
 * and `/health/ready`, which return their own probe-shaped bodies (ADR-006).
 */
export const SkipEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE, true);
