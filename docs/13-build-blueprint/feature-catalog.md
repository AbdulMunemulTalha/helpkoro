# HelpKoro Feature Catalog

This is the definitive build checklist. P0 means required for a safe MVP launch; P1 follows the MVP; P2 is intentionally deferred. A feature is not complete until it meets its linked domain requirements, has authorization/failure-path tests, operational ownership, analytics where relevant, and user-facing error/status states.

## 1. Accounts and identity

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Account registration and sign-in | All users | P0 / Phase 0 | Email and/or verified phone, rate limits, secure sessions, accessible Bangla/English errors |
| Password reset and session management | All users | P0 / Phase 0 | Argon2id, expiring tokens, session revocation, audit event |
| Profile management | Donors, organizers | P0 / Phase 1 | Minimal public/private fields, consent-aware display, validation |
| Role-based access control | All roles | P0 / Phase 0 | Server-side role/resource/state enforcement and denial tests |
| Step-up authentication | Finance, admins, sensitive account actions | P0 / Phase 3 | Required for payout destination, staff-role, recovery, and finance approval changes |
| Identity evidence submission | Organizers, beneficiary liaisons | P0 / Phase 1 | Private upload/scanning, reviewer workflow, decision/reason/audit |
| Identity verification levels | Organizers, reviewers | P1 / Phase 3 | Configurable policy; provider and Bangladesh requirements remain Validate |

## 2. Public discovery and campaign pages

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Home and campaign discovery | Visitors, donors | P0 / Phase 1 | Only public/live campaigns; responsive and low-bandwidth |
| Search, filters, and sorting | Donors | P0 / Phase 1 | No private/sensitive leakage; excludes paused/rejected campaigns |
| Campaign detail page | Visitors, donors | P0 / Phase 1 | Story, goal, funds raised, organizer/beneficiary context, status, updates, fees, report route |
| Verification-label explanation | Visitors, donors | P0 / Phase 1 | Label says exactly what was checked; no guarantee language |
| Campaign updates | Organizers, donors | P0 / Phase 1 | Dated updates, moderation/report route, safe notifications |
| Campaign sharing | Organizers, donors | P1 / Phase 3 | Consent-aware previews, safe metadata, referral attribution |
| SEO-ready public pages | Visitors | P1 / Phase 3 | Index only intended public content; removal and privacy controls |
| Comments | Donors, organizers | P2 | Only after moderation capacity, rate limits, reporting, and privacy review |

## 3. Organizer and beneficiary workflows

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Organizer onboarding | Organizers | P0 / Phase 1 | Role selection, basic profile, explain review/payout requirements |
| Campaign draft wizard | Organizers | P0 / Phase 1 | Save/resume, goal, category, story, beneficiary relationship, payout plan, required declarations |
| Campaign media and evidence upload | Organizers | P0 / Phase 1 | Malware scan, type/size checks, private evidence/public-media separation |
| Submit for review | Organizers | P0 / Phase 1 | Required fields/evidence validation and status notification |
| Campaign editing | Organizers | P0 / Phase 1 | Material changes may return campaign to review; audit before/after |
| Organizer dashboard | Organizers | P0 / Phase 1 | Campaign state, donations summary from projections, review tasks, updates, payout eligibility |
| Beneficiary consent/correction route | Beneficiaries, organizers, reviewers | P0 / Phase 1 | Privacy-safe contact path; review escalation without public disclosure |
| Fund-use reporting | Organizers, reviewers, donors | P1 / Phase 3 | Configurable thresholds, private evidence, public-safe outcome narrative |
| Campaign closure/archival | Organizers, operations | P1 / Phase 3 | Preserve receipts/audit records; status and pending-funds explanation |

## 4. Donations, payments, and money

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Donation checkout | Donors | P0 / Phase 2 | Amount, fee disclosure, campaign context, consent, accessible validation |
| Provider payment adapter | System, finance | P0 / Phase 2 | Provider-independent domain interface; sandbox first |
| Payment return/status page | Donors | P0 / Phase 2 | Handles pending, failure, cancellation, and confirmed payment without relying on browser redirect |
| Signed provider webhooks | System | P0 / Phase 2 | Signature verification, event-ID dedupe, ordering-safe state machine |
| Immutable ledger | System, finance | P0 / Phase 2 | Balanced postings, integer money, no mutable authoritative balance |
| Donation receipt and history | Donors | P0 / Phase 2 | Unique receipt only after settled status; accurate gross/fee/refund state |
| Daily reconciliation | Finance | P0 / Phase 2 | Provider, ledger, payouts, refunds, fees; unresolved variance queue |
| Refund workflow | Donors, support, finance | P0 / Phase 2 | Eligibility decision, idempotent provider refund, compensating ledger entry, notification |
| Chargeback/dispute workflow | Finance, reviewers | P1 / Phase 3 | Campaign hold, evidence packet, ledger adjustments, donor/organizer status |
| Recurring donation | Donors | P1 / Phase 3 | Explicit opt-in/cancel, provider mandate capability, failed-charge policy |
| Payout request and eligibility | Organizers, finance | P0 / Phase 3 | Settled funds, review/hold check, verified destination, policy thresholds |
| Dual payout approval | Finance | P0 / Phase 3 | Maker-checker separation, step-up auth, audit evidence |
| Payout provider adapter | Finance, system | P0 / Phase 3 | Sandbox execution, idempotent submission, failure/retry/reconciliation path |
| Cross-border donation/remittance | Donors, finance | P2 | Blocked pending legal, FX, sanctions, provider, and operational validation |

