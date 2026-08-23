import {
  Catch,
  HttpException,
  Inject,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Logger } from 'pino';
import {
  ERROR_STATUS,
  isAppError,
  type ErrorEnvelope,
  type StableErrorCode,
} from '@helpkoro/contracts';
import { getRequestId } from '../request-context';
import { PINO_LOGGER } from '../logger/logger.tokens';

/** Map an HTTP status to the nearest stable error code (ADR-006 vocabulary). */
export function mapHttpStatusToCode(status: number): StableErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'VALIDATION_FAILED';
    case 401:
      return 'AUTH_REQUIRED';
    case 402:
      return 'PAYMENT_PENDING';
    case 403:
      return 'FORBIDDEN';
    case 409:
      return 'STATE_CONFLICT';
    default:
      // 5xx (and anything unmapped at/above 500) is INTERNAL; other 4xx fall
      // back to VALIDATION_FAILED since the stable set has no generic 4xx code.
      return status >= 500 ? 'INTERNAL' : 'VALIDATION_FAILED';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Extract a client-safe message from a Nest HttpException payload. */
function httpExceptionMessage(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (isRecord(response) && 'message' in response) {
    const message = response.message;
    if (Array.isArray(message)) {
      return message.map((entry) => String(entry)).join('; ');
    }
    if (typeof message === 'string') {
      return message;
    }
  }
  return exception.message;
}

/**
 * Terminal exception filter: converts every thrown value into the ADR-006 error
 * envelope `{ error: { code, message, details? }, meta: { requestId } }`.
 *
 * - {@link AppError} → its own stable code, mapped status, and message/details.
 * - Nest `HttpException` → status-mapped stable code + its (developer-authored)
 *   message.
 * - Anything else → `INTERNAL`/500 with a generic message. The real error is
 *   logged server-side with the request id but never serialised to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(PINO_LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      // Not an HTTP request (e.g. a lifecycle error) — let it propagate.
      throw exception;
    }

    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();
    const requestId = request.requestId ?? getRequestId() ?? '';

    let status = ERROR_STATUS.INTERNAL;
    let code: StableErrorCode = 'INTERNAL';
    let message = 'An unexpected error occurred.';
    let details: unknown;

    if (isAppError(exception)) {
      status = exception.status;
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = mapHttpStatusToCode(status);
      message = httpExceptionMessage(exception);
    }

    if (status >= 500) {
      // Full context server-side only; the client sees the generic message.
      this.logger.error({ err: exception, requestId }, 'Unhandled request error');
    } else {
      this.logger.warn({ code, status, requestId }, message);
    }

    const envelope: ErrorEnvelope = {
      error: { code, message, ...(details !== undefined ? { details } : {}) },
      meta: { requestId },
    };

    void reply.status(status).send(envelope);
  }
}
