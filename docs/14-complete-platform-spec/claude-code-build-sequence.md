# Claude Code Build Sequence

## Start command

Ask Claude Code to read BUILD.md, CLAUDE.md, this directory, and the current phase documents before creating code. It must create the repository from repository-and-api-contract.md, not improvise a different architecture without an ADR.

## Phase 0 tasks

1. Initialise pnpm monorepo, TypeScript, lint/type/test tooling, Docker Compose, and CI.
2. Create PostgreSQL/Redis local services, migrations framework, seed fixture system, and environment validation.
3. Create shared contracts, UI package, API health checks, structured logging, tracing, error format, feature flags, and audit-event base.
4. Implement accounts, sessions, RBAC, staff step-up boundary, and test utilities.

## Phase 1 tasks

1. Build campaign data model, draft wizard, private upload pipeline, and organizer dashboard.
2. Build reviewer queue, case decisions, campaign state machine, reports, and public campaign/search pages.
3. Build Bangla/English support, accessible components, transactional notification base, and analytics taxonomy.

## Phase 2 tasks

1. Build payment adapter interface and a deterministic fake provider.
2. Build donation intent, checkout state, signed-webhook handler, outbox, immutable ledger, receipts, donor history, and reconciliation import.
3. Execute all duplicate, delayed, ambiguous, refund, and ledger-balance test cases before a real provider adapter.

## Phase 3 and 4 tasks

Build payout eligibility/dual approval/provider adapter, support and finance consoles, dispute workflows, monitoring/runbooks, then harden with security, accessibility, localization, load, restore, and operational drills. Activate real money only after the written external gates in build-readiness-audit.md are complete.
