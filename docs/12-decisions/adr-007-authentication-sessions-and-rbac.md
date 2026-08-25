# ADR-007: Authentication, sessions, and role-based access control

- Status: Accepted
- Date: 2026-08-24
- Deciders: HelpKoro engineering
- Supersedes: none
- Extends: ADR-006 §2 (stable error vocabulary) and §9 (hybrid auth transport)
- Related: ADR-005 (auth primitives), `docs/13-build-blueprint/identity-access-and-security.md`, `docs/03-architecture/authorization-model.md`, `docs/03-architecture/api-standards.md`

## Context

ADR-005 fixed the auth _primitives_ (Argon2id, short-lived access + rotating refresh via `jose`, self-hosted) and ADR-006 §9 fixed the _transport_ (httpOnly cookies + CSRF for first-party web/operations; `Authorization: Bearer` for API/mobile), but deferred the concrete implementation to "the Phase 0 step-4 (auth) follow-up." `identity-access-and-security.md` mandates server-side authorization by role/ownership/state, step-up for sensitive actions, login/reset throttling, session invalidation on high-risk changes, and an audit event for every sensitive action — but not the token claims, session model, permission matrix, guard order, or endpoint surface. ADR-006 also listed the per-role permission matrix as explicitly deferred.

This ADR records the auth implementation. It is deliberately scoped to accounts, sessions, and RBAC; **verification and password-reset _delivery_ (email/SMS) remain deferred** because they are provider-gated (**Validate** — no provider is approved yet).

## Decision

1. **Password hashing.** Argon2id via `@node-rs/argon2` (prebuilt binaries; no native toolchain needed in CI or local dev). Hashes live in a separate `user_credentials` table so ordinary profile reads never load them. Login against an unknown email still performs one dummy Argon2id verification against a fixed hash, so the response time does not reveal whether an account exists.

2. **Tokens (stateless access, rotating refresh).** Both are HS256 JWTs signed with `jose` v5 (chosen over v6, which is ESM-only and incompatible with the CommonJS `api` build).
   - **Access token** — claims `sub`, `sid` (session id), `roles`, and `sua` (step-up-at epoch, omitted when never stepped up). TTL `AUTH_ACCESS_TOKEN_TTL_SECONDS` (default 900s). Verified **without a database round-trip**.
   - **Refresh token** — claims `sub`, `sid`, `rnonce` (rotating nonce). TTL `AUTH_REFRESH_TOKEN_TTL_SECONDS` (default 14 days).
   - Access and refresh use **separate secrets** (`AUTH_ACCESS_TOKEN_SECRET`, `AUTH_REFRESH_TOKEN_SECRET`); the env schema rejects identical secrets and rejects the development fallbacks under `NODE_ENV=production`.

3. **Sessions and reuse detection.** A `sessions` row stores only the **SHA-256 hash** of the current refresh token plus the current `rnonce` — never the token itself. On refresh the nonce and hash rotate and the previous token is invalidated. Presenting a **superseded or mismatched** token (nonce/hash mismatch) is treated as theft: the **whole session is revoked** and an audit event is written. Access tokens are not tracked in the session table.

4. **Step-up authentication.** Which actions require step-up is data, not scattered checks: the domain permission rule carries `requiresStepUp`. When a matched rule requires it, the authorization guard re-checks the session's `step_up_at` **against the database** (authoritative — this also rejects a revoked session) versus `AUTH_STEP_UP_WINDOW_SECONDS` (default 300s). Login and `POST /v1/auth/step-up` set `step_up_at = now`. A password change re-verifies the current password, revokes the user's **other** sessions, and refreshes step-up on the current one.

5. **RBAC permission matrix.** `@helpkoro/domain` exports `PLATFORM_POLICY` (evaluated by `platformAuthorizer`), replacing the fail-closed `denyAll`. Today's rules: `user:read_self` (owner-only, backs `/v1/me`); `user_role:assign` and `user_role:revoke` (administrator + step-up). Routes declare `@RequirePermission(resource, action, { self? })` and optionally `@Roles(...)`; `/v1/me` uses `self: true` so the guard supplies `resourceOwnerId = principal.userId` and the route flows through a real policy rule (no dead rules — the matrix stays an accurate description of what the API enforces).

