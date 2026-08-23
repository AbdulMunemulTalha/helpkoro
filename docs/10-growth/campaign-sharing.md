# Campaign Sharing

## Purpose

This specification is the source of truth for **Campaign Sharing** in HelpKoro's Bangladesh-first fundraising platform. It defines the product decision, engineering boundary, and operational ownership needed before release.

## Requirements and decisions

Use truthful, consent-led growth. Sharing, messaging, partners, and discovery must not reveal sensitive information, hide fees, or exploit vulnerability.
Define inputs, state transitions, authorised actors, data ownership, notifications, support handling, and audit events. Link implementation work to this document and update it when the decision changes.

## Workflow and acceptance criteria

Document initiation, validation, approval or automation steps, success state, failure/retry behaviour, and escalation. Acceptance: an end-to-end test proves correct authorization, clear user status, idempotent recovery where money or asynchronous work is involved, and an observable audit trail.

## Security, privacy, and compliance

Collect the minimum data; restrict sensitive identity, beneficiary, payment, payout, and moderation evidence; redact logs; apply approved retention; and test abuse cases. Bangladesh-specific regulatory and provider assumptions require professional/legal/provider validation before production use.

## Cross-references

Read CLAUDE.md, 00-foundations/principles.md, 03-architecture/authorization-model.md, 06-trust-safety/incident-response.md, and 11-quality/acceptance-testing.md. Financial work also follows 03-architecture/ledger-architecture.md and 05-payments/reconciliation.md.
