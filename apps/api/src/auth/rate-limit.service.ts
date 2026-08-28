import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DatabaseHandle } from '@helpkoro/db';
import { DATABASE } from '../infra/database.module';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window resets (best-effort). */
  resetSeconds: number;
}

/**
 * Fixed-window rate limiting backed by Postgres (identity-access-and-security.md:
 * login/reset throttling). A single atomic upsert either opens a new window (row
 * absent or expired ⇒ count 1) or increments the current one, mirroring the old
 * Redis INCR/EXPIRE semantics without a separate Redis service. The row-level
 * lock taken by `ON CONFLICT DO UPDATE` makes concurrent hits on the same key
 * serialise correctly, so the counter never races.
 *
 * Fail-open on storage errors is deliberate — a rate-limiter outage must not take
 * down auth — and the error is logged. The store here is the same Postgres auth
 * already depends on, so a hard failure would surface elsewhere anyway; blocking
 * logins on top of that would only compound the outage.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(@Inject(DATABASE) private readonly database: DatabaseHandle) {}

  async hit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    try {
      const rows = await this.database.sql<{ count: number; expires_at: Date }[]>`
        insert into rate_limit_counters (key, count, expires_at)
        values (${key}, 1, now() + (${windowSeconds}::int * interval '1 second'))
        on conflict (key) do update set
          count = case
            when rate_limit_counters.expires_at <= now() then 1
            else rate_limit_counters.count + 1
          end,
          expires_at = case
            when rate_limit_counters.expires_at <= now()
              then now() + (${windowSeconds}::int * interval '1 second')
            else rate_limit_counters.expires_at
          end
        returning count, expires_at
      `;

      // The upsert always RETURNs exactly one row; the guard satisfies
      // noUncheckedIndexedAccess and, if it ever failed, falls through to
      // fail-open via the catch below.
      const row = rows[0];
      if (!row) throw new Error('rate_limit_counters upsert returned no row');
      const { count, expires_at: expiresAt } = row;
      const resetSeconds = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));

      // Opportunistic housekeeping: rows are bounded by distinct keys (ip+route),
      // but expired ones linger. Prune ~1% of hits so the table stays small
      // without a scheduled job. Fire-and-forget; failures are irrelevant.
      if (Math.random() < 0.01) void this.pruneExpired();

      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetSeconds,
      };
    } catch (error) {
      this.logger.error(`rate limit check failed for "${key}"; failing open`, error as Error);
      return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
    }
  }

  private async pruneExpired(): Promise<void> {
    try {
      await this.database.sql`delete from rate_limit_counters where expires_at < now()`;
    } catch {
      // Best-effort cleanup — never let housekeeping surface an error.
    }
  }
}