6. **Global guard order.** Registered as `APP_GUARD` in this order (load-bearing): **RateLimit → CSRF → Auth → Authorization**. Throttle before doing work; reject CSRF before authenticating; authenticate before authorizing.

7. **Hybrid transport (implements ADR-006 §9).** Default is `Authorization: Bearer`; tokens are always returned in the response body. A client that sends `x-auth-transport: cookie` additionally receives httpOnly `hk_at` (access) and `hk_rt` (refresh, path-scoped to `/v1/auth`) cookies plus a non-httpOnly `hk_csrf` cookie. CSRF uses **double-submit**: any unsafe method that carries the CSRF cookie must echo it in the `x-csrf-token` header (constant-time compared). Bearer-only clients never send the cookie and are unaffected; first-contact requests (login/register, before any cookie exists) are skipped.

8. **Rate limiting.** Fixed-window counters in Redis, keyed by client IP + route name, declared per-route with `@RateLimit`. Initial limits: login 10 / 15 min, register 10 / hour, refresh 30 / 15 min, step-up and change-password 10 / 15 min. The limiter **fails open** on a Redis outage (an auth throttle must not take down auth) but surfaces the error for logging. Exceeding a limit returns **`RATE_LIMITED` (429)** with a `Retry-After` header — this **extends the ADR-006 §2 stable error vocabulary** with one code.

9. **Audit events.** Every sensitive action writes an append-only `audit_events` row with actor, timestamp, source session, reason, and safe before/after summary (never secrets, tokens, OTPs, or raw PII): `user.registered`, `user.login`, `auth.login_failed` (actor type `system`), `user.logout`, `auth.refresh_reuse_detected` (actor type `system`), `auth.step_up`, `user.password_changed`, `user.role_assigned`, `user.role_revoked`. `audit_events.actor_id` now carries a foreign key to `users` (`ON DELETE SET NULL`), so user actors are referentially sound while system/service actors remain null.

10. **First administrator.** The dev/test seed grants a first administrator **only when `NODE_ENV` is not `production`**, so local and CI environments are usable without manual steps. In **production** there is no seeded admin; the first administrator is created by the audited manual procedure below.

## Production first-administrator procedure

Because no administrator exists to call the step-up-protected role API, the first grant is a controlled bootstrap, performed once:

1. An authorized operator (break-glass credentials, under change control) connects to the production database through the approved access path.
2. Insert a single `user_roles` grant of `administrator` for the pre-agreed staff account, with `granted_by = NULL` (a system/bootstrap grant).
3. Record the action in `audit_events` as a `system` actor with a reason referencing the change ticket.
4. Thereafter **all** role changes go through `POST/DELETE /v1/admin/users/:id/roles`, which require an administrator, a fresh step-up, and emit an audit event. The bootstrap path is not used again.

## Consequences

- **Stateless access tokens cannot be revoked before they expire.** This is bounded by the short (15-minute) access TTL, and mitigated because every step-up-gated or otherwise sensitive action re-checks the session in the database (so a revoked session is rejected immediately for those), and refresh is fully stateful with reuse detection. If we later need instant global revocation for _all_ requests, that is a new decision (e.g. a short-TTL denylist).
- **Cookie-mode responses still include tokens in the body.** This keeps one response shape and lets a first-party SPA bootstrap easily, at the cost that such a client _could_ read the tokens rather than relying solely on httpOnly cookies. Accepted for now; moving web/operations to cookie-only (empty token body in cookie mode) is a future tightening, not a breaking change to the Bearer contract.
- Changing token claims, the session/reuse model, the cookie names, or the guard order later is a breaking change; recording them here makes that cost explicit.
- The permission matrix is intentionally small and grows one rule at a time as owned resources (campaigns, donations, payouts) land; it must stay free of dead rules.
- Email/phone verification and password-reset delivery remain deferred and **Validate**-gated; `users.email_verified` stays `false` until that pass ships. They must not be inferred as implemented from this ADR.
