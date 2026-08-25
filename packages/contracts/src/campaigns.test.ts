import { describe, it, expect } from 'vitest';

import {
  campaignListQuery,
  createCampaignDraftInputSchema,
  reviewDecisionInputSchema,
  updateCampaignDraftInputSchema,
} from './index';

const validDraft = {
  title: 'Help Rahim recover from surgery',
  summary: 'Rahim needs support for post-surgery care and medication over three months.',
  category: 'medical',
  beneficiaryType: 'myself',
  goalAmount: 50_000_00,
  currency: 'BDT',
  primaryLanguage: 'bn',
} as const;

describe('createCampaignDraftInputSchema', () => {
  it('accepts a minimal valid draft', () => {
    const parsed = createCampaignDraftInputSchema.parse(validDraft);
    expect(parsed.category).toBe('medical');
    expect(parsed.goalAmount).toBe(50_000_00);
  });

  it('rejects an unknown category', () => {
    const r = createCampaignDraftInputSchema.safeParse({ ...validDraft, category: 'investment' });
    expect(r.success).toBe(false);
  });

  it('rejects a non-positive goal', () => {
    expect(createCampaignDraftInputSchema.safeParse({ ...validDraft, goalAmount: 0 }).success).toBe(
      false,
    );
    expect(
      createCampaignDraftInputSchema.safeParse({ ...validDraft, goalAmount: -100 }).success,
    ).toBe(false);
  });

  it('rejects a non-integer goal (money is minor units, never a float)', () => {
    expect(
      createCampaignDraftInputSchema.safeParse({ ...validDraft, goalAmount: 12.5 }).success,
    ).toBe(false);
  });

  it('rejects a malformed currency code', () => {
    expect(
      createCampaignDraftInputSchema.safeParse({ ...validDraft, currency: 'taka' }).success,
    ).toBe(false);
    expect(
      createCampaignDraftInputSchema.safeParse({ ...validDraft, currency: 'bdt' }).success,
    ).toBe(false);
  });

  it('requires a relationship when raising for someone else', () => {
    const missing = createCampaignDraftInputSchema.safeParse({
      ...validDraft,
      beneficiaryType: 'someone_else',
    });
    expect(missing.success).toBe(false);

    const provided = createCampaignDraftInputSchema.safeParse({
      ...validDraft,
      beneficiaryType: 'someone_else',
      beneficiaryRelationship: 'cousin',
    });
    expect(provided.success).toBe(true);
  });

  it('does not require a relationship for a myself/organization beneficiary', () => {
    expect(createCampaignDraftInputSchema.safeParse(validDraft).success).toBe(true);
    expect(
      createCampaignDraftInputSchema.safeParse({ ...validDraft, beneficiaryType: 'organization' })
        .success,
    ).toBe(true);
  });

  it('rejects a too-short title or summary', () => {
    expect(
      createCampaignDraftInputSchema.safeParse({ ...validDraft, title: 'short' }).success,
    ).toBe(false);
    expect(
      createCampaignDraftInputSchema.safeParse({ ...validDraft, summary: 'too short' }).success,
    ).toBe(false);
  });
});

describe('updateCampaignDraftInputSchema', () => {
  it('accepts an empty patch', () => {
    expect(updateCampaignDraftInputSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a single-field patch', () => {
    const r = updateCampaignDraftInputSchema.safeParse({
      title: 'A better, longer campaign title',
    });
    expect(r.success).toBe(true);
  });

  it('still enforces the someone_else relationship rule when the patch sets the type', () => {
    expect(
      updateCampaignDraftInputSchema.safeParse({ beneficiaryType: 'someone_else' }).success,
    ).toBe(false);
    expect(
      updateCampaignDraftInputSchema.safeParse({
        beneficiaryType: 'someone_else',
        beneficiaryRelationship: 'neighbour',
      }).success,
    ).toBe(true);
  });
});

describe('campaignListQuery', () => {
  it('defaults limit to 20 and leaves category optional', () => {
    const parsed = campaignListQuery.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.category).toBeUndefined();
  });

  it('coerces a string limit and rejects an over-limit value', () => {
    expect(campaignListQuery.parse({ limit: '50' }).limit).toBe(50);
    expect(campaignListQuery.safeParse({ limit: 500 }).success).toBe(false);
  });
});

describe('reviewDecisionInputSchema', () => {
  it('accepts an approve decision without an explanation', () => {
    const r = reviewDecisionInputSchema.safeParse({
      decision: 'approve',
      reasonCode: 'meets_policy',
    });
    expect(r.success).toBe(true);
  });

  it('requires an organizer explanation to reject or request info', () => {
    expect(
      reviewDecisionInputSchema.safeParse({ decision: 'reject', reasonCode: 'prohibited_category' })
        .success,
    ).toBe(false);
    expect(
      reviewDecisionInputSchema.safeParse({
        decision: 'reject',
        reasonCode: 'prohibited_category',
        organizerExplanation: 'This cause falls outside what HelpKoro can host.',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown decision (pause/escalate are not in the Phase 1 subset)', () => {
    expect(
      reviewDecisionInputSchema.safeParse({ decision: 'escalate', reasonCode: 'x' }).success,
    ).toBe(false);
  });
});
