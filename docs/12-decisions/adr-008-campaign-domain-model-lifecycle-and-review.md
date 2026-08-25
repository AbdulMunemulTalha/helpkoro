# ADR-008: Campaign domain model, lifecycle, and review

- Status: Accepted
- Date: 2026-08-24
- Deciders: HelpKoro engineering
- Supersedes: none
- Extends: ADR-006 §2 (stable error vocabulary), ADR-007 §5 (RBAC permission matrix)
- Related: ADR-003 (risk-based review), `docs/13-build-blueprint/feature-catalog.md`, `docs/14-complete-platform-spec/gofundme-inspired-fundraiser-onboarding.md`, `docs/14-complete-platform-spec/end-to-end-platform-process.md`, `docs/01-product/campaign-lifecycle.md`, `docs/01-product/campaign-creation.md`

## Context

Phase 0 delivered the API shell, auth/RBAC (ADR-007), audit, feature flags, and migrations, but nothing user-facing. Phase 1's goal is a **deployable, tested, flag-gated campaign product** — organizers create campaigns, reviewers approve them, and the public can discover and read live campaigns — **without moving any money**. Donations, the ledger, and payouts are Phases 2–3 and are gated on Bangladesh legal + provider approval (CLAUDE.md; feature-catalog "Release gates"), which is not in hand. So "going live" now is money-off by design, not a compromise.

The authoritative sources are the onboarding funnel state machine and the end-to-end process spec (both under `docs/14-complete-platform-spec/`) and the feature catalog. Two tensions had to be resolved before writing code:

1. The onboarding funnel diagram shows a "needs more information" step, but the feature catalog fixes the persisted campaign enum at **seven** states. Modeling "needs information" as an eighth campaign state would fork the enum from the catalog.
2. A submitted or under-review campaign must be **fully invisible** to the public, and a draft must never leak by URL manipulation — but the authorization guard (ADR-007 §6) cannot load the target row, so it cannot decide owner/state access on its own.

This ADR records the campaign domain model, its lifecycle state machine, the review model, the route surface, and the authorization split. It is deliberately scoped to Increment 1 (backend spine); the web/operations UIs and the uploads/evidence pipeline are later increments.

## Decision

1. **Seven persisted campaign states.** `draft`, `submitted`, `under_review`, `live`, `paused`, `closed`, `rejected` (feature-catalog enum, unchanged). The wizard's pre-submit checkpoints (basics → verification → story/media) are **UI progress, not persisted states**. The state machine lives in `@helpkoro/domain` (`campaigns.ts`) as a pure transition table; `campaignTransition(state, event)` returns the next state or `null`, and the API maps `null` to `STATE_CONFLICT`. The permitted transitions are:
   - `draft` — `submit` → `submitted`
   - `submitted` — `start_review` → `under_review`; `approve` → `live`; `request_info` → `under_review`; `reject` → `rejected`
   - `under_review` — `approve` → `live`; `request_info` → `under_review`; `reject` → `rejected`
   - `live` — `pause` → `paused`; `close` → `closed`
   - `paused` — `resume` → `live`; `close` → `closed`
   - `closed`, `rejected` — **terminal** (no outgoing edges)
     Guards are enforced **by omission**: `rejected` has no edge to `live`, so a rejected campaign can only go live via a _new_ review decision on a _new_ case. `isPubliclyVisible(state)` is `state === 'live'` — the single predicate every public read is built on.

2. **"Needs information" is a review-case status, not a campaign state.** This reconciles the funnel against the seven-state enum without an eighth state. A `request_info` decision keeps the campaign in `under_review` (it neither publishes nor rejects) and moves the **review case** to `needs_information`. Review-case statuses are `queued` → `in_review` → (`needs_information`) → `resolved`.

3. **Phase-1 review decisions are a subset.** A reviewer may `approve`, `reject`, or `request_info`. Each maps to a lifecycle event and a resulting case status: `approve` → event `approve`, case `resolved`; `reject` → event `reject`, case `resolved`; `request_info` → event `request_info`, case `needs_information`. The fuller moderation set (pause / escalate / route-to-finance) arrives with the moderation + operations increment. **High-impact decisions are human-only by construction:** there is no auto-approve or auto-reject path; every decision is recorded against a real reviewer id.

4. **Public and organizer routes are separate paths**, so a non-live campaign can never surface via URL manipulation:
   - **Public** (`@Public`, live-only): `GET /v1/campaigns` (discovery list), `GET /v1/campaigns/:slug` (detail). A non-live slug returns **404**, indistinguishable from a missing one (no existence leak).
   - **Creation** (`POST /v1/campaigns`): authenticated; gated by the `campaigns.creation_enabled` feature flag (FORBIDDEN / `FEATURE_DISABLED` when off); creates a draft and idempotently grants the creator the `organizer` role in the same transaction.
   - **Organizer** (`/v1/organizer/campaigns`, authenticated, owner-scoped): `GET` (own list, any state), `GET /:id` (own detail), `PATCH /:id` (draft edit), `POST /:id/submit`.
   - **Reviewer** (`/v1/reviews`, `@Roles(REVIEWER)`): `GET` (queue), `GET /:caseId` (workspace), `POST /:caseId/decision`.

