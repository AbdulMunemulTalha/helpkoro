# Campaign Lifecycle

## Purpose

This specification is the source of truth for **Campaign Lifecycle** in HelpKoro's Bangladesh-first fundraising platform. It defines the product decision, engineering boundary, and operational ownership needed before release. The lifecycle state machine is decided in [ADR-008](../12-decisions/adr-008-campaign-domain-model-lifecycle-and-review.md) and implemented in `@helpkoro/domain` (`campaigns.ts`); this document is the product-facing description of it.

## Requirements and decisions

A campaign has **seven persisted states**: `draft`, `submitted`, `under_review`, `live`, `paused`, `closed`, `rejected`. Only a **live** campaign is publicly discoverable and readable — a draft, submitted, under-review, paused, closed, or rejected campaign never surfaces on a public route, and a non-live URL returns 404.

Permitted transitions (all others are rejected as `STATE_CONFLICT`):

| From           | Event          | To             | Actor             |
| -------------- | -------------- | -------------- | ----------------- |
| `draft`        | `submit`       | `submitted`    | organizer (owner) |
| `submitted`    | `start_review` | `under_review` | reviewer / system |
| `submitted`    | `approve`      | `live`         | reviewer          |
| `submitted`    | `request_info` | `under_review` | reviewer          |
| `submitted`    | `reject`       | `rejected`     | reviewer          |
| `under_review` | `approve`      | `live`         | reviewer          |
| `under_review` | `request_info` | `under_review` | reviewer          |
| `under_review` | `reject`       | `rejected`     | reviewer          |
| `live`         | `pause`        | `paused`       | organizer / staff |
| `paused`       | `resume`       | `live`         | organizer / staff |
| `live`         | `close`        | `closed`       | organizer / staff |
| `paused`       | `close`        | `closed`       | organizer / staff |

`closed` and `rejected` are **terminal**. A rejected campaign has no edge back to `live`: relisting requires a new submission and a new review decision.

**"Needs information" is a review-case status, not a campaign state.** A `request_info` decision keeps the campaign in `under_review` and moves the review case to `needs_information`; the persisted campaign enum stays at seven states (see ADR-008 §2). Review-case statuses are `queued` → `in_review` → (`needs_information`) → `resolved`.

**Role permissions.** Creation requires any authenticated actor (and grants the `organizer` role). Editing and submitting a draft require ownership and the `draft` state (server-enforced). Review actions require the `reviewer` role. Public reads are unauthenticated.

## Workflow and acceptance criteria

Initiation: an organizer creates a draft (gated by the `campaigns.creation_enabled` flag) and submits it, which writes an **immutable submission snapshot** and opens exactly one review case. A reviewer approves (→ live, sets `published_at`), rejects (→ rejected), or requests information (case → `needs_information`). Every transition runs in a DB transaction that also writes an audit event.

Acceptance: an end-to-end test proves correct authorization (non-owner cannot edit/submit; non-reviewer cannot decide; anonymous cannot see a non-live campaign), clear user status, **idempotent** submit (a duplicate submit never opens a second case), concurrency-safe decisions (two reviewers cannot double-decide), and an observable audit trail. This is covered by `apps/api/test/e2e/campaigns.e2e-spec.ts`.

## Security, privacy, and compliance

Collect the minimum data; restrict sensitive identity, beneficiary, payment, payout, and moderation evidence; redact logs; apply approved retention; and test abuse cases. The **public view is the trust boundary** — it carries no payout, evidence, internal-review, private-contact, or raw beneficiary-identity fields (`beneficiaryType` is a coarse enum only). Audit summaries record only non-content fields (category, state transition, decision, reason code), never free-text campaign content or the organizer-facing explanation. **No money moves in this lifecycle** — donations/ledger/payouts are gated on Bangladesh legal + provider validation before production use.

## Cross-references

Read CLAUDE.md, 00-foundations/principles.md, 03-architecture/authorization-model.md, 06-trust-safety/incident-response.md, and 11-quality/acceptance-testing.md. See [ADR-008](../12-decisions/adr-008-campaign-domain-model-lifecycle-and-review.md) for the durable decision and [campaign-creation.md](campaign-creation.md) for the intake funnel. Financial work also follows 03-architecture/ledger-architecture.md and 05-payments/reconciliation.md.
