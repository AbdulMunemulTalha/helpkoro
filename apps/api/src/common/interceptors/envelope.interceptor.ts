import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { map, type Observable } from 'rxjs';
import type { SuccessEnvelope } from '@helpkoro/contracts';
import { getRequestId } from '../request-context';
import { SKIP_ENVELOPE } from './skip-envelope.decorator';

/**
 * Wraps successful HTTP handler results in the ADR-006 success envelope:
 * `{ data, meta: { requestId } }`. Routes marked with {@link SkipEnvelope}
 * (health probes) and non-HTTP contexts pass through untouched.
 */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ENVELOPE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const requestId = request.requestId ?? getRequestId() ?? '';

    return next
      .handle()
      .pipe(map((data): SuccessEnvelope<unknown> => ({ data, meta: { requestId } })));
  }
}
