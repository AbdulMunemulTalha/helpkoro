import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  check,
} from 'drizzle-orm/pg-core';

/**
 * Foundation schema (Phase 0). Only the cross-cutting infrastructure tables
 * live here; domain tables (users, campaigns, ledger, payments…) arrive in
 * later phases. Column conventions follow data-and-money-contract.md.
 */

export type ActorType = 'user' | 'system' | 'service';

/**
 * Append-only audit trail (identity-access-and-security.md). Rows are never
 * updated or deleted outside an approved retention workflow. `actor_id` is a
 * nullable UUID today; the FK to `users` is added in the step-4 auth
 * migration. Before/after summaries must be pre-redacted by the caller — no
 * secrets, tokens, OTPs, or raw PII.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid('actor_id'),
    actorType: text('actor_type').$type<ActorType>().notNull(),
    sourceSessionId: uuid('source_session_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    reason: text('reason'),
    correlationId: text('correlation_id'),
    beforeSummary: jsonb('before_summary'),
    afterSummary: jsonb('after_summary'),
  },
  (t) => [
    index('audit_events_entity_idx').on(t.entityType, t.entityId),
    index('audit_events_actor_idx').on(t.actorId),
    index('audit_events_occurred_at_idx').on(t.occurredAt),
    index('audit_events_correlation_idx').on(t.correlationId),
    check('audit_events_actor_type_check', sql`${t.actorType} in ('user', 'system', 'service')`),
  ],
);

/** DB-backed feature flags for staged rollouts (keyed by stable string key). */
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  description: text('description').notNull().default(''),
  enabled: boolean('enabled').notNull().default(false),
  rollout: jsonb('rollout'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1),
});

export type OutboxStatus = 'pending' | 'dispatched' | 'failed';

/**
 * Transactional outbox. Domain writes enqueue an event in the same DB
 * transaction; a dispatcher relays them to the queue and marks them dispatched.
 * The `(status, available_at)` index backs the dispatcher poll.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: uuid('id').primaryKey(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').$type<OutboxStatus>().notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    lastError: text('last_error'),
  },
  (t) => [
    index('outbox_events_status_available_idx').on(t.status, t.availableAt),
    check('outbox_events_status_check', sql`${t.status} in ('pending', 'dispatched', 'failed')`),
  ],
);
