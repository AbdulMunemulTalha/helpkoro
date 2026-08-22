# HelpKoro Build Blueprint

This is the execution entry point for building the complete platform with Claude Code.

## Recommended baseline

Use a TypeScript monorepo: Next.js for web applications, Fastify or NestJS for the API, PostgreSQL for data and ledger, Redis plus BullMQ for background work, S3-compatible object storage, OpenTelemetry, Docker, and managed deployment. Begin as a modular monolith; payment providers are adapters.

## Read before coding

1. CLAUDE.md
2. docs/13-build-blueprint/architecture-and-stack.md
3. docs/13-build-blueprint/repository-and-api-contract.md
4. docs/13-build-blueprint/data-and-money-contract.md
5. docs/13-build-blueprint/build-roadmap.md
6. docs/13-build-blueprint/feature-catalog.md
7. docs/14-complete-platform-spec/end-to-end-platform-process.md
8. docs/14-complete-platform-spec/claude-code-build-sequence.md
9. docs/14-complete-platform-spec/gofundme-inspired-fundraiser-onboarding.md
10. The relevant domain document.

Real-money launch is blocked by the validation items in docs/07-legal-compliance.
