# Environment and Secrets

## Purpose

This specification is the source of truth for **Environment and Secrets** in HelpKoro's Bangladesh-first fundraising platform. The configuration contract below is implemented in the Phase 0 foundation and governed by [ADR-006](../12-decisions/adr-006-api-and-scaffolding-conventions.md).

## Configuration contract

Every service validates its environment at process start with a Zod schema exported from `@helpkoro/contracts`. Missing or malformed required variables fail fast with a clear, non-sensitive message; the process does not boot in a partially-configured state. `.env.example` is the canonical list of variables and holds development-only defaults that match the services in `infra/docker-compose.yml`.

Phase 0 variables: `NODE_ENV`, `PORT`, `LOG_LEVEL`, `DATABASE_URL`, `REDIS_URL`, the `S3_*` object-storage group, `OTEL_SERVICE_NAME` / optional `OTEL_EXPORTER_OTLP_ENDPOINT`, `REQUEST_ID_HEADER`, and `API_URL` for the web apps. Authentication ([ADR-007](../12-decisions/adr-007-authentication-sessions-and-rbac.md)) adds `AUTH_ACCESS_TOKEN_SECRET` and `AUTH_REFRESH_TOKEN_SECRET` (each ≥ 32 chars and distinct; the development fallbacks are rejected under `NODE_ENV=production`), `AUTH_ACCESS_TOKEN_TTL_SECONDS`, `AUTH_REFRESH_TOKEN_TTL_SECONDS`, `AUTH_STEP_UP_WINDOW_SECONDS`, `AUTH_COOKIE_SECURE` (disable only for local http), and optional `AUTH_COOKIE_DOMAIN`.

## Secrets handling

No client accesses database or provider credentials directly. Secrets are provided through the environment (a managed secret store in non-local environments) and are never committed, logged, or included in error responses, URLs, analytics, or support exports. Logs redact authorization headers, cookies, tokens, and one-time codes.

## Validation status

Production hosting, SMS, email, storage, and payment vendor credentials require contractual and operational validation before production use. Retention durations for any persisted configuration or audit data follow approved retention workflows.

## Cross-references

Read CLAUDE.md, 12-decisions/adr-005-stack-and-tooling.md, 12-decisions/adr-006-api-and-scaffolding-conventions.md, 13-build-blueprint/identity-access-and-security.md, and 06-trust-safety/incident-response.md.
