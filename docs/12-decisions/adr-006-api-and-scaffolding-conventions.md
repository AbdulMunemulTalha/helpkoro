# ADR-006: API envelope, correlation, health, and Phase 0 scaffolding conventions

- Status: Accepted
- Date: 2026-08-22
- Deciders: HelpKoro engineering
- Supersedes: none
- Related: ADR-005 (stack and tooling), `docs/13-build-blueprint/repository-and-api-contract.md`, `docs/13-build-blueprint/identity-access-and-security.md`

## Context

`repository-and-api-contract.md` mandates versioned REST under `/v1`, "structured errors" with a fixed list of stable error codes, cursor pagination, correlation IDs, integer minor-unit money, and an `Idempotency-Key` on money-moving writes — but it does not specify the concrete JSON shapes, header names, or the health-endpoint contract. ADR-005 pins the stack (NestJS-on-Fastify, Drizzle, Zod, pino + OpenTelemetry) but leaves these wire-level conventions open. The Phase 0 API shell cannot be built without fixing them, and per CLAUDE.md durable decisions must be recorded rather than silently improvised.

This ADR records the conventions chosen for the Phase 0 foundation. Items explicitly left undecided by the source docs (default currency and its minor-unit exponent, soft-delete policy, per-role permission matrix, data-retention durations) remain deferred and are **not** decided here.

## Decision

1. **Package scope.** Workspace packages are published under `@helpkoro/*` (`@helpkoro/contracts`, `@helpkoro/db`, `@helpkoro/domain`, `@helpkoro/ui`). Applications are unscoped: `api`, `web`, `operations`.

2. **Response envelope.** Every JSON response uses one of two shapes:
   - Success: `{ "data": <payload>, "meta": { "requestId": "<uuid>" } }`
   - Error: `{ "error": { "code": <StableCode>, "message": "<safe message>", "details"?: <unknown> }, "meta": { "requestId": "<uuid>" } }`

   `StableCode` is one of the seven codes fixed by the repository contract — `AUTH_REQUIRED`, `FORBIDDEN`, `VALIDATION_FAILED`, `STATE_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_PENDING`, `REVIEW_REQUIRED` — plus `INTERNAL` for otherwise-unmapped 5xx. Stack traces and raw provider errors are never serialised.

3. **Cursor pagination.** List endpoints accept `?limit=` and `?cursor=` and return `{ "data": { "items": [...], "pageInfo": { "nextCursor": <string|null>, "hasMore": <boolean> } }, "meta": {...} }`. The cursor is an opaque base64 token; clients must not parse it.

4. **Correlation ID.** The header is `x-request-id` (configurable via `REQUEST_ID_HEADER`). A well-formed inbound value is honoured; otherwise the API generates a UUID. The id is echoed in the response header and included in `meta.requestId`, every structured log line, every audit event, and every enqueued job payload.

5. **Health endpoints.** Operational and unversioned (outside `/v1`): `GET /health` (liveness — process is up) and `GET /health/ready` (readiness — checks PostgreSQL and Redis). Body is `{ "status": "ok" | "degraded", "checks": { ... } }`; readiness returns HTTP 200 when healthy and 503 when a dependency is down.

6. **Environment validation.** Configuration is validated at process start with a Zod schema (`@helpkoro/contracts`). Invalid or missing required variables fail fast with a clear message; secrets are never logged.

7. **Identifiers.** Primary keys are UUID **version 7** (time-ordered, for index locality on future high-write ledger and event tables), generated in-application. This satisfies the "UUID primary keys" requirement of `data-and-money-contract.md` without picking a version the docs left open, and is recorded here as the chosen version.

8. **Node runtime.** The workspace targets **Node 24** (matching ADR-005 and `.nvmrc`). `package.json#engines.node` and `@types/node` are aligned to 24, resolving the earlier scaffold mismatch.

9. **Authentication transport (hybrid).** First-party web apps (`web`, `operations`) authenticate with httpOnly, Secure, SameSite cookies protected against CSRF; API and future native-mobile clients use `Authorization: Bearer`. The token _primitives_ remain as ADR-005 fixed them (Argon2id, short-lived access + rotating refresh via `jose`). Only the transport contract is recorded now; the implementation lands in the Phase 0 step-4 (auth) follow-up.

10. **Money and lifecycle.** Money is stored as integer minor units with an explicit `currency` code column. The **default currency and its minor-unit exponent remain deferred** (a country-configuration seam per ADR-005; the docs never name BDT/poisha). **Soft-delete policy remains deferred**; audit and outbox tables are append-only.

## Consequences

- The API shell, contracts package, and web apps share one envelope, one error vocabulary, and one correlation mechanism, so client code and contract tests are uniform from day one.
- Changing the auth transport, envelope, or pagination shape later would be a breaking change; recording them now makes that cost explicit.
- Deferred items (currency default, soft-delete, permission matrix, retention) still require their own decisions before the features that depend on them ship; they must not be inferred from this ADR.
- TypeScript remains on the 5.x line even though 7.x is published, because NestJS 11, Drizzle, tsup, and typescript-eslint 8 do not yet support TS 7. Revisit when the toolchain does.
