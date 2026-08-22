# End-to-End HelpKoro Platform Process

This is the definitive process specification for a Bangladesh-first platform that can expand across Asia. It describes what happens, who can do it, which system controls apply, and when the workflow must stop or escalate. Read this with the feature catalog and build roadmap.

## 1. Platform roles

Visitors may discover and read public campaigns. Donors may donate and manage their giving. Organizers create and manage campaigns. Beneficiary liaisons can provide consent or corrections. Reviewers assess campaign and safety evidence. Support agents help users but cannot alter balances. Finance approvers reconcile and approve controlled payouts. Administrators manage limited platform settings. Service workers perform only scoped asynchronous work.

No role implies unrestricted access. Every sensitive operation is server-authorized, logged, and scoped to a campaign, case, or finance workflow.

## 2. Account onboarding

1. A visitor selects sign up, chooses email and/or phone according to configured availability, accepts the current terms and privacy notice, and completes verification.
2. The system rate-limits attempts, creates a user and secure session, records policy version and consent where applicable, and sends a transactional confirmation.
3. The user selects their first intention: donate, create a campaign, or support an existing campaign. This does not permanently determine their role.
4. An organizer completes a minimal profile: legal/display name as policy requires, contact method, country/region configuration, preferred language, and beneficiary relationship for each campaign. The public profile exposes only approved display fields.
5. If a campaign type or payout threshold requires identity evidence, the organizer uploads it through the private evidence flow. The account remains usable for drafts while verification is pending, but cannot pass gated review/payout conditions.

Acceptance: users can register, sign in, recover access, manage active sessions, and change sensitive account details only with step-up verification. No identity evidence, OTP, or session token appears in logs, browser URLs, analytics, or support exports.

## 3. Campaign creation and submission

The organizer starts a draft and selects an allowed category: personal emergency, medical, education, community, disaster response, or approved nonprofit cause. The wizard saves progress and presents the requirements for that category before the user invests time.

The campaign draft captures:

- Public title, short summary, full story, primary language, and translated copy where supplied.
- Funding goal in configured currency using integer minor-unit storage.
- Beneficiary identity or organization, organizer-beneficiary relationship, consent/reason if the beneficiary is represented by another person.
- Intended use of funds, expected timeline, and public-safe updates plan.
- Payout recipient and destination through a private, tokenized/encrypted channel; it is never public campaign content.
- Required evidence files, declaration of truthfulness, media rights confirmation, and acknowledgement that review does not guarantee funding or approval.
- Location only at the precision consented to and allowed by policy; exact address is never required for public display.

On submission, the API validates field schema, prohibited terms, media state, category-specific requirements, user/account status, and duplicate/idempotency guard. It creates an immutable submission snapshot and review case; the campaign state changes from draft to submitted. An organizer may edit a draft freely, but material changes after submission create a new review version.

Acceptance: a submitted campaign cannot become public by a client-side flag or direct URL manipulation. Every reviewable version, evidence access, state change, and organizer notification has an audit event.

## 4. Review, safety, and publication

The review service queues cases by category, age, risk signals, and urgent-harm policy. Automated checks may identify missing data, duplicate images, account mismatch, risky payment signals, or prohibited content. They only prioritize work; a high-impact rejection, removal, or payout hold requires a trained human decision under approved policy.

A reviewer sees the submitted snapshot, private evidence, public preview, relevant history, risk context, and a structured policy checklist. The reviewer may request clarification, approve, reject, pause, escalate, or route to specialist/finance review. A decision contains reason codes, reviewer identity, timestamp, evidence references, and an organizer-facing explanation safe to disclose.

Approved campaigns become live only when publication requirements pass. The public page shows purpose, organizer/beneficiary context, progress, updates, donation action, fee disclosure, verification-label meaning, and report route. It does not display private documents, payout data, exact sensitive location, private contact data, internal risk score, or reviewer notes.

Acceptance: only live campaigns appear in search. Paused/rejected campaigns have a stable public status behavior and no new donation checkout. Every enforcement action provides an appeal route when safe and appropriate.

## 5. Discovery, trust, and donor decision

Visitors browse a mobile-first home, category collections, search, and filters. Ranking favors relevance, verified-status clarity, quality, and user intent; it must not exploit tragedy, rank by private data, or imply that unverified campaigns are fraudulent. Search indexes only public approved fields.

Before paying, the donor sees campaign title, beneficiary/organizer context, amount, currency, platform fee and processing fee treatment, total charged, recurring choice if enabled, refund/help route, and confirmation of the selected campaign. The donor can report a campaign without giving. Donation UX supports Bangla and English, keyboard navigation, screen readers, slow networks, and provider-return uncertainty.

Acceptance: the amount charged and fee presentation match the server-calculated checkout session. A donor never supplies a payout destination or receives an implication of tax deductibility unless separately approved and factually valid.

## 6. Donation and payment processing

