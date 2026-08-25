import { describe, it, expect } from 'vitest';
import {
  CAMPAIGN_CATEGORIES,
  CAMPAIGN_STATES,
  REVIEW_DECISION_CASE_STATUS,
  REVIEW_DECISION_EVENT,
  campaignTransition,
  canApplyCampaignEvent,
  isBeneficiaryType,
  isCampaignCategory,
  isCampaignState,
  isPubliclyVisible,
  isReviewDecision,
  type CampaignEvent,
  type CampaignState,
} from './index';

describe('campaign vocabularies', () => {
  it('recognises exactly the eight allowed categories', () => {
    expect(CAMPAIGN_CATEGORIES).toEqual([
      'medical',
      'emergency',
      'memorial',
      'education',
      'community',
      'disaster_response',
      'nonprofit',
      'personal',
    ]);
    expect(isCampaignCategory('medical')).toBe(true);
    expect(isCampaignCategory('investment')).toBe(false);
    expect(isCampaignCategory('reward')).toBe(false);
  });

  it('recognises the three beneficiary types', () => {
    expect(isBeneficiaryType('myself')).toBe(true);
    expect(isBeneficiaryType('someone_else')).toBe(true);
    expect(isBeneficiaryType('organization')).toBe(true);
    expect(isBeneficiaryType('charity')).toBe(false);
  });

  it('persists exactly seven campaign states', () => {
    expect(CAMPAIGN_STATES).toHaveLength(7);
    expect(isCampaignState('draft')).toBe(true);
    expect(isCampaignState('needs_information')).toBe(false); // that is a review-case status
  });
});

describe('campaignTransition', () => {
  const legal: ReadonlyArray<[CampaignState, CampaignEvent, CampaignState]> = [
    ['draft', 'submit', 'submitted'],
    ['submitted', 'start_review', 'under_review'],
    ['submitted', 'approve', 'live'],
    ['submitted', 'request_info', 'under_review'],
    ['submitted', 'reject', 'rejected'],
    ['under_review', 'approve', 'live'],
    ['under_review', 'request_info', 'under_review'],
    ['under_review', 'reject', 'rejected'],
    ['live', 'pause', 'paused'],
    ['paused', 'resume', 'live'],
    ['live', 'close', 'closed'],
    ['paused', 'close', 'closed'],
  ];

  it.each(legal)('allows %s --%s--> %s', (from, event, to) => {
    expect(campaignTransition(from, event)).toBe(to);
    expect(canApplyCampaignEvent(from, event)).toBe(true);
  });

  it('blocks rejected -> live directly (a new review decision is required)', () => {
    expect(campaignTransition('rejected', 'approve')).toBeNull();
    expect(campaignTransition('rejected', 'submit')).toBeNull();
    expect(canApplyCampaignEvent('rejected', 'approve')).toBe(false);
  });

  it('treats closed and rejected as terminal', () => {
    for (const event of ['submit', 'approve', 'reject', 'pause', 'resume', 'close'] as const) {
      expect(campaignTransition('closed', event)).toBeNull();
      expect(campaignTransition('rejected', event)).toBeNull();
    }
  });

  it('does not allow a draft to skip straight to live or under_review', () => {
    expect(campaignTransition('draft', 'approve')).toBeNull();
    expect(campaignTransition('draft', 'start_review')).toBeNull();
  });

  it('does not allow pausing a campaign that is not live', () => {
    expect(campaignTransition('submitted', 'pause')).toBeNull();
    expect(campaignTransition('draft', 'pause')).toBeNull();
  });
});

describe('isPubliclyVisible', () => {
  it('is true only for live', () => {
    expect(isPubliclyVisible('live')).toBe(true);
    for (const state of [
      'draft',
      'submitted',
      'under_review',
      'paused',
      'closed',
      'rejected',
    ] as const) {
      expect(isPubliclyVisible(state)).toBe(false);
    }
  });
});

describe('review decisions', () => {
  it('recognises the Phase 1 decision subset', () => {
    expect(isReviewDecision('approve')).toBe(true);
    expect(isReviewDecision('reject')).toBe(true);
    expect(isReviewDecision('request_info')).toBe(true);
    expect(isReviewDecision('escalate')).toBe(false); // arrives with the moderation increment
  });

  it('maps each decision to its lifecycle event and resulting case status', () => {
    expect(REVIEW_DECISION_EVENT.approve).toBe('approve');
    expect(REVIEW_DECISION_EVENT.reject).toBe('reject');
    expect(REVIEW_DECISION_EVENT.request_info).toBe('request_info');

    expect(REVIEW_DECISION_CASE_STATUS.approve).toBe('resolved');
    expect(REVIEW_DECISION_CASE_STATUS.reject).toBe('resolved');
    expect(REVIEW_DECISION_CASE_STATUS.request_info).toBe('needs_information');
  });

  it('applying the approve decision-event to a submitted campaign yields live', () => {
    expect(campaignTransition('submitted', REVIEW_DECISION_EVENT.approve)).toBe('live');
  });
});
