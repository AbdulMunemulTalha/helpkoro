import { ROLES, type Role } from './roles';

/**
 * Permission-decision seam (ADR-006 / authorization-model.md). A decision is a
 * pure function of the actor's roles, the target resource + action, the
 * resource's current lifecycle state, and — for owned resources — whether the
 * actor owns it. This module is pure: no DB, no framework, no session state.
 *
 * Step-up freshness is a *session* property the pure layer cannot see, so a
 * rule only *flags* that an action needs step-up (`requiresStepUp`); the API's
 * authorization guard enforces the freshness check against the session's
 * step-up claim. Per identity-access-and-security.md, staff-role changes (and,
 * in later passes, payout-destination changes, account recovery, and finance
 * approval) require step-up + an audit event.
 */
export type PermissionEffect = 'allow' | 'deny';

export interface PermissionContext {
  readonly roles: readonly Role[];
  readonly resource: string;
  readonly action: string;
  /** Current lifecycle state of the resource, when the decision is state-dependent. */
  readonly state?: string;
  /** Authenticated actor's user id, when known (enables ownership checks). */
  readonly actorId?: string;
  /** Owner of the target resource, when the resource is owned. */
  readonly resourceOwnerId?: string;
}

export interface PermissionDecision {
  readonly effect: PermissionEffect;
  /** Stable reason code for audit/debugging. Never user-facing copy. */
  readonly reason: string;
  /** When allowed, whether the action additionally requires a fresh step-up session. */
  readonly requiresStepUp?: boolean;
}

export type PermissionEvaluator = (ctx: PermissionContext) => PermissionDecision;

/**
 * How a rule grants access, beyond the resource+action match:
 * - `roles`: the actor holds at least one of the listed roles.
 * - `owner`: the actor is the resource owner (`actorId === resourceOwnerId`).
 * - `authenticated`: any signed-in actor (an `actorId` is present).
 */
export type PrincipalGrant =
  | { readonly kind: 'roles'; readonly roles: readonly Role[] }
  | { readonly kind: 'owner' }
  | { readonly kind: 'authenticated' };

export interface PermissionRule {
  readonly resource: string;
  readonly action: string;
  readonly grant: PrincipalGrant;
  /** If set, the rule only applies when the resource state is one of these. */
  readonly states?: readonly string[];
  /** Sensitive action: a granted actor must also hold a fresh step-up session. */
  readonly requiresStepUp?: boolean;
  /** Stable reason code emitted when this rule grants access. */
  readonly reason: string;
}

/** True when the actor satisfies a rule's principal grant. */
function grantSatisfied(grant: PrincipalGrant, ctx: PermissionContext): boolean {
  switch (grant.kind) {
    case 'roles':
      return ctx.roles.some((r) => grant.roles.includes(r));
    case 'owner':
      return ctx.actorId != null && ctx.actorId === ctx.resourceOwnerId;
    case 'authenticated':
      return ctx.actorId != null;
  }
}

/**
 * Build a default-deny evaluator from an explicit rule list. Rules are matched
 * by resource + action (+ state, when the rule constrains it); the first rule
 * whose grant the actor satisfies wins. If rules exist for the resource+action
 * but none grant access, the reason distinguishes *why* (ownership vs role);
 * if no rule matches at all, the reason is `NO_POLICY` (fail closed).
 */
export function createPolicyEvaluator(rules: readonly PermissionRule[]): PermissionEvaluator {
  return (ctx) => {
    const candidates = rules.filter(
      (rule) =>
        rule.resource === ctx.resource &&
        rule.action === ctx.action &&
        (rule.states === undefined || (ctx.state !== undefined && rule.states.includes(ctx.state))),
    );

    if (candidates.length === 0) {
      return { effect: 'deny', reason: 'NO_POLICY' };
    }

    for (const rule of candidates) {
      if (grantSatisfied(rule.grant, ctx)) {
        return { effect: 'allow', reason: rule.reason, requiresStepUp: rule.requiresStepUp };
      }
    }

    // A rule governs this action, but the actor did not satisfy any grant.
    const ownerOnly = candidates.every((rule) => rule.grant.kind === 'owner');
    return { effect: 'deny', reason: ownerOnly ? 'NOT_OWNER' : 'ROLE_NOT_PERMITTED' };
  };
}

// --- Platform policy --------------------------------------------------------
// The concrete rule set enforced today. It grows one rule at a time as owned
// resources (campaigns, donations, payouts) land; keep it free of dead rules so
// it stays an accurate description of what the API actually enforces.

