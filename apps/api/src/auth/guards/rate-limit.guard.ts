import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '@helpkoro/contracts';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../auth.decorators';
import { RateLimitService } from '../rate-limit.service';

/**
 * Enforces per-route fixed-window rate limits declared with `@RateLimit`.
 * Registered globally but only acts on routes that carry the metadata, so it
 * protects sensitive endpoints (login, register, refresh, step-up, password
 * change) without touching the rest. Keyed by client IP + route name.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const options = this.reflector.get<RateLimitOptions | undefined>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );
    if (!options) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const name = options.name ?? `${context.getClass().name}.${context.getHandler().name}`;
    const key = `${name}:${request.ip}`;

    const result = await this.rateLimit.hit(key, options.limit, options.windowSeconds);
    if (!result.allowed) {
      const reply = context.switchToHttp().getResponse<FastifyReply>();
      void reply.header('retry-after', String(result.resetSeconds));
      throw new AppError('RATE_LIMITED', 'Too many requests. Please try again later.');
    }
    return true;
  }
}
