import { Inject, Injectable } from '@nestjs/common';
import type { DatabaseHandle } from '@helpkoro/db';
import { DATABASE } from '../infra/database.module';

type CheckState = 'ok' | 'down';

export interface LivenessResult {
  status: 'ok';
  checks: { process: 'ok' };
}

export interface ReadinessResult {
  ok: boolean;
  body: {
    status: 'ok' | 'degraded';
    checks: { postgres: CheckState };
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
  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  /** Liveness: the process is up and serving. Never touches dependencies. */
  live(): LivenessResult {
    return { status: 'ok', checks: { process: 'ok' } };
  }

  /** Readiness: dependencies are reachable. Any failure ⇒ degraded/503. */
  async ready(): Promise<ReadinessResult> {
    const postgres = await this.checkPostgres();
    const ok = postgres === 'ok';
    return { ok, body: { status: ok ? 'ok' : 'degraded', checks: { postgres } } };
  }

  private async checkPostgres(): Promise<CheckState> {
    try {
      await withTimeout(this.database.sql`select 1`, PROBE_TIMEOUT_MS);
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
