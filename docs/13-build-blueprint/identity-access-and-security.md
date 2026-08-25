# Identity, Access, and Security

## Authentication and roles

Support verified email/password plus configurable phone verification. Use Argon2id, short-lived access tokens, rotating secure refresh tokens, login/reset throttling, and session invalidation on high-risk changes. Do not log OTP codes.

Roles are donor, organizer, beneficiary liaison, reviewer, finance approver, support agent, administrator, and service worker. Authorization is server-side by role, resource ownership, and state. Payout destination changes, staff-role changes, account recovery, and finance approval require step-up authentication and an audit event.

## Security baseline

Use HTTPS, secure headers, CSRF protection when cookies are used, strict CORS, input validation, parameterized queries, output encoding, rate limits, upload scanning, secrets vault, dependency scanning, and private-by-default evidence. Audit sensitive actions with actor, timestamp, source session, safe before/after summary, reason, and correlation ID.

Identity levels and evidence requirements are configuration pending the Bangladesh validation process; do not assert regulatory compliance in code or marketing.

## Implementation status (Phase 0)

Accounts, sessions, and RBAC are implemented per [ADR-007](../12-decisions/adr-007-authentication-sessions-and-rbac.md):

- **Passwords** hashed with Argon2id in a separate `user_credentials` table; unknown-email logins still run a dummy verify to equalise timing.
- **Tokens**: stateless short-lived access JWT (claims `sub`, `sid`, `roles`, `sua`) + rotating refresh JWT, separate secrets. Refresh sessions store only a SHA-256 hash and a rotating nonce; presenting a superseded token revokes the whole session (reuse detection).
- **Step-up** is driven by the domain permission matrix (`requiresStepUp`) and checked against the session's database `step_up_at` within `AUTH_STEP_UP_WINDOW_SECONDS`. Login and `POST /v1/auth/step-up` refresh it; password change revokes the user's other sessions.
- **Authorization** is enforced by `@helpkoro/domain`'s `PLATFORM_POLICY` (role/ownership/state), replacing the fail-closed `denyAll`. Staff-role changes require administrator + step-up + audit event.
- **Rate limiting** (fixed-window, Redis) protects login, register, refresh, step-up, and change-password; exceeding a limit returns `RATE_LIMITED` (429).
- **Surface**: `/v1/auth/{register,login,refresh,logout,step-up,change-password}`, `/v1/me`, and `/v1/admin/users/:id/roles`.
- **Deferred (provider-gated, Validate)**: email/phone verification and password-reset _delivery_. `email_verified` stays `false` until that pass ships; OTP/reset codes are never logged.

## Cross-references

Read CLAUDE.md, 12-decisions/adr-005-stack-and-tooling.md, 12-decisions/adr-007-authentication-sessions-and-rbac.md, 03-architecture/authorization-model.md, and 03-architecture/api-standards.md.
