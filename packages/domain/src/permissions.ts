import type { Role } from './roles';

/**
 * Permission-decision seam (ADR-006). A decision is a pure function of the
 * actor's roles, the target resource + action, and the resource's current
 * lifecycle state. This file defines ONLY the types plus a default-deny
 * evaluator — the concrete per-feature matrix and guard enforcement land in
 * the step-4 auth pass. Keeping the shape here lets other layers type against
 * it without waiting for enforcement.
 */
export type PermissionEffect = 'allow' | 'deny';

export interface PermissionContext {
  readonly roles: readonly Role[];
  readonly resource: string;
  readonly action: string;
  /** Current lifecycle state of the resource, when the decision is state-dependent. */
  readonly state?: string;
}

export interface PermissionDecision {
  readonly effect: PermissionEffect;
  /** Stable reason code for audit/debugging. Never user-facing copy. */
  readonly reason: string;
}

export type PermissionEvaluator = (ctx: PermissionContext) => PermissionDecision;

/** Baseline evaluator: deny everything until a real policy is supplied. */
export const denyAll: PermissionEvaluator = () => ({
  effect: 'deny',
  reason: 'NO_POLICY',
});
