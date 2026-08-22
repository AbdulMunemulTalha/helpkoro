# Repository and API Contract

## Repository layout

    apps/web              public donor and organizer experience
    apps/operations       reviewer, finance, support, and admin console
    apps/api              API and worker entrypoints
    packages/db           schema, migrations, generated types
    packages/domain       state machines, permissions, money rules
    packages/contracts    validation schemas, API DTOs, events
    packages/ui           accessible shared components
    infra                 Docker, IaC, deployment manifests

Use pnpm workspaces, strict TypeScript, ESLint, Prettier, and conventional commits. Domain rules cannot import web code; database access is confined to API/worker modules.

## API

Expose versioned REST JSON under /v1 for auth, me, campaigns, files, donations, payments, payouts, reports, reviews, admin, and provider webhooks. Share Zod-equivalent schemas from packages/contracts. Use UUIDs, ISO timestamps, integer minor-unit money, cursor pagination, correlation IDs, and structured errors. Require Idempotency-Key on every money-moving write.

## Acceptance criteria

OpenAPI is generated from source schemas. Contract tests cover every endpoint and webhook signatures are verified before any side effect. Stable errors include AUTH_REQUIRED, FORBIDDEN, VALIDATION_FAILED, STATE_CONFLICT, IDEMPOTENCY_CONFLICT, PAYMENT_PENDING, and REVIEW_REQUIRED; never expose stack traces or raw provider errors.
