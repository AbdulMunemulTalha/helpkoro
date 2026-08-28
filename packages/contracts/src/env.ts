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

/**
 * Development/test fallback token secrets. They satisfy the 32-char minimum so
 * local runs and CI work without extra configuration, but the schema rejects
 * them (and any too-short value) when NODE_ENV=production — real secrets must
 * come from the environment/secret store in production.
 */
const DEV_ACCESS_TOKEN_SECRET = 'helpkoro-dev-access-secret-not-for-production';
const DEV_REFRESH_TOKEN_SECRET = 'helpkoro-dev-refresh-secret-not-for-production';

/** API + worker environment (ADR-006, auth vars per ADR-005/ADR-007). */
export const apiEnvSchema = baseEnvSchema
  .extend({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: urlString,
    OTEL_SERVICE_NAME: z.string().default('helpkoro-api'),
    OTEL_EXPORTER_OTLP_ENDPOINT: urlString.optional(),
    REQUEST_ID_HEADER: z.string().default('x-request-id'),

    // --- Auth (ADR-005/ADR-007) ---
    AUTH_ACCESS_TOKEN_SECRET: z.string().min(32).default(DEV_ACCESS_TOKEN_SECRET),
    AUTH_REFRESH_TOKEN_SECRET: z.string().min(32).default(DEV_REFRESH_TOKEN_SECRET),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(1_209_600),
    /** Window during which a session is considered freshly step-up-authenticated. */
    AUTH_STEP_UP_WINDOW_SECONDS: z.coerce.number().int().positive().default(300),
    /** Set the `Secure` flag on auth cookies. Disable only for local http dev. */
    AUTH_COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    /** Optional cookie domain for first-party web apps; host-only when unset. */
    AUTH_COOKIE_DOMAIN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Access and refresh secrets must never be the same key.
    if (env.AUTH_ACCESS_TOKEN_SECRET === env.AUTH_REFRESH_TOKEN_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_REFRESH_TOKEN_SECRET'],
        message: 'must differ from AUTH_ACCESS_TOKEN_SECRET',
      });
    }
    // Production forbids the development fallback secrets.
    if (env.NODE_ENV === 'production') {
      if (env.AUTH_ACCESS_TOKEN_SECRET === DEV_ACCESS_TOKEN_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['AUTH_ACCESS_TOKEN_SECRET'],
          message: 'must be set to a strong secret in production',
        });
      }
      if (env.AUTH_REFRESH_TOKEN_SECRET === DEV_REFRESH_TOKEN_SECRET) {
        ctx.addIssue({
          code: 'custom',
          path: ['AUTH_REFRESH_TOKEN_SECRET'],
          message: 'must be set to a strong secret in production',
        });
      }
    }
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
