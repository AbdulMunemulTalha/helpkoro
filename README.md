# HelpKoro

Bangladesh-first fundraising and crowdfunding platform. This repository holds the source-of-truth documentation in `docs/` and the implementation, built as a TypeScript monorepo. Implementation must follow `CLAUDE.md` and the accepted ADRs in `docs/12-decisions/`.

## Documentation map

Start with `docs/00-foundations/product-vision.md`, then read the relevant domain section. Bangladesh payment, tax, charity, identity, data-protection, and fundraising rules are deliberately labelled **Validate** until approved by qualified local counsel and the chosen providers.

## Build status

Delivery follows the phased roadmap in `docs/13-build-blueprint/build-roadmap.md`. For an always-current, auto-generated view of what is actually built — phase-by-phase checklists, the live API route surface, and repository signals — see the [build status tracker](docs/13-build-blueprint/build-status.md) (refresh it with `pnpm build:status`).

- **Phase 0 — Platform (foundation — complete):** monorepo apps/packages, config/secrets contract, database migrations, CI, and the API application shell — NestJS on Fastify serving the ADR-006 contract: unversioned `/health` + `/health/ready` probes, `x-request-id` correlation, structured pino logging, optional OpenTelemetry tracing, the `{ data, meta }` success / stable-error envelope, DB-backed feature flags, and the append-only audit-event base. Business routes are served under `/v1`; integration tests exercise the app against Postgres in CI. Accounts, sessions, and RBAC now ship per [ADR-007](docs/12-decisions/adr-007-authentication-sessions-and-rbac.md): Argon2id passwords, stateless access tokens plus rotating refresh tokens with reuse detection, step-up for sensitive actions, rate limits, and audit events — exposed as `/v1/auth/*`, `/v1/me`, and `/v1/admin/users/:id/roles`. Email/phone verification and password-reset delivery remain deferred (provider-gated).
- **Phase 1 — Campaigns (backend spine — in progress):** the campaign domain and review workflow now ship per [ADR-008](docs/12-decisions/adr-008-campaign-domain-model-lifecycle-and-review.md) — the seven-state lifecycle machine, campaign create/edit/submit with an immutable submission snapshot, public live-only discovery and detail, and the reviewer queue/workspace/decision surface, exposed as `/v1/campaigns`, `/v1/organizer/campaigns/*`, and `/v1/reviews/*`. All state changes are transactional and audited; submit is idempotent and decisions are concurrency-safe. Campaign creation is gated behind the seeded-disabled `campaigns.creation_enabled` flag, and **no money moves** — donations/ledger/payouts stay off by design. The public web app, organizer wizard and operations UIs, and the uploads/evidence pipeline (Increments 2–4) are not yet built.
- Phases 2–4 (donations/ledger, payouts/operations, launch hardening) are not started.

## Monorepo layout

    apps/web           public donor and organizer experience
    apps/operations    reviewer, finance, support, and admin console
    apps/api           API and worker entrypoints (NestJS on Fastify)
    packages/db        Drizzle schema, migrations, generated types
    packages/domain    state machines, permissions, money rules
    packages/contracts Zod validation schemas, API DTOs, events
    packages/ui        accessible shared components
    infra              Docker Compose and deployment manifests

## Local development

Requires Node 24 and pnpm 9. See `BUILD.md` for the required reading order before changing code.

```bash
pnpm install
cp .env.example .env
pnpm services:up          # Postgres + MinIO (requires Docker)
pnpm --filter @helpkoro/db migrate
pnpm --filter @helpkoro/db seed
pnpm dev                  # run all apps (or: pnpm --filter api dev)
```

Quality gates (run in CI): `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`. The API integration tests (`pnpm --filter api test:e2e`) additionally require a running Postgres (`pnpm services:up`).

## Status

The documentation is implementation-ready but not legal or regulatory advice. Real-money launch is blocked by the validation items in `docs/07-legal-compliance`. Update a decision record whenever a material assumption changes.
