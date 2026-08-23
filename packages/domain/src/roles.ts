/**
 * The eight platform roles (identity-access-and-security.md). Enforcement
 * (RBAC guards, staff step-up) is built in the step-4 auth pass; this module
 * only fixes the vocabulary so the rest of the codebase can reference it.
 */
export const ROLES = {
  DONOR: 'donor',
  ORGANIZER: 'organizer',
  BENEFICIARY_LIAISON: 'beneficiary_liaison',
  REVIEWER: 'reviewer',
  FINANCE_APPROVER: 'finance_approver',
  SUPPORT_AGENT: 'support_agent',
  ADMINISTRATOR: 'administrator',
  SERVICE_WORKER: 'service_worker',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: readonly Role[] = Object.values(ROLES);

export function isRole(value: string): value is Role {
  return (ALL_ROLES as readonly string[]).includes(value);
}
