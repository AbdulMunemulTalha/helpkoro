import { Inject, Injectable } from '@nestjs/common';
import { auditEvents, type ActorType, type DatabaseHandle } from '@helpkoro/db';
import { uuidv7 } from '@helpkoro/contracts';
import { DATABASE } from '../infra/database.module';
import { getRequestId } from '../common/request-context';

/**
 * A single audit record. `beforeSummary`/`afterSummary` must be pre-redacted by
 * the caller — no secrets, tokens, OTPs, or raw PII (see data-and-money-contract
 * and identity-access-and-security). The correlation id is taken from the
 * current request automatically.
 */
export interface AuditInput {
  action: string;
  entityType: string;
  actorType: ActorType;
  entityId?: string;
  actorId?: string;
  /** The session that originated the action (identity-access-and-security.md). */
  sourceSessionId?: string;
  reason?: string;
  beforeSummary?: unknown;
  afterSummary?: unknown;
}

/** Appends rows to the immutable `audit_events` trail. Never updates/deletes. */
@Injectable()
export class AuditService {
  constructor(@Inject(DATABASE) private readonly handle: DatabaseHandle) {}

  async record(input: AuditInput): Promise<void> {
    await this.handle.db.insert(auditEvents).values({
      id: uuidv7(),
      actorId: input.actorId ?? null,
      actorType: input.actorType,
      sourceSessionId: input.sourceSessionId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      reason: input.reason ?? null,
      correlationId: getRequestId() ?? null,
      beforeSummary: input.beforeSummary ?? null,
      afterSummary: input.afterSummary ?? null,
    });
  }
}
