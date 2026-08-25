import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../infra/redis.module';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets (best-effort). */
  resetSeconds: number;
}

/**
 * Fixed-window rate limiting backed by Redis (identity-access-and-security.md:
 * login/reset throttling). The first hit in a window sets the TTL; subsequent
 * hits increment. Fail-open on Redis errors is deliberate — a rate-limiter
 * outage must not take down auth — but the error is surfaced to the caller so
 * it can be logged.
 */
@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `rl:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) {
      await this.redis.expire(redisKey, windowSeconds);
    }
    const ttl = count === 1 ? windowSeconds : await this.redis.ttl(redisKey);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }
}