/** Well-known permission targets, referenced by the API's route decorators. */
export const PERMISSIONS = {
  /** Read one's own account/profile (`/v1/me`). */
  USER_READ_SELF: { resource: 'user', action: 'read_self' },
  /** Grant a platform role to a user (staff-role change → step-up + audit). */
  USER_ROLE_ASSIGN: { resource: 'user_role', action: 'assign' },
  /** Revoke a platform role from a user (staff-role change → step-up + audit). */
  USER_ROLE_REVOKE: { resource: 'user_role', action: 'revoke' },
  /** Create a campaign draft — any signed-in actor (also becomes an organizer). */
  CAMPAIGN_CREATE: { resource: 'campaign', action: 'create' },
  /** Read one's own campaign in any lifecycle state (organizer view). */
  CAMPAIGN_READ: { resource: 'campaign', action: 'read' },
  /** Edit one's own campaign while it is still a draft. */
  CAMPAIGN_UPDATE: { resource: 'campaign', action: 'update' },
  /** Submit one's own draft for review. */
  CAMPAIGN_SUBMIT: { resource: 'campaign', action: 'submit' },
} as const;

// Enforcement note (campaigns): `authenticated`/`roles` grants are decidable
// from the principal alone, so the API's AuthorizationGuard enforces them from a
// route's `@RequirePermission` / `@Roles`. `owner` (± `states`) grants depend on
// the *target row* (its `organizerId` and `status`), which the guard does not
// load — so the campaign service loads the row and calls `platformAuthorizer`
// with the real `resourceOwnerId` + `state`. Same policy matrix, evaluated where
// the data is known. Public reads are `@Public` and appear in no rule here.
export const PLATFORM_POLICY: readonly PermissionRule[] = [
  {
    resource: PERMISSIONS.USER_READ_SELF.resource,
    action: PERMISSIONS.USER_READ_SELF.action,
    grant: { kind: 'owner' },
    reason: 'SELF',
  },
  {
    resource: PERMISSIONS.USER_ROLE_ASSIGN.resource,
    action: PERMISSIONS.USER_ROLE_ASSIGN.action,
    grant: { kind: 'roles', roles: [ROLES.ADMINISTRATOR] },
    requiresStepUp: true,
    reason: 'ADMIN_ROLE_MGMT',
  },
  {
    resource: PERMISSIONS.USER_ROLE_REVOKE.resource,
    action: PERMISSIONS.USER_ROLE_REVOKE.action,
    grant: { kind: 'roles', roles: [ROLES.ADMINISTRATOR] },
    requiresStepUp: true,
    reason: 'ADMIN_ROLE_MGMT',
  },
  {
    // Guard-enforced: creating a draft needs only a signed-in actor.
    resource: PERMISSIONS.CAMPAIGN_CREATE.resource,
    action: PERMISSIONS.CAMPAIGN_CREATE.action,
    grant: { kind: 'authenticated' },
    reason: 'AUTHENTICATED_CREATE',
  },
  {
    // Service-enforced: the organizer may read their own campaign in any state.
    resource: PERMISSIONS.CAMPAIGN_READ.resource,
    action: PERMISSIONS.CAMPAIGN_READ.action,
    grant: { kind: 'owner' },
    reason: 'OWNER',
  },
  {
    // Service-enforced: edits are only allowed while the campaign is a draft.
    resource: PERMISSIONS.CAMPAIGN_UPDATE.resource,
    action: PERMISSIONS.CAMPAIGN_UPDATE.action,
    grant: { kind: 'owner' },
    states: ['draft'],
    reason: 'OWNER_DRAFT',
  },
  {
    // Service-enforced: only a draft may be submitted for review.
    resource: PERMISSIONS.CAMPAIGN_SUBMIT.resource,
    action: PERMISSIONS.CAMPAIGN_SUBMIT.action,
    grant: { kind: 'owner' },
    states: ['draft'],
    reason: 'OWNER_DRAFT',
  },
];

/** The evaluator backing the API's authorization guard. */
export const platformAuthorizer: PermissionEvaluator = createPolicyEvaluator(PLATFORM_POLICY);

/** Baseline evaluator: deny everything. Kept as the fail-closed fallback. */
export const denyAll: PermissionEvaluator = () => ({
  effect: 'deny',
  reason: 'NO_POLICY',
});
