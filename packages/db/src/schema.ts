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
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';

/**
 * Foundation schema. Cross-cutting infrastructure tables plus the identity
 * tables (users, credentials, roles, sessions) introduced by the auth pass
 * (ADR-005/ADR-007). Domain tables (campaigns, ledger, payments…) arrive in
 * later phases. Column conventions follow data-and-money-contract.md.
 */

export type ActorType = 'user' | 'system' | 'service';

export type AccountStatus = 'active' | 'suspended' | 'disabled';
export type Locale = 'en' | 'bn';

/**
 * Platform accounts. `email` is stored already-normalised (trimmed, lowercased
 * by the contract schema); the unique index therefore enforces case-insensitive
 * uniqueness. The password hash lives in `user_credentials`, not here, to keep
 * the most sensitive secret behind a separate table boundary.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    status: text('status').$type<AccountStatus>().notNull().default('active'),
    locale: text('locale').$type<Locale>().notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    check('users_status_check', sql`${t.status} in ('active', 'suspended', 'disabled')`),
    check('users_locale_check', sql`${t.locale} in ('en', 'bn')`),
  ],
);

/**
 * Password credentials (1:1 with `users`). Isolated so the Argon2id hash is not
 * loaded on ordinary profile reads. `password_updated_at` drives session
 * invalidation on password change.
 */
export const userCredentials = pgTable('user_credentials', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  passwordUpdatedAt: timestamp('password_updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Role grants (many-to-many user↔role). `role` is validated against the
 * `@helpkoro/domain` vocabulary in the API before insert. `granted_by` records
 * the administrator who made the grant (null for system/bootstrap grants).
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('user_roles_user_role_unique').on(t.userId, t.role),
    index('user_roles_user_idx').on(t.userId),
  ],
);

export type SessionRevokedReason =
  'logout' | 'reuse_detected' | 'password_change' | 'role_change' | 'admin_revoke';

/**
 * Refresh-token sessions (ADR-005). We store only the *hash* of the current
 * refresh token plus a rotating nonce; on each refresh the nonce rotates and
 * the old token is invalidated. Presenting a superseded token (reuse) triggers
 * revocation of the whole session. `step_up_at` records the last step-up
 * re-authentication for sensitive-action freshness checks.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    refreshNonce: text('refresh_nonce').notNull(),
    stepUpAt: timestamp('step_up_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason').$type<SessionRevokedReason>(),
  },
  (t) => [
    index('sessions_user_idx').on(t.userId),
    index('sessions_expires_at_idx').on(t.expiresAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type UserRoleRow = typeof userRoles.$inferSelect;

/**
 * Append-only audit trail (identity-access-and-security.md). Rows are never
 * updated or deleted outside an approved retention workflow. `actor_id`
 * references `users` for user actors and is null for system/service actors.
 * Before/after summaries must be pre-redacted by the caller — no secrets,
 * tokens, OTPs, or raw PII.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
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

/**
 * Campaign domain tables (Phase 1 / ADR-008). These carry no money: goals are a
 * target amount only; donations, ledger, and payouts arrive in Phases 2–3. The
 * lifecycle state machine lives in `@helpkoro/domain`; the CHECK constraints
 * here are a defensive backstop, not the source of truth for transitions.
 *
 * The string-literal unions below intentionally mirror `@helpkoro/domain` and
 * `@helpkoro/contracts` (as `AccountStatus`/`Locale` already do above): the DB
 * layer owns its own `$type<>` annotations so a schema read never has to import
 * the domain package.
 */
export type CampaignStatus =
  'draft' | 'submitted' | 'under_review' | 'live' | 'paused' | 'closed' | 'rejected';

export type CampaignCategory =
  | 'medical'
  | 'emergency'
  | 'memorial'
  | 'education'
  | 'community'
  | 'disaster_response'
  | 'nonprofit'
  | 'personal';

export type BeneficiaryType = 'myself' | 'someone_else' | 'organization';

/**
 * Consent state for a beneficiary who is not the organizer. `not_required` for a
 * `myself` campaign; `pending` until the third-party beneficiary (or their
 * organization) confirms. The evidence/consent capture pipeline lands in
 * Increment 3; for now this records intent on the campaign row.
 */
export type BeneficiaryConsentStatus = 'not_required' | 'pending' | 'granted';

/**
 * A fundraising campaign. `organizer_id` uses ON DELETE RESTRICT: a user who
 * owns campaigns cannot be hard-deleted (accounts are disabled, not deleted —
 * and money/audit retention forbids cascading these away). `slug` backs the
 * public URL and is globally unique. `goal_amount` is integer minor units with
 * an explicit `currency` — never a float, never a client-trusted total.
 */
