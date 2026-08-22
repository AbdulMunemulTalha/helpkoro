# Identity, Access, and Security

## Authentication and roles

Support verified email/password plus configurable phone verification. Use Argon2id, short-lived access tokens, rotating secure refresh tokens, login/reset throttling, and session invalidation on high-risk changes. Do not log OTP codes.

Roles are donor, organizer, beneficiary liaison, reviewer, finance approver, support agent, administrator, and service worker. Authorization is server-side by role, resource ownership, and state. Payout destination changes, staff-role changes, account recovery, and finance approval require step-up authentication and an audit event.

## Security baseline

Use HTTPS, secure headers, CSRF protection when cookies are used, strict CORS, input validation, parameterized queries, output encoding, rate limits, upload scanning, secrets vault, dependency scanning, and private-by-default evidence. Audit sensitive actions with actor, timestamp, source session, safe before/after summary, reason, and correlation ID.

Identity levels and evidence requirements are configuration pending the Bangladesh validation process; do not assert regulatory compliance in code or marketing.
