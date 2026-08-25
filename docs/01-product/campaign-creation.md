# Campaign Creation

## Purpose

This specification is the source of truth for **Campaign Creation** in HelpKoro's Bangladesh-first fundraising platform. It defines the product decision, engineering boundary, and operational ownership needed before release. The intake contract is decided in [ADR-008](../12-decisions/adr-008-campaign-domain-model-lifecycle-and-review.md) and validated by `@helpkoro/contracts` (`campaigns.ts`); the lifecycle a created campaign then follows is in [campaign-lifecycle.md](campaign-lifecycle.md).

## Requirements and decisions

Creating a campaign produces a **draft** (state `draft`) owned by its creator, who is idempotently granted the `organizer` role in the same transaction. Creation requires an authenticated actor and is gated by the `campaigns.creation_enabled` feature flag (seeded **disabled** so the surface ships dark); when off, the API responds `FORBIDDEN` / `FEATURE_DISABLED`.

**Draft fields** (server-validated; money is integer minor units, never a client-trusted total):

- `title` (8–120 chars), `summary` (20–300), optional `story`, `intendedUse`, `timeline`.
- `category` — one of `medical`, `emergency`, `memorial`, `education`, `community`, `disaster_response`, `nonprofit`, `personal`; optional free-text `subcategory`. Investment/reward/loan/equity and prohibited causes are excluded by omission and must not be added without policy sign-off.
- `beneficiaryType` — `myself`, `someone_else`, or `organization`. **Cross-field rule:** a `someone_else` beneficiary must declare `beneficiaryRelationship`. Consent handling and evidence upload land with the uploads pipeline (a later increment); for now the relationship is captured on the draft row and consent is a coarse status.
- `goalAmount` (integer minor units, ≥ 1) + `currency`; `primaryLanguage` (`bn` or `en` — Bangla-first).

A unique, URL-safe `slug` is derived from the title plus a short id suffix; a Bangla-only title reduces to a `campaign-<id>` base so the public URL is always safe and unique. Drafts may be edited (`PATCH`) while still in `draft`; the same `someone_else` relationship rule is enforced against the **merged** row, not just the patch.

**Submit** moves `draft → submitted`, writes an immutable submission snapshot, and opens exactly one review case. Submit is **idempotent**: a duplicate submit returns the existing open case without opening a second one.

## Workflow and acceptance criteria

Initiation: authenticated organizer → (flag on) `POST /v1/campaigns` → optional `PATCH /v1/organizer/campaigns/:id` edits → `POST /v1/organizer/campaigns/:id/submit`. Success state: a `submitted` campaign with an immutable snapshot and one `queued` review case, plus a `campaign.created` and `campaign.submitted` audit event. Failure/retry: invalid input is `VALIDATION_FAILED` (e.g. missing `beneficiaryRelationship` for `someone_else`, goal < 1); acting on a non-draft is `STATE_CONFLICT`; a duplicate submit is an idempotent no-op that writes no second case and no duplicate audit.

Acceptance: an end-to-end test proves correct authorization (creation requires auth; a non-owner cannot edit or submit), the cross-field validation rule, flag-off blocking creation, and idempotent submit. Covered by `apps/api/test/e2e/campaigns.e2e-spec.ts` and `packages/contracts/src/campaigns.test.ts`.

## Security, privacy, and compliance

Collect the minimum data; restrict sensitive identity, beneficiary, payment, payout, and moderation evidence; redact logs; apply approved retention; and test abuse cases. Client amounts, roles, and (later) payout destinations are never trusted — the goal is stored as integer minor units and validated server-side. Audit events for creation/update/submission record only non-content fields (category, beneficiary type, goal, state), never title/story/beneficiary free text. **No money moves during creation.** Bangladesh-specific regulatory and provider assumptions require professional/legal/provider validation before production use.

## Cross-references

Read CLAUDE.md, 00-foundations/principles.md, 03-architecture/authorization-model.md, 06-trust-safety/incident-response.md, and 11-quality/acceptance-testing.md. See [ADR-008](../12-decisions/adr-008-campaign-domain-model-lifecycle-and-review.md) and [campaign-lifecycle.md](campaign-lifecycle.md). Financial work also follows 03-architecture/ledger-architecture.md and 05-payments/reconciliation.md.
