# Feature Implementation Template

Create one implementation file from this template for every P0 and P1 catalog item before Claude Code builds it. Place it under docs/14-complete-platform-spec/features using the feature slug.

## Identity

State feature name, owner, phase, priority, linked catalog row, linked domain documents, and whether it changes money, identity, public content, or sensitive data.

## User stories

Write the primary actor story, alternate actor story, and misuse/failure stories. Include explicit non-goals. A story must have measurable success criteria.

## UI contract

List screens/routes, visible fields, field types, required/optional rules, client-side assistance only, server-side validation, loading, empty, permission-denied, error, retry, success, mobile, accessibility, Bangla, and English requirements.

## API and data contract

List endpoint/method, request/response schema, idempotency behavior, role/resource/state permission rule, error codes, database tables/columns, migration/index/constraint, domain events, job payloads, notification payloads, audit event name, and analytics event names. Use integer minor-unit money and UUIDs.

## State machine and operations

Define legal states, transition actor, preconditions, side effects, rollback/compensation, support actions, review/finance actions, alert thresholds, and dashboard metrics. Money changes require balanced ledger posting rules and reconciliation references.

## Test matrix

Provide unit, integration, contract, end-to-end, authorization, concurrency/idempotency, provider failure, accessibility, localization, security/abuse, and rollback tests. State expected evidence for release.
