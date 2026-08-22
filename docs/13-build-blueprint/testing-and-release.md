# Testing and Release

Unit-test permissions, validation, state machines, ledger balance, and policy logic. Integration-test PostgreSQL, Redis, queues, uploads, and provider adapters. Contract-test APIs/webhooks. End-to-end test donor, organizer, reviewer, finance, refund, and incident-critical journeys.

CI must run lint, typecheck, unit/integration tests, migration validation, API contract checks, accessibility checks, dependency/security scanning, and documentation-link checks. Releases use backward-compatible migrations, feature flags, smoke tests, monitoring, a rollback plan, and support briefing.

Before production, complete threat models for payments, payouts, identity, uploads, admin, and webhooks; resolve critical/high issues; test backup restoration; and document incident contacts. Any real-money release requires approved provider integration and all applicable Validate items signed off.
