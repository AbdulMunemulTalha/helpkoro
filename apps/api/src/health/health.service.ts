import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { DatabaseHandle } from '@helpkoro/db';
import { DATABASE } from '../infra/database.module';
import { REDIS } from '../infra/redis.module';

type CheckState = 'ok' | 'down';

export interface LivenessResult {
  status: 'ok';
  checks: { process: 'ok' };
}

export interface ReadinessResult {
  ok: boolean;
  body: {
    status: 'ok' | 'degraded';
    checks: { postgres: CheckState; redis: CheckState };
  };
}

/** Reject if `promise` does not settle within `ms` — keeps probes fast. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

const PROBE_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  constructor(
    @Inject(DATABASE) private readonly database: DatabaseHandle,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  /** Liveness: the process is up and serving. Never touches dependencies. */
  live(): LivenessResult {
    return { status: 'ok', checks: { process: 'ok' } };
  }

  /** Readiness: dependencies are reachable. Any failure ⇒ degraded/503. */
  async ready(): Promise<ReadinessResult> {
    const [postgres, redis] = await Promise.all([this.checkPostgres(), this.checkRedis()]);
    const ok = postgres === 'ok' && redis === 'ok';
    return { ok, body: { status: ok ? 'ok' : 'degraded', checks: { postgres, redis } } };
  }

  private async checkPostgres(): Promise<CheckState> {
    try {
      await withTimeout(this.database.sql`select 1`, PROBE_TIMEOUT_MS);
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<CheckState> {
    try {
      const pong = await withTimeout(this.redis.ping(), PROBE_TIMEOUT_MS);
      return pong === 'PONG' ? 'ok' : 'down';
    } catch {
      return 'down';
    }
  }
}
