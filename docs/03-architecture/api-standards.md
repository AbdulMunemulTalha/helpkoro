# API Standards

## Purpose

This specification is the source of truth for **API Standards** in HelpKoro's Bangladesh-first fundraising platform. The concrete wire conventions below are fixed by [ADR-006](../12-decisions/adr-006-api-and-scaffolding-conventions.md) and implemented by the `api` app and `@helpkoro/contracts`.

## Versioning and surface

Expose versioned REST JSON under `/v1` for auth, me, campaigns, files, donations, payments, payouts, reports, reviews, admin, and provider webhooks. Health endpoints (`/health`, `/health/ready`) are operational and live **outside** `/v1`. Request and response schemas are defined once as Zod schemas in `@helpkoro/contracts`; OpenAPI is generated from those schemas.

## Response envelope

- Success: `{ "data": <payload>, "meta": { "requestId": "<uuid>" } }`.
- Error: `{ "error": { "code": <StableCode>, "message": "<safe message>", "details"?: <unknown> }, "meta": { "requestId": "<uuid>" } }`.

Stable error codes: `AUTH_REQUIRED`, `FORBIDDEN`, `VALIDATION_FAILED`, `STATE_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `PAYMENT_PENDING`, `REVIEW_REQUIRED`, and `INTERNAL` for unmapped 5xx. Never expose stack traces or raw provider errors.

## Field and format conventions

UUID v7 identifiers, ISO-8601 timestamps, integer minor-unit money with an explicit currency code, and cursor pagination: list endpoints accept `?limit=` and `?cursor=` and return `data.items` plus `data.pageInfo { nextCursor, hasMore }`. The cursor is opaque.

## Correlation and idempotency

Every request carries a correlation id in the `x-request-id` header (honoured if well-formed, otherwise generated) that is echoed to the client and threaded through logs, audit events, and jobs. Every money-moving write requires an `Idempotency-Key` header; replays must not duplicate financial effects. Provider webhook signatures are verified before any side effect.

## Security, privacy, and compliance

Server-side authorization by role, resource ownership, and state; least privilege; redacted logs; approved retention. Bangladesh-specific regulatory and provider assumptions require professional/legal/provider validation before production use.

## Cross-references

Read CLAUDE.md, 12-decisions/adr-005-stack-and-tooling.md, 12-decisions/adr-006-api-and-scaffolding-conventions.md, 13-build-blueprint/repository-and-api-contract.md, and 11-quality/acceptance-testing.md.