## 5. Trust, safety, and review

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Campaign review queue | Reviewers | P0 / Phase 1 | Priority, ownership, queue aging, immutable decisions |
| Review case workspace | Reviewers | P0 / Phase 1 | Private evidence access, decision reason, checklist, escalation |
| Campaign lifecycle controls | Reviewers, admins | P0 / Phase 1 | Draft, submitted, under review, live, paused, closed, rejected; reason/audit |
| User reporting | Everyone | P0 / Phase 1 | Report route from public surfaces, acknowledgement, severity triage |
| Content moderation | Reviewers | P0 / Phase 1 | Prohibited-content taxonomy, human decision for high-impact enforcement |
| Risk signals and triage | Reviewers | P1 / Phase 3 | Explainable signals; never a sole automated rejection |
| Fraud prevention controls | System, reviewers | P0 / Phase 2 | Rate limits, duplicate detection, payment risk input, payout-change holds |
| Enforcement and appeals | Organizers, reviewers | P1 / Phase 3 | Warn/restrict/pause/remove/hold, reason, appeal, reversal audit |
| Vulnerable-person safeguards | Reviewers | P0 / Phase 1 | Privacy controls, escalation path, restricted content/media |
| Incident response workflow | Operations | P0 / Phase 3 | Ownership, containment, evidence preservation, communications, post-incident review |

## 6. Operations, support, and administration

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Operations console access | Reviewers, finance, support, admins | P0 / Phase 1 | Separate protected app, least privilege, audit logging |
| Support account/campaign timeline | Support | P0 / Phase 3 | Authenticated customer verification; no direct ledger override |
| Finance reconciliation dashboard | Finance | P0 / Phase 3 | Settlement, payout, refund, and variance views linked to raw records |
| Payout approval queue | Finance | P0 / Phase 3 | Segregated duties, destination masking, status and exception reasons |
| Refund/dispute console | Support, finance | P1 / Phase 3 | Policy workflow, approvals, provider/ledger outcome |
| Audit-event viewer | Authorized operations | P0 / Phase 3 | Searchable immutable history; sensitive field redaction |
| Feature-flag management | Administrators | P1 / Phase 3 | Approved roles, change audit, expiration/rollback |
| Configuration management UI | Administrators | P2 | Start with reviewed configuration-as-code; add UI only with audit and dual control |

## 7. Communications, localization, and accessibility

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Transactional notifications | All users | P0 / Phase 2 | Payment, receipt, review, refund, payout, and security messages; delivery records |
| Email/SMS adapter | System | P0 / Phase 2 | Provider abstraction, retries, templates, opt-out for non-transactional messages |
| Bangla and English | All users | P0 / Phase 1 | Localized content keys; human-reviewed safety/policy text |
| Accessibility baseline | All users | P0 / Phase 0 onward | Keyboard, contrast, semantics, screen-reader, zoom, error recovery testing |
| Low-bandwidth experience | All users | P0 / Phase 1 | Efficient media, resilient loading, simple forms, no essential hover-only actions |
| Notification preferences | Users | P1 / Phase 3 | Channel/language/frequency choices and consent-aware marketing opt-outs |

## 8. Platform, analytics, and reliability

| Feature | Users | Priority / phase | Dependencies / acceptance |
|---|---|---|---|
| Background jobs and dead-letter queue | Operations, system | P0 / Phase 0 | Idempotent processing, retries, queue monitoring, safe replay |
| Secure object storage | System | P0 / Phase 1 | Scanning, encryption, signed URLs, retention, access logs |
| Product analytics taxonomy | Product, operations | P0 / Phase 1 | Versioned events without sensitive payloads; consent/retention controls |
| Operational dashboards | Operations | P0 / Phase 3 | Review/payout aging, payment success, errors, reports, ledger variance |
| Structured logs, metrics, traces | Engineering | P0 / Phase 0 | Correlation IDs, redaction, alerts, ownership |
| Backup and restore | Engineering | P0 / Phase 4 | Encrypted backup and tested restoration against approved targets |
| Feature flags and staged rollout | Engineering, admin | P0 / Phase 2 | Owners, expiry, audit, rollback, no policy bypass |
| Partner program | Partners, operations | P2 | Requires agreements, scoped data sharing, brand controls, and validation |

## Release gates

P0 does not mean automatically safe for real-money use. Before public launch, the Phase 4 gate requires approved payment/payout providers, reconciliation, refund and incident operations, security/accessibility testing, backup-restore verification, staff training, and resolution of all applicable Bangladesh legal, tax, KYC/AML, charity, consumer, data, and cross-border Validate items.

## Cross-references

Read BUILD.md, CLAUDE.md, the build roadmap, and the corresponding product/payment/trust/compliance documents before implementing any catalog item.