1. The donor chooses amount and optional recurring setting, then submits a checkout request with an idempotency key.
2. The API validates campaign state, donation limits/configuration, currency, amount, and user/session risk controls. It creates a donation intent and payment attempt in pending state, with no campaign available-balance increase.
3. The API invokes the selected provider adapter or creates a provider-hosted checkout/session. Provider credentials and payment credentials never pass through client application logs.
4. Return URLs only show a pending/success/failure user state. They are not the source of truth.
5. A provider callback arrives at a signed webhook endpoint. The system verifies signature, deduplicates provider event ID, persists raw-safe event metadata, validates allowed state transition, and writes an outbox event.
6. On confirmed settlement, the ledger module writes balanced immutable postings and the read projection makes funds available only under the campaign payout rules. The donor receives a receipt and the organizer dashboard receives an updated projected total.
7. On failure, cancellation, or ambiguity, the donation remains non-settled, the donor sees a clear status/support route, and reconciliation resolves provider discrepancies. The system never retry-charges solely because a browser redirect failed.

Acceptance: duplicate client requests and duplicate/out-of-order webhooks cannot create duplicate donations or ledger postings. Provider amount, currency, campaign, and metadata are verified before settlement. All money is integer minor units and balance derives from the ledger.

## 7. Campaign management after publication

Organizers can publish policy-compliant updates, add approved media, respond to reviewer requests, view donations in privacy-appropriate aggregate form, see payout eligibility and holds, and request a payout when permitted. They cannot see donor payment credentials or private risk data. Donor identity display is opt-in and scoped by privacy settings.

Material changes to story, beneficiary, fund use, goal, or payout context are versioned and may automatically pause the campaign or re-open review. The platform prompts organizers for fund-use updates based on policy thresholds, risk, time, or donor-facing commitments. Public reports use privacy-safe summaries; supporting evidence remains private.

Acceptance: an organizer cannot edit a campaign to change the beneficiary or payout rationale after donations without review. Every content revision and reporting item has version, actor, and timestamp.

## 8. Payout, reconciliation, refund, and dispute

Available balance is calculated from settled donation postings minus approved fees, refunds, chargebacks/reserves, and prior payouts. It is not merely the public raised total. A payout request checks live campaign state, verification level, required reporting, configured threshold, approved destination, active holds, and available balance.

The finance workflow uses maker-checker control. One authorized person prepares or reviews a payout request; a different authorized person with step-up authentication approves it. The provider adapter receives an idempotent submission. Submission, provider acceptance, settlement/failure, retry, and reconciliation are separately represented states. Payout destination changes use a cooling period and re-verification policy.

Refund and chargeback workflows preserve the original history. Support records a request; authorized policy/finance users decide eligibility; the provider action is idempotent; the ledger posts a compensating entry; the campaign availability and donor receipt history update. A chargeback creates a review/finance hold when required; it does not silently erase history.

Daily reconciliation compares provider settlements, payment events, ledger transactions, refund/chargeback events, payout batches, and fees by immutable reference. Every variance has an owner, status, evidence, and resolution. Manual adjustments require dual control and a compensating ledger transaction.

## 9. Reports, support, and incident handling

Any visitor can report a campaign, update, comment if enabled, or account. Reports capture category, free text, optional evidence, source context, and contact method only when necessary. Critical safety, exploitation, fraud, privacy, and payment reports have severity-based queue targets and on-call escalation.

Support agents verify the requester before disclosing account information or changing settings. They can explain status, collect evidence, and initiate approved workflows. They cannot directly alter payment state, ledger postings, payout destination, review decision, or staff role.

An incident follows detect, assign owner, contain, preserve evidence, assess impact, communicate approved facts, recover/reconcile, and conduct a post-incident review. The product has a provider-outage mode: it can defer or pause risky financial actions rather than claim an unknown payment outcome.

## 10. Regional expansion and Asian-market readiness

The core is country-configurable rather than Bangladesh hard-coded. Country configuration controls active currencies, payment/payout adapters, phone formatting, language packs, consent text, category availability, amount limits, fee display, identity level, and support escalation. A new country is disabled by default and requires provider, legal, data, tax, consumer, and operations approval before public activation.

Use adapter interfaces for cards, bank transfers, wallets, SMS, email, identity verification, tax/receipt presentation, FX, and payout networks. Do not make country-specific payment assumptions in the core campaign or ledger domain. Cross-border collection, FX conversion, remittance, sanctions screening, and tax claims remain release-gated validation work.

## 11. Definition of feature completion

A feature is complete only when: its user story and acceptance criteria are implemented; permissions and state machine are enforced server-side; database migration and audit events exist; API contract is documented and tested; UI has validation/loading/error/empty/success states; accessibility and Bangla/English copy are checked; analytics and operational monitoring exist where needed; asynchronous and provider failures are handled; support/runbook implications are documented; and the feature can be safely rolled back or disabled.

## Cross-references

Implementation details are in feature-catalog.md, data-and-money-contract.md, repository-and-api-contract.md, identity-access-and-security.md, testing-and-release.md, and the Phase 0–4 build roadmap. Policy boundaries remain in documents 00–12.
