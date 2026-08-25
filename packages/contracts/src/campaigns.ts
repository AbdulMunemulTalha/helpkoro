import { z } from 'zod';

import { currencyCode, minorUnits } from './money';
import { paginationQuery } from './pagination';

/**
 * Campaign request/response contracts (ADR-006 wire conventions; lifecycle and
 * vocabularies defined in ADR-008). This module is the single source of truth
 * for the shapes crossing the API boundary — the domain state machine lives in
 * `@helpkoro/domain` and is intentionally not imported here (contracts depend
 * only on `zod`, so every workspace package and both web apps can consume them).
 *
 * The enum *values* below are duplicated from `@helpkoro/domain` on purpose: the
 * domain owns the transition rules, the contract owns the wire vocabulary, and a
 * unit test in each package pins its own copy. Money is integer minor units with
 * an explicit currency (never a float, never a client-trusted total).
 */

// --- Vocabularies (mirror @helpkoro/domain; see ADR-008) --------------------
export const campaignCategorySchema = z.enum([
  'medical',
  'emergency',
  'memorial',
  'education',
  'community',
  'disaster_response',
  'nonprofit',
  'personal',
]);
export type CampaignCategoryInput = z.infer<typeof campaignCategorySchema>;

export const beneficiaryTypeSchema = z.enum(['myself', 'someone_else', 'organization']);
export type BeneficiaryTypeInput = z.infer<typeof beneficiaryTypeSchema>;

export const campaignStateSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'live',
  'paused',
  'closed',
  'rejected',
]);
export type CampaignStateValue = z.infer<typeof campaignStateSchema>;

/** Content language for a campaign — Bangla-first, English supported. */
export const campaignLanguageSchema = z.enum(['bn', 'en']);
export type CampaignLanguage = z.infer<typeof campaignLanguageSchema>;

/**
 * The reviewer decisions available in Phase 1 (a subset of the full moderation
 * set; pause/escalate/route-to-finance arrive with the moderation increment).
 */
export const reviewDecisionSchema = z.enum(['approve', 'reject', 'request_info']);
export type ReviewDecisionInputValue = z.infer<typeof reviewDecisionSchema>;

// --- Field validators -------------------------------------------------------
const titleSchema = z.string().trim().min(8).max(120);
const summarySchema = z.string().trim().min(20).max(300);
const subcategorySchema = z.string().trim().min(1).max(80);
const storySchema = z.string().trim().min(1).max(20_000);
const intendedUseSchema = z.string().trim().min(1).max(2_000);
const timelineSchema = z.string().trim().min(1).max(2_000);
const beneficiaryRelationshipSchema = z.string().trim().min(1).max(120);

/**
 * Fundraising goal in integer minor units. Must be at least 1 (a zero or
 * negative goal is never valid); an upper bound is a country-policy concern
 * validated server-side, not fixed in the wire contract.
 */
export const goalAmountSchema = minorUnits.refine((v) => v >= 1, {
  message: 'goal must be at least 1 minor unit',
});

// --- Request contracts ------------------------------------------------------
/**
 * Create a campaign draft. Cross-field rule: a `someone_else` beneficiary must
 * declare the relationship to the beneficiary (consent handling and evidence
 * upload land with the Increment 3 uploads pipeline; for now the relationship
 * is captured on the draft). `organization` beneficiaries are handled with the
 * organizations table in a later increment and only carry the type here.
 */
export const createCampaignDraftInputSchema = z
  .object({
    title: titleSchema,
    summary: summarySchema,
    category: campaignCategorySchema,
    subcategory: subcategorySchema.optional(),
    beneficiaryType: beneficiaryTypeSchema,
    beneficiaryRelationship: beneficiaryRelationshipSchema.optional(),
    goalAmount: goalAmountSchema,
    currency: currencyCode,
    primaryLanguage: campaignLanguageSchema,
    story: storySchema.optional(),
    intendedUse: intendedUseSchema.optional(),
    timeline: timelineSchema.optional(),
  })
  .refine((v) => v.beneficiaryType !== 'someone_else' || v.beneficiaryRelationship != null, {
    message: 'beneficiaryRelationship is required when raising for someone else',
    path: ['beneficiaryRelationship'],
  });
export type CreateCampaignDraftInput = z.infer<typeof createCampaignDraftInputSchema>;

/**
 * Partial update to a draft. Every field is optional, but the same cross-field
 * rule holds: if the update sets `beneficiaryType` to `someone_else`, it must
 * also carry a relationship. (An update that leaves `beneficiaryType` untouched
 * is validated against the persisted row by the service.)
 */
export const updateCampaignDraftInputSchema = z
  .object({
    title: titleSchema.optional(),
    summary: summarySchema.optional(),
    category: campaignCategorySchema.optional(),
    subcategory: subcategorySchema.nullable().optional(),
    beneficiaryType: beneficiaryTypeSchema.optional(),
    beneficiaryRelationship: beneficiaryRelationshipSchema.nullable().optional(),
    goalAmount: goalAmountSchema.optional(),
    currency: currencyCode.optional(),
    primaryLanguage: campaignLanguageSchema.optional(),
    story: storySchema.nullable().optional(),
    intendedUse: intendedUseSchema.nullable().optional(),
    timeline: timelineSchema.nullable().optional(),
  })
  .refine(
    (v) => v.beneficiaryType !== 'someone_else' || (v.beneficiaryRelationship ?? null) != null,
    {
      message: 'beneficiaryRelationship is required when raising for someone else',
      path: ['beneficiaryRelationship'],
    },
  );
