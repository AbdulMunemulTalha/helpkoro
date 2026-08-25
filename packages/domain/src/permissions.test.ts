import { describe, it, expect } from 'vitest';
import {
  createPolicyEvaluator,
  denyAll,
  PERMISSIONS,
  platformAuthorizer,
  ROLES,
  type PermissionRule,
} from './index';

describe('denyAll evaluator', () => {
  it('denies by default with a stable reason', () => {
    const decision = denyAll({
      roles: [ROLES.ADMINISTRATOR],
      resource: 'campaign',
      action: 'publish',
      state: 'draft',
    });
    expect(decision.effect).toBe('deny');
    expect(decision.reason).toBe('NO_POLICY');
  });
});

describe('createPolicyEvaluator', () => {
  const rules: readonly PermissionRule[] = [
    {
      resource: 'campaign',
      action: 'edit',
      grant: { kind: 'owner' },
      states: ['draft'],
      reason: 'OWNER_DRAFT',
    },
    {
      resource: 'campaign',
      action: 'review',
      grant: { kind: 'roles', roles: [ROLES.REVIEWER] },
      reason: 'REVIEWER',
    },
    {
      resource: 'payout',
      action: 'change_destination',
      grant: { kind: 'roles', roles: [ROLES.FINANCE_APPROVER] },
      requiresStepUp: true,
      reason: 'FINANCE_STEP_UP',
    },
  ];
  const evaluate = createPolicyEvaluator(rules);

  it('denies with NO_POLICY when no rule governs the action', () => {
    const d = evaluate({ roles: [ROLES.ADMINISTRATOR], resource: 'ledger', action: 'delete' });
    expect(d).toEqual({ effect: 'deny', reason: 'NO_POLICY' });
  });

  it('allows a role-based grant when the actor holds the role', () => {
    const d = evaluate({ roles: [ROLES.REVIEWER], resource: 'campaign', action: 'review' });
    expect(d.effect).toBe('allow');
    expect(d.reason).toBe('REVIEWER');
  });

  it('denies a role-based grant with ROLE_NOT_PERMITTED when the actor lacks the role', () => {
    const d = evaluate({ roles: [ROLES.DONOR], resource: 'campaign', action: 'review' });
    expect(d).toEqual({ effect: 'deny', reason: 'ROLE_NOT_PERMITTED' });
  });

  it('allows the owner and denies a non-owner with NOT_OWNER', () => {
    const allow = evaluate({
      roles: [ROLES.ORGANIZER],
      resource: 'campaign',
      action: 'edit',
      state: 'draft',
      actorId: 'u-1',
      resourceOwnerId: 'u-1',
    });
    expect(allow.effect).toBe('allow');

    const deny = evaluate({
      roles: [ROLES.ORGANIZER],
      resource: 'campaign',
      action: 'edit',
      state: 'draft',
      actorId: 'u-2',
      resourceOwnerId: 'u-1',
    });
    expect(deny).toEqual({ effect: 'deny', reason: 'NOT_OWNER' });
  });

  it('honours state constraints (rule does not apply outside its states)', () => {
    const d = evaluate({
      roles: [ROLES.ORGANIZER],
      resource: 'campaign',
      action: 'edit',
      state: 'published',
      actorId: 'u-1',
      resourceOwnerId: 'u-1',
    });
    expect(d).toEqual({ effect: 'deny', reason: 'NO_POLICY' });
  });

  it('surfaces requiresStepUp on a sensitive allow', () => {
    const d = evaluate({
      roles: [ROLES.FINANCE_APPROVER],
      resource: 'payout',
      action: 'change_destination',
    });
    expect(d.effect).toBe('allow');
    expect(d.requiresStepUp).toBe(true);
  });
});

