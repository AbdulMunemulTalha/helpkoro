import type { CampaignRow } from '@helpkoro/db';
import type {
  CampaignOrganizerView,
  CampaignPublicView,
  CampaignSummary,
} from '@helpkoro/contracts';

/**
 * Row → view mappers, shared by the campaigns and reviews services. The PUBLIC
 * view is the trust boundary: it must never carry payout, evidence,
 * internal-review, or private beneficiary-identity fields (CLAUDE.md / ADR-008).
 * Keeping these in one module means every audience's projection is defined once.
 */

export function toOrganizerView(row: CampaignRow): CampaignOrganizerView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    story: row.story,
    category: row.category,
    subcategory: row.subcategory,
    beneficiaryType: row.beneficiaryType,
    beneficiaryRelationship: row.beneficiaryRelationship,
    intendedUse: row.intendedUse,
    timeline: row.timeline,
    goalAmount: row.goalAmount,
    currency: row.currency,
    primaryLanguage: row.primaryLanguage,
    state: row.status,
    version: row.version,
    submittedAt: iso(row.submittedAt),
    publishedAt: iso(row.publishedAt),
    closedAt: iso(row.closedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicView(row: CampaignRow, organizerDisplayName: string): CampaignPublicView {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    story: row.story,
    category: row.category,
    subcategory: row.subcategory,
    beneficiaryType: row.beneficiaryType,
    goalAmount: row.goalAmount,
    currency: row.currency,
    primaryLanguage: row.primaryLanguage,
    state: 'live',
    organizerDisplayName,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSummary(row: CampaignRow): CampaignSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category: row.category,
    goalAmount: row.goalAmount,
    currency: row.currency,
    primaryLanguage: row.primaryLanguage,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
  };
}

/** The immutable submission snapshot: the reviewable content at submit time. */
export function snapshotOf(row: CampaignRow): Record<string, unknown> {
  return {
    title: row.title,
    summary: row.summary,
    story: row.story,
    category: row.category,
    subcategory: row.subcategory,
    beneficiaryType: row.beneficiaryType,
    beneficiaryRelationship: row.beneficiaryRelationship,
    beneficiaryConsentStatus: row.beneficiaryConsentStatus,
    intendedUse: row.intendedUse,
    timeline: row.timeline,
    goalAmount: row.goalAmount,
    currency: row.currency,
    primaryLanguage: row.primaryLanguage,
    version: row.version,
  };
}

export function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
