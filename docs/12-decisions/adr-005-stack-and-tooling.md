# ADR-005: Stack and Tooling

- Status: Accepted
- Date: 2026-08-22
- Owner: HelpKoro founding engineer
- Review trigger: adding a second country, first non-founder engineer joining, or a measured need to split services

## Context

The blueprint (`docs/13-build-blueprint/architecture-and-stack.md`,
`repository-and-api-contract.md`) fixes a TypeScript modular-monolith direction but
leaves two forks open ("Fastify **or** NestJS"; no ORM named) and does not pin the
supporting toolchain. The team is currently **solo / very small**, and the launch is
**Bangladesh only** (Asia expansion is deferred and conditional — see
`memory/launch-strategy-bangladesh-first`). We optimise for development speed, low
operational overhead, and — because this moves money — for a framework that makes the
safe path (server-side authorization, idempotency, and audit on every sensitive
operation) the *default*, so a solo developer cannot silently skip it.

## Decision

Confirm the documented stack and pin the open choices:

| Concern | Choice | Why (given solo + money-critical + BD-first) |
|---|---|---|
| Language / runtime | TypeScript on Node 24 LTS-track | As documented; one language across web, API, packages. |
| Monorepo | pnpm workspaces + Turborepo | pnpm is documented; Turborepo adds cheap build/test caching for fast solo iteration. |
| API framework | **NestJS on the Fastify adapter** | Resolves the Fastify/NestJS fork. Fastify's speed + Nest guards/interceptors/DI that *enforce* authz, idempotency, and audit as cross-cutting defaults. Modules map 1:1 to the documented API modules. |
| DB access | **Drizzle ORM** (+ drizzle-kit migrations) | Docs pin no ORM. Typed, close-to-SQL control over the immutable ledger, constraints, and transactions; its own migration tool keeps ops overhead low. Prisma abstracts away control we want around money. |
| Validation / contracts | Zod in `packages/contracts` | Documented ("Zod-equivalent"); one schema source for API DTOs, OpenAPI generation, and client types. |
| Async / queue | BullMQ on Redis | As documented; used for the webhook outbox, media scanning, reconciliation. |
| Object storage | S3-compatible; MinIO for local dev | As documented; MinIO gives a local S3 without cloud coupling. |
| Web | Next.js (App Router) + Tailwind + i18n (Bangla/English) | Documented; SSR is an advantage on low-bandwidth mobile networks and for public-page SEO. |
| Auth primitives | Argon2id, short-lived access + rotating refresh tokens (jose), self-hosted | Matches `identity-access-and-security.md` (custom roles, step-up, phone verification, no OTP logging); avoids external-IdP lock-in and cost. |
| Logging / tracing | pino + OpenTelemetry | Documented observability baseline; pino is fast and low-overhead. |
| Testing | Vitest (unit/integration) + Playwright (E2E) | Fast, TS-native; Playwright for accessibility + Bangla/English E2E later. |
| CI | GitHub Actions | Low-ops managed CI; conventional-commit + lint/type/test gates. |

## Alternatives considered

- **Bare Fastify** — lighter and faster to stand up, but pushes authz/idempotency/audit
  discipline onto convention. Rejected: too easy for a solo dev to be inconsistent on
  security-critical cross-cutting concerns.
- **Prisma** — more ergonomic, but abstracts SQL/transaction control we want for the
  ledger. Rejected in favour of Drizzle.
- **A non-TypeScript stack** (e.g. Laravel, Django) — considered given local hiring, but
  the team is TS-fluent and a single language keeps shared contracts and velocity high.

## Consequences

- NestJS adds boilerplate; accepted as the cost of enforced structure.
- Multi-country abstractions (currency/payment/payout/phone/language adapters) are kept as
  seams but **not built out** now — Bangladesh-only per the launch strategy.
- Every money-moving write requires an `Idempotency-Key`; every sensitive action writes an
  audit event — enforced at the framework layer, not per-handler discretion.
- Deviating from this stack later requires a superseding ADR.
