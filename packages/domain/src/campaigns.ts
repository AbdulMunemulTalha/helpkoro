/**
 * Campaign lifecycle: the pure state machine, the category / beneficiary
 * vocabularies, the review-case vocabulary, and the public-visibility predicate.
 *
 * This module is pure — no DB, no framework, and (deliberately, like `money.ts`)
 * no `@helpkoro/contracts` import. An illegal transition returns `null`; the API
 * service maps that to a `STATE_CONFLICT` error. Keeping the domain free of the
 * contracts/AppError dependency preserves the layering rule.
 *
 * Persisted campaign states are the seven in feature-catalog.md. The wizard's
 * pre-submit checkpoints (basics complete → account verified → story/media
 * complete, per the onboarding funnel state machine) are UI progress, not
 * persisted states. "Needs information" is a *review-case* status, not a
 * campaign state (see end-to-end-platform-process.md §4 and ADR-008).
 */

// --- Categories & beneficiary types -----------------------------------------
// Allowed causes, per gofundme-inspired-fundraiser-onboarding.md Step 3.
// Investment, reward, loan, equity, prohibited, and misleading categories are
// intentionally excluded and must never be added here without policy sign-off.
export const CAMPAIGN_CATEGORIES = [
  'medical',
  'emergency',
  'memorial',
  'education',
  'community',
  'disaster_response',
  'nonprofit',
  'personal',
] as const;
export type CampaignCategory = (typeof CAMPAIGN_CATEGORIES)[number];

export function isCampaignCategory(value: string): value is CampaignCategory {
  return (CAMPAIGN_CATEGORIES as readonly string[]).includes(value);
}

/** Who the fundraiser is for (onboarding funnel Step 2). */
export const BENEFICIARY_TYPES = ['myself', 'someone_else', 'organization'] as const;
export type BeneficiaryType = (typeof BENEFICIARY_TYPES)[number];

export function isBeneficiaryType(value: string): value is BeneficiaryType {
  return (BENEFICIARY_TYPES as readonly string[]).includes(value);
}

// --- Campaign lifecycle state machine ---------------------------------------
export const CAMPAIGN_STATES = [
  'draft',
  'submitted',
  'under_review',
  'live',
  'paused',
  'closed',
  'rejected',
] as const;
export type CampaignState = (typeof CAMPAIGN_STATES)[number];

export function isCampaignState(value: string): value is CampaignState {
  return (CAMPAIGN_STATES as readonly string[]).includes(value);
}

/** Lifecycle events a service applies to a campaign to drive a transition. */
export const CAMPAIGN_EVENTS = [
  'submit',
  'start_review',
  'approve',
  'request_info',
  'reject',
  'pause',
  'resume',
  'close',
] as const;
export type CampaignEvent = (typeof CAMPAIGN_EVENTS)[number];

/**
 * The transition table. A `(state, event)` pair absent from the table is not a
 * permitted transition. Guards are enforced by omission:
 *  - `rejected` and `closed` are terminal (no outgoing edges) — so a rejected
 *    campaign can never move to `live` without a *new* review decision, per
 *    end-to-end-platform-process.md §4 / the onboarding state machine.
 *  - `request_info` keeps the campaign in `under_review`; it moves the *review
 *    case* to `needs_information` (the campaign does not publish or reject).
 *  - Only `approve` (a reviewer/system decision) reaches `live`.
 */
const TRANSITIONS: {
  readonly [S in CampaignState]: Partial<Record<CampaignEvent, CampaignState>>;
} = {
  draft: { submit: 'submitted' },
  submitted: {
    start_review: 'under_review',
    approve: 'live',
    request_info: 'under_review',
    reject: 'rejected',
  },
  under_review: {
    approve: 'live',
    request_info: 'under_review',
    reject: 'rejected',
  },
  live: { pause: 'paused', close: 'closed' },
  paused: { resume: 'live', close: 'closed' },
  closed: {},
  rejected: {},
};

/**
 * The next state for applying `event` to a campaign in `state`, or `null` when
 * the transition is not permitted. Pure: callers decide how to surface `null`
 * (the API maps it to `STATE_CONFLICT`).
 */
export function campaignTransition(
  state: CampaignState,
  event: CampaignEvent,
): CampaignState | null {
  return TRANSITIONS[state][event] ?? null;
}

/** Whether `event` is a legal transition from `state`. */
export function canApplyCampaignEvent(state: CampaignState, event: CampaignEvent): boolean {
  return campaignTransition(state, event) !== null;
}

/**
 * Only `live` campaigns are publicly discoverable and readable
 * (end-to-end-platform-process.md §4/§5). Draft, submitted, under_review,
 * paused, closed, and rejected campaigns must never surface on public routes —
 * a submitted campaign cannot become public by client flag or URL manipulation.
 */
export function isPubliclyVisible(state: CampaignState): boolean {
  return state === 'live';
}

// --- Review case & decisions ------------------------------------------------
/**
 * Review-case status. Distinct from the campaign state: a case is `queued` on
 * submission, `in_review` once a reviewer picks it up, `needs_information` after
 * a clarification request, and `resolved` once approved or rejected.
 */
export const REVIEW_CASE_STATUSES = [
  'queued',
  'in_review',
  'needs_information',
  'resolved',
] as const;
export type ReviewCaseStatus = (typeof REVIEW_CASE_STATUSES)[number];

export function isReviewCaseStatus(value: string): value is ReviewCaseStatus {
  return (REVIEW_CASE_STATUSES as readonly string[]).includes(value);
}

/**
 * Review decisions a reviewer can record in Phase 1 — a subset of the full set
 * in end-to-end-platform-process.md §4 (pause / escalate / route-to-finance
 * arrive with the moderation + operations increment). Each decision maps to the
 * campaign lifecycle event it triggers.
 */
export const REVIEW_DECISIONS = ['approve', 'reject', 'request_info'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export function isReviewDecision(value: string): value is ReviewDecision {
  return (REVIEW_DECISIONS as readonly string[]).includes(value);
}

/** The lifecycle event each review decision applies to the campaign. */
export const REVIEW_DECISION_EVENT: Readonly<Record<ReviewDecision, CampaignEvent>> = {
  approve: 'approve',
  reject: 'reject',
  request_info: 'request_info',
};

/** The review-case status a decision resolves the case to. */
export const REVIEW_DECISION_CASE_STATUS: Readonly<Record<ReviewDecision, ReviewCaseStatus>> = {
  approve: 'resolved',
  reject: 'resolved',
  request_info: 'needs_information',
};
