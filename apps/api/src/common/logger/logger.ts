import { pino, type Logger } from 'pino';
import type { ApiEnv } from '@helpkoro/contracts';
import { getRequestId, getRequestPrincipal } from '../request-context';

/**
 * Build the process-wide pino logger. A `mixin` stamps the current request's
 * correlation id (and, once authenticated, the user/session ids) onto every
 * line — pulled from AsyncLocalStorage — so logs are traceable without
 * threading the ids through call sites. In development we pipe through
 * pino-pretty for readable output; production stays as JSON lines.
 *
 * `redact` is a safety net only — callers must never pass secrets, tokens, OTPs,
 * or raw PII to the logger in the first place (see CLAUDE.md).
 */
export function createLogger(env: Pick<ApiEnv, 'LOG_LEVEL' | 'NODE_ENV'>): Logger {
  const isDevelopment = env.NODE_ENV === 'development';

  return pino({
    level: env.LOG_LEVEL,
    mixin() {
      const requestId = getRequestId();
      const { userId, sessionId } = getRequestPrincipal();
      return {
        ...(requestId ? { requestId } : {}),
        ...(userId ? { userId } : {}),
        ...(sessionId ? { sessionId } : {}),
      };
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.otp',
        '*.secret',
      ],
      remove: true,
    },
    ...(isDevelopment
      ? {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'SYS:standard', ignore: 'pid,hostname' },
          },
        }
      : {}),
  });
}
