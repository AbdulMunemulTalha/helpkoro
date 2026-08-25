import { z } from 'zod';

/**
 * Auth request/response contracts and the password-hashing parameters shared by
 * the API (`PasswordService`) and the database seed. Wire conventions follow
 * ADR-006; the auth architecture (Argon2id, short-lived access + rotating
 * refresh tokens, hybrid cookie/Bearer transport) is fixed by ADR-005/ADR-006
 * and detailed in ADR-007.
 *
 * This module stays framework- and native-dependency-free: it exports only Zod
 * schemas, inferred types, and plain numeric constants, so `@helpkoro/domain`,
 * `@helpkoro/db`, and the web apps can all depend on it.
 */

// --- Password hashing parameters (Argon2id, OWASP baseline) -----------------
// Consumers pass these to their Argon2id implementation together with the
// Argon2id algorithm selector. Kept here as the single source of truth so the
// API and the seed never drift apart. `memoryCost` is in KiB.
export const ARGON2ID_MEMORY_COST = 19_456; // ~19 MiB
export const ARGON2ID_TIME_COST = 2;
export const ARGON2ID_PARALLELISM = 1;

// --- Field validators -------------------------------------------------------
// Email: validated with a conservative pattern (not Zod's version-specific
// `.email()`), then normalised to a trimmed lowercase form for storage and the
// case-insensitive uniqueness index.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailSchema = z
  .string()
  .trim()
  .min(3)
  .max(254)
  .refine((v) => EMAIL_RE.test(v), { message: 'must be a valid email address' })
  .transform((v) => v.toLowerCase());

/**
 * Password policy: length-based only (NIST SP 800-63B discourages composition
 * rules). Minimum 12; capped at 128 to bound hashing cost. Never logged.
 */
export const passwordSchema = z.string().min(12).max(128);

export const displayNameSchema = z.string().trim().min(1).max(120);

export const localeSchema = z.enum(['en', 'bn']).default('en');

// --- Request contracts ------------------------------------------------------
export const registerInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  locale: localeSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Refresh/logout accept the refresh token in the body for the Bearer transport;
 * for the cookie transport it is read from the httpOnly cookie instead, so the
 * body field is optional.
 */
export const refreshInputSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof refreshInputSchema>;

/** Step-up re-authentication: prove the current password to elevate a session. */
export const stepUpInputSchema = z.object({
  password: passwordSchema,
});
export type StepUpInput = z.infer<typeof stepUpInputSchema>;

export const changePasswordInputSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;

/** Assign/revoke a platform role. `role` is shape-validated here; membership in
 * the role vocabulary is enforced by the API against `@helpkoro/domain`. */
export const roleAssignmentInputSchema = z.object({
  role: z.string().min(1),
});
export type RoleAssignmentInput = z.infer<typeof roleAssignmentInputSchema>;

// --- Response contracts -----------------------------------------------------
export type AccountStatus = 'active' | 'suspended' | 'disabled';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  status: AccountStatus;
  locale: 'en' | 'bn';
  roles: string[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}
