import type { Role } from '@helpkoro/domain';

/**
 * The authenticated principal derived from a verified access token and attached
 * to the Fastify request by the auth guard. Contains only ids, roles, and the
 * step-up timestamp — never tokens or secrets.
 */
export interface AuthenticatedPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly roles: readonly Role[];
  /** Epoch seconds of the last step-up (login or /step-up), if any. */
  readonly stepUpAt?: number;
}

/** Verified access-token claims (jose payload subset we rely on). */
export interface AccessTokenClaims {
  sub: string;
  sid: string;
  roles: string[];
  /** Step-up-at, epoch seconds. Absent if the session has never stepped up. */
  sua?: number;
}

/** Verified refresh-token claims. */
export interface RefreshTokenClaims {
  sub: string;
  sid: string;
  /** Rotating nonce; must match the session's current nonce or reuse is assumed. */
  rnonce: string;
}

// Attach the principal to the Fastify request for `@CurrentUser()` and guards.
declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}