describe('platformAuthorizer', () => {
  it('lets an administrator assign roles, requiring step-up', () => {
    const d = platformAuthorizer({
      roles: [ROLES.ADMINISTRATOR],
      resource: PERMISSIONS.USER_ROLE_ASSIGN.resource,
      action: PERMISSIONS.USER_ROLE_ASSIGN.action,
    });
    expect(d.effect).toBe('allow');
    expect(d.requiresStepUp).toBe(true);
  });

  it('forbids a non-administrator from assigning roles', () => {
    const d = platformAuthorizer({
      roles: [ROLES.SUPPORT_AGENT],
      resource: PERMISSIONS.USER_ROLE_ASSIGN.resource,
      action: PERMISSIONS.USER_ROLE_ASSIGN.action,
    });
    expect(d.effect).toBe('deny');
    expect(d.reason).toBe('ROLE_NOT_PERMITTED');
  });

  it('lets a user read their own profile', () => {
    const d = platformAuthorizer({
      roles: [ROLES.DONOR],
      resource: PERMISSIONS.USER_READ_SELF.resource,
      action: PERMISSIONS.USER_READ_SELF.action,
      actorId: 'u-1',
      resourceOwnerId: 'u-1',
    });
    expect(d.effect).toBe('allow');
    expect(d.requiresStepUp).toBeUndefined();
  });

  it('lets any signed-in actor create a campaign (no step-up)', () => {
    const d = platformAuthorizer({
      roles: [ROLES.DONOR],
      resource: PERMISSIONS.CAMPAIGN_CREATE.resource,
      action: PERMISSIONS.CAMPAIGN_CREATE.action,
      actorId: 'u-1',
    });
    expect(d).toEqual({
      effect: 'allow',
      reason: 'AUTHENTICATED_CREATE',
      requiresStepUp: undefined,
    });
  });

  it('denies campaign creation to an anonymous actor', () => {
    const d = platformAuthorizer({
      roles: [],
      resource: PERMISSIONS.CAMPAIGN_CREATE.resource,
      action: PERMISSIONS.CAMPAIGN_CREATE.action,
    });
    expect(d.effect).toBe('deny');
  });

  it('lets the organizer read their own campaign in any state', () => {
    for (const state of [
      'draft',
      'submitted',
      'under_review',
      'live',
      'paused',
      'closed',
      'rejected',
    ]) {
      const d = platformAuthorizer({
        roles: [ROLES.ORGANIZER],
        resource: PERMISSIONS.CAMPAIGN_READ.resource,
        action: PERMISSIONS.CAMPAIGN_READ.action,
        state,
        actorId: 'u-1',
        resourceOwnerId: 'u-1',
      });
      expect(d.effect).toBe('allow');
      expect(d.reason).toBe('OWNER');
    }
  });

  it('forbids a non-owner from reading a campaign', () => {
    const d = platformAuthorizer({
      roles: [ROLES.ORGANIZER],
      resource: PERMISSIONS.CAMPAIGN_READ.resource,
      action: PERMISSIONS.CAMPAIGN_READ.action,
      state: 'draft',
      actorId: 'u-2',
      resourceOwnerId: 'u-1',
    });
    expect(d).toEqual({ effect: 'deny', reason: 'NOT_OWNER' });
  });

  it('lets the organizer edit and submit only while the campaign is a draft', () => {
    for (const action of [PERMISSIONS.CAMPAIGN_UPDATE.action, PERMISSIONS.CAMPAIGN_SUBMIT.action]) {
      const allow = platformAuthorizer({
        roles: [ROLES.ORGANIZER],
        resource: 'campaign',
        action,
        state: 'draft',
        actorId: 'u-1',
        resourceOwnerId: 'u-1',
      });
      expect(allow).toEqual({ effect: 'allow', reason: 'OWNER_DRAFT', requiresStepUp: undefined });

      // Same owner, but past draft: no rule applies (fail closed).
      const deny = platformAuthorizer({
        roles: [ROLES.ORGANIZER],
        resource: 'campaign',
        action,
        state: 'live',
        actorId: 'u-1',
        resourceOwnerId: 'u-1',
      });
      expect(deny).toEqual({ effect: 'deny', reason: 'NO_POLICY' });
    }
  });
});
