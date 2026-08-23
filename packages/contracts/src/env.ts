import { z } from 'zod';

/** URL string validator that avoids zod-version-specific `.url()` behaviour. */
const urlString = z.string().refine((v) => URL.canParse(v), {
  message: 'must be a valid URL',
});

export const nodeEnv = z.enum(['development', 'test', 'production']).default('development');

export const logLevel = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  .default('info');

/** Variables shared by every service. */
export const baseEnvSchema = z.object({
  NODE_ENV: nodeEnv,
  LOG_LEVEL: logLevel,
});

/** API + worker environment (ADR-006). */
export const apiEnvSchema = baseEnvSchema.extend({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: urlString,
  REDIS_URL: urlString,
  OTEL_SERVICE_NAME: z.string().default('helpkoro-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: urlString.optional(),
  REQUEST_ID_HEADER: z.string().default('x-request-id'),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * Validate an environment source against a schema, failing fast with a
 * readable message. Never logs values, only paths and messages.
 */
export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