5. **Authorization is split by what the guard can know.** The guard (ADR-007 §6) enforces only principal-decidable grants — `authenticated`, class/route `@Roles`, and `self`. Owner-and-state rules depend on the target row, which the guard never loads, so the **service** loads the campaign and runs the same pure `platformAuthorizer` with the real `resourceOwnerId` and `state`. `PLATFORM_POLICY` gains four rules: `campaign:create` (`authenticated`), `campaign:read` (`owner`), `campaign:update` and `campaign:submit` (`owner`, `states: ['draft']`). A non-owner gets `FORBIDDEN`; an owner acting on the wrong state gets `STATE_CONFLICT` (the resource is theirs, the action is just invalid now). The **reviewer surface is gated by a class-level `@Roles(REVIEWER)`** on the controller (the guard reads role metadata at the class level), _not_ a `PLATFORM_POLICY` rule — reviewer access needs no target row, so a coarse role check is sufficient and adding a dead owner/state rule would violate ADR-007's "no dead rules" constraint.

6. **Data model (migration `0002`).** Four tables, UUIDv7 PKs, `created_at`/`updated_at`, enum CHECK constraints, discovery/queue indexes:
   - `campaigns` — organizer, content, category, beneficiary type/relationship/consent, `goal_amount` (**integer minor units** + `currency`, never a float or client-trusted total), `slug` (unique, public URL), `status`, `version`, `submitted_at?`, `published_at?`, `closed_at?`.
   - `campaign_submissions` — the **immutable** snapshot captured per submitted version (`snapshot` jsonb, `submitted_by`).
   - `review_cases` — `campaignId`, `status`, `priority`, `assigned_reviewer_id?`, `version`, `opened_at`, `resolved_at?`.
   - `review_decisions` — **immutable, append-only**: reviewer, decision, `reason_code`, `organizer_explanation`, `evidence_refs` (jsonb, opaque handles — never inline evidence), `decided_at`.
     `someone_else` beneficiary relationship/consent is stored **on the campaign row** for now; the normalized `beneficiaries`, `evidence_files`, and `campaign_updates` tables land with the uploads pipeline (Increment 3), so we don't build an evidence schema before its consumer exists.

7. **The public view is the trust boundary.** `CampaignPublicView` carries only what a visitor may see about a live campaign; it **never** exposes payout instructions, evidence, internal-review fields, private contact, or raw beneficiary identity (`beneficiaryType` is a coarse enum only). The organizer view is richer but still excludes internal review notes/evidence; the reviewer view is the internal moderation boundary (organizer view + submitted snapshot + decision history). Audit `afterSummary` payloads carry only non-content fields (category, state transition, decision, reason code) — never title/story/beneficiary free text or the organizer-facing explanation.

8. **Idempotent submit; atomic, concurrency-safe transitions.** A campaign has at most one open review case: a duplicate submit returns the existing case with no second case, no state change, and no duplicate audit event (spec: "duplicate launch requests create one submission/review case only"). Every state change runs in a DB transaction that writes the domain row(s) **and** an audit event; recording a decision appends the immutable `review_decisions` row, applies the campaign transition, and updates the case **atomically**. Both the campaign and case updates carry optimistic `WHERE status = <expected>` guards, so two reviewers cannot double-decide — the loser fails cleanly with `STATE_CONFLICT`.

9. **404 for not-found / not-live, reusing the stable vocabulary.** There is no `NOT_FOUND` stable code (ADR-006 §2). Not-found and non-live reads throw a NestJS `NotFoundException`, which the global filter maps to **HTTP 404** with body `error.code = "VALIDATION_FAILED"` — satisfying the spec's "404 if not live" while keeping the error vocabulary closed. Malformed ids are rejected as `VALIDATION_FAILED` before reaching a `uuid` column.

10. **No money code, and it stays that way this increment.** There is no donation, ledger, or payout code anywhere in the campaign/review modules. `donations.enabled` stays **off**; `campaigns.creation_enabled` is seeded **disabled** so the surface ships dark and is switched on per the rollout plan. This keeps Phase 1 provably clear of the real-money launch gate.

## Consequences

- **The persisted enum stays at seven states.** Modeling "needs information" as a review-case status keeps the campaign enum aligned with the feature catalog, at the cost that a client reading only the campaign row sees `under_review` and must consult the review case to learn a clarification was requested. Accepted: the campaign state is the _publishing_ state; the case state is the _workflow_ state.
- **Splitting public and organizer routes** trades two controllers for a clean, testable "no draft leak by URL" guarantee — enforced by path + guard rather than in-handler branching that is easy to get subtly wrong.
- **Owner/state authorization lives in the service, not the guard.** This is the deliberate consequence of a guard that never loads target rows (ADR-007 §6); the same `platformAuthorizer` is evaluated where the data is known. New owned resources must follow this pattern or the policy matrix stops describing what the API enforces.
- **The reviewer surface is role-gated, not policy-gated.** If reviewer access ever needs to depend on case ownership/assignment or state (e.g. "only the assigned reviewer may decide"), that becomes a service-enforced rule like campaigns — a new decision, recorded then.
- **Storing `someone_else` data on the campaign row is interim.** It avoids a premature evidence schema but must be migrated into the normalized `beneficiaries`/`evidence_files` tables when the uploads pipeline lands; until then, consent is a coarse status with no attached evidence.
- **Changing the state machine, the persisted enum, the route split, the public-view field set, or the case-status model later is a breaking change**; recording them here makes that cost explicit.
- **Donations remaining off is load-bearing, not incidental.** Any change that moves real money re-enters the **Validate** launch gate (Bangladesh legal + provider written approval) and must not be inferred as unblocked by this ADR.