export type UpdateCampaignDraftInput = z.infer<typeof updateCampaignDraftInputSchema>;

/** Public discovery query: cursor pagination + an optional category filter. */
export const campaignListQuery = paginationQuery.extend({
  category: campaignCategorySchema.optional(),
});
export type CampaignListQuery = z.infer<typeof campaignListQuery>;

/** Organizer's own-campaign listing: pagination + an optional state filter. */
export const organizerCampaignListQuery = paginationQuery.extend({
  state: campaignStateSchema.optional(),
});
export type OrganizerCampaignListQuery = z.infer<typeof organizerCampaignListQuery>;

/** Reviewer queue listing: pagination only (queued + under-review cases). */
export const reviewQueueQuery = paginationQuery;
export type ReviewQueueQuery = z.infer<typeof reviewQueueQuery>;

/**
 * A reviewer's decision on a submitted campaign. `reasonCode` is a stable,
 * machine-readable tag for audit/analytics; `organizerExplanation` is the
 * message shown to the organizer (required for reject / request_info so the
 * organizer always learns why). `evidenceRefs` are opaque handles to review
 * artifacts stored out of band — never inline evidence content here.
 */
export const reviewDecisionInputSchema = z
  .object({
    decision: reviewDecisionSchema,
    reasonCode: z.string().trim().min(1).max(80),
    organizerExplanation: z.string().trim().max(4_000).optional(),
    evidenceRefs: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  })
  .refine((v) => v.decision === 'approve' || (v.organizerExplanation ?? '').length > 0, {
    message: 'an explanation for the organizer is required to reject or request information',
    path: ['organizerExplanation'],
  });
export type ReviewDecisionInput = z.infer<typeof reviewDecisionInputSchema>;

// --- Response contracts (hand-authored views) -------------------------------
// Views are plain interfaces (not Zod-inferred) so the API can shape exactly
// what each audience may see. The PUBLIC view is the trust boundary: it must
// never carry payout, evidence, internal-review, private-contact, or raw
// beneficiary-identity fields (see CLAUDE.md sensitive-data rules / ADR-008).

/** What an unauthenticated visitor may see about a *live* campaign. */
export interface CampaignPublicView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  story: string | null;
  category: CampaignCategoryInput;
  subcategory: string | null;
  /** Coarse beneficiary type only — never the beneficiary's identity/contact. */
  beneficiaryType: BeneficiaryTypeInput;
  goalAmount: number;
  currency: string;
  primaryLanguage: CampaignLanguage;
  /** Always 'live' for a public view; included so clients need not infer it. */
  state: Extract<CampaignStateValue, 'live'>;
  organizerDisplayName: string;
  publishedAt: string;
  createdAt: string;
}

/** A row in a public discovery list — a trimmed {@link CampaignPublicView}. */
export interface CampaignSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: CampaignCategoryInput;
  goalAmount: number;
  currency: string;
  primaryLanguage: CampaignLanguage;
  publishedAt: string;
}

/** The organizer's own view of their campaign — richer, but still no internal
 * review notes or evidence content (those belong to the reviewer view). */
export interface CampaignOrganizerView {
  id: string;
  slug: string;
  title: string;
  summary: string;
  story: string | null;
  category: CampaignCategoryInput;
  subcategory: string | null;
  beneficiaryType: BeneficiaryTypeInput;
  beneficiaryRelationship: string | null;
  intendedUse: string | null;
  timeline: string | null;
  goalAmount: number;
  currency: string;
  primaryLanguage: CampaignLanguage;
  state: CampaignStateValue;
  version: number;
  submittedAt: string | null;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Review-case status (mirrors `@helpkoro/domain` REVIEW_CASE_STATUSES). */
export type ReviewCaseStatusValue = 'queued' | 'in_review' | 'needs_information' | 'resolved';

/** A row in the reviewer queue. */
export interface ReviewQueueItem {
  caseId: string;
  campaignId: string;
  campaignTitle: string;
  category: CampaignCategoryInput;
  status: ReviewCaseStatusValue;
  priority: number;
  openedAt: string;
}

/** One recorded decision in a review case's history. */
export interface ReviewDecisionRecord {
  id: string;
  decision: ReviewDecisionInputValue;
  reasonCode: string;
  organizerExplanation: string | null;
  reviewerId: string;
  decidedAt: string;
}

/** The reviewer's workspace for a single case: the submitted snapshot, the
 * current campaign view, and the decision history. */
export interface ReviewCaseView {
  caseId: string;
  status: ReviewCaseStatusValue;
  priority: number;
  assignedReviewerId: string | null;
  openedAt: string;
  resolvedAt: string | null;
  campaign: CampaignOrganizerView;
  /** The immutable snapshot captured at submission time. */
  submittedSnapshot: unknown;
  decisions: ReviewDecisionRecord[];
}
