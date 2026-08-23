# HelpKoro

Bangladesh-first fundraising and crowdfunding platform. This repository holds the source-of-truth documentation in `docs/` and the implementation, built as a TypeScript monorepo. Implementation must follow `CLAUDE.md` and the accepted ADRs in `docs/12-decisions/`.

## Documentation map

Start with `docs/00-foundations/product-vision.md`, then read the relevant domain section. Bangladesh payment, tax, charity, identity, data-protection, and fundraising rules are deliberately labelled **Validate** until approved by qualified local counsel and the chosen providers.

## Build status

Delivery follows the phased roadmap in `docs/13-build-blueprint/build-roadmap.md`.

- **Phase 0 — Platform (foundation, in progress):** monorepo apps/packages, config/secrets contract, database migrations, CI, and the API application shell — NestJS on Fastify serving the ADR-006 contract: unversioned `/health` + `/health/ready` probes, `x-request-id` correlation, structured pino logging, optional OpenTelemetry tracing, the `{ data, meta }` success / stable-error envelope, DB-backed feature flags, and the append-only audit-event base. Business routes are served under `/v1`; integration tests exercise the app against Postgres + Redis in CI. Accounts, sessions, and RBAC are the remaining Phase 0 pass.
- Phases 1–4 (campaigns, donations/ledger, payouts/operations, launch hardening) are not started.

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
pnpm services:up          # Postgres + Redis + MinIO (requires Docker)
pnpm --filter @helpkoro/db migrate
pnpm --filter @helpkoro/db seed
pnpm dev                  # run all apps (or: pnpm --filter api dev)
```

Quality gates (run in CI): `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`. The API integration tests (`pnpm --filter api test:e2e`) additionally require a running Postgres + Redis (`pnpm services:up`).

## Status

The documentation is implementation-ready but not legal or regulatory advice. Real-money launch is blocked by the validation items in `docs/07-legal-compliance`. Update a decision record whenever a material assumption changes.
