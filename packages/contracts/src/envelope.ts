import { z } from 'zod';
import { stableErrorCode, type StableErrorCode } from './errors';

/** Metadata attached to every response (ADR-006). */
export const responseMeta = z.object({
  requestId: z.string(),
});
export type ResponseMeta = z.infer<typeof responseMeta>;

/** Success envelope: `{ data, meta }`. */
export interface SuccessEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

/** Error envelope: `{ error: { code, message, details? }, meta }`. */
export interface ErrorEnvelope {
  error: {
    code: StableErrorCode;
    message: string;
    details?: unknown;
  };
  meta: ResponseMeta;
}

/** Runtime schema for the error envelope (used by contract tests). */
export const errorEnvelope = z.object({
  error: z.object({
    code: stableErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: responseMeta,
});

/** Build a success-envelope schema around a payload schema. */
export const successEnvelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ data, meta: responseMeta });