export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').primaryKey(),
    organizerId: uuid('organizer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    story: text('story'),
    category: text('category').$type<CampaignCategory>().notNull(),
    subcategory: text('subcategory'),
    beneficiaryType: text('beneficiary_type').$type<BeneficiaryType>().notNull(),
    beneficiaryRelationship: text('beneficiary_relationship'),
    beneficiaryConsentStatus: text('beneficiary_consent_status')
      .$type<BeneficiaryConsentStatus>()
      .notNull()
      .default('not_required'),
    intendedUse: text('intended_use'),
    timeline: text('timeline'),
    goalAmount: integer('goal_amount').notNull(),
    currency: text('currency').notNull(),
    primaryLanguage: text('primary_language').$type<Locale>().notNull().default('bn'),
    slug: text('slug').notNull(),
    status: text('status').$type<CampaignStatus>().notNull().default('draft'),
    version: integer('version').notNull().default(1),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('campaigns_slug_unique').on(t.slug),
    index('campaigns_organizer_idx').on(t.organizerId),
    // Backs public discovery: filter by status='live', order by publish/create time.
    index('campaigns_status_created_idx').on(t.status, t.createdAt),
    check(
      'campaigns_category_check',
      sql`${t.category} in ('medical', 'emergency', 'memorial', 'education', 'community', 'disaster_response', 'nonprofit', 'personal')`,
    ),
    check(
      'campaigns_beneficiary_type_check',
      sql`${t.beneficiaryType} in ('myself', 'someone_else', 'organization')`,
    ),
    check(
      'campaigns_beneficiary_consent_check',
      sql`${t.beneficiaryConsentStatus} in ('not_required', 'pending', 'granted')`,
    ),
    check(
      'campaigns_status_check',
      sql`${t.status} in ('draft', 'submitted', 'under_review', 'live', 'paused', 'closed', 'rejected')`,
    ),
    check('campaigns_primary_language_check', sql`${t.primaryLanguage} in ('en', 'bn')`),
    check('campaigns_goal_amount_positive_check', sql`${t.goalAmount} >= 1`),
  ],
);

/**
 * Immutable snapshot of a campaign at the moment it was submitted for review.
 * Append-only: rows are never updated. One row per `(campaign_id, version)` so a
 * resubmission after a `request_info` cycle records a fresh, comparable snapshot.
 */
export const campaignSubmissions = pgTable(
  'campaign_submissions',
  {
    id: uuid('id').primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'restrict' }),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    submittedBy: uuid('submitted_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('campaign_submissions_campaign_version_unique').on(t.campaignId, t.version),
    index('campaign_submissions_campaign_idx').on(t.campaignId),
  ],
);

export type ReviewCaseStatus = 'queued' | 'in_review' | 'needs_information' | 'resolved';

/**
 * A moderation case opened when a campaign is submitted. At most one *open*
 * (non-`resolved`) case may exist per campaign — enforced by the partial unique
 * index below, which is the DB-level backstop for the idempotent-submit rule
 * ("duplicate launch requests create one review case only").
 */
export const reviewCases = pgTable(
  'review_cases',
  {
    id: uuid('id').primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'restrict' }),
    status: text('status').$type<ReviewCaseStatus>().notNull().default('queued'),
    priority: integer('priority').notNull().default(0),
    assignedReviewerId: uuid('assigned_reviewer_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    version: integer('version').notNull().default(1),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    index('review_cases_status_opened_idx').on(t.status, t.openedAt),
    index('review_cases_campaign_idx').on(t.campaignId),
    // One open case per campaign (idempotent submit). Resolved cases are exempt,
    // so a campaign may accumulate a history of resolved cases over its life.
    uniqueIndex('review_cases_one_open_per_campaign')
      .on(t.campaignId)
      .where(sql`${t.status} <> 'resolved'`),
    check(
      'review_cases_status_check',
      sql`${t.status} in ('queued', 'in_review', 'needs_information', 'resolved')`,
    ),
  ],
);

export type ReviewDecisionValue = 'approve' | 'reject' | 'request_info';

/**
 * Immutable, append-only record of every reviewer decision. High-impact
 * decisions are human-only by construction — there is no automated write path.
 * `evidence_refs` holds opaque handles to review artifacts stored out of band;
 * never inline evidence content or raw PII here.
 */
export const reviewDecisions = pgTable(
  'review_decisions',
  {
    id: uuid('id').primaryKey(),
    reviewCaseId: uuid('review_case_id')
      .notNull()
      .references(() => reviewCases.id, { onDelete: 'restrict' }),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'restrict' }),
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    decision: text('decision').$type<ReviewDecisionValue>().notNull(),
    reasonCode: text('reason_code').notNull(),
    organizerExplanation: text('organizer_explanation'),
    evidenceRefs: jsonb('evidence_refs'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('review_decisions_case_idx').on(t.reviewCaseId),
    index('review_decisions_campaign_idx').on(t.campaignId),
    check(
      'review_decisions_decision_check',
      sql`${t.decision} in ('approve', 'reject', 'request_info')`,
    ),
  ],
);

export type CampaignRow = typeof campaigns.$inferSelect;
export type NewCampaignRow = typeof campaigns.$inferInsert;
export type CampaignSubmissionRow = typeof campaignSubmissions.$inferSelect;
export type ReviewCaseRow = typeof reviewCases.$inferSelect;
export type ReviewDecisionRow = typeof reviewDecisions.$inferSelect;
