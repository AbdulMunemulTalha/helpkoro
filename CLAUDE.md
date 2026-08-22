+# HelpKoro — Claude Code Operating Guide
+
+## Mission
+Build HelpKoro as a trusted, Bangladesh-first platform for personal, community, nonprofit, emergency, and verified-cause fundraising. The platform must protect donors, beneficiaries, organizers, and partners while making giving understandable in Bangla and English.
+
+## Source of truth and reading order
+Before changing code, read `docs/00-foundations/product-vision.md`, `docs/00-foundations/principles.md`, the relevant domain document, and any linked ADR. Conflicts resolve in this order: approved ADR, security/trust requirements, legal/provider-approved requirements, domain specification, UI copy. Do not silently replace a documented decision.
+
+## Delivery rules
+- Design for mobile-first, low-bandwidth use, Bangla and English, local phone formats, and accessible interfaces.
+- Treat money movement, identity evidence, beneficiary information, payout instructions, and moderation evidence as sensitive.
+- Use server-side authorization, immutable money ledgers, idempotency keys, audit events, rate limits, and least privilege. Never trust client amounts, roles, or payout destinations.
+- Payment, tax, charity, KYC/AML, data-protection, and cross-border rules marked **Validate** require written approval from qualified Bangladesh counsel and the selected provider before release. Do not encode assumptions as law.
+- Prefer feature flags, staged rollouts, reconciliation, alerting, and a reversal/refund path for all financial workflows.
+
+## Definition of done
+An implementation is done only when its linked acceptance criteria pass, authorisation and failure paths are tested, operational runbooks and event tracking are updated, and security/privacy review is complete for high-risk changes. Add an ADR for a durable architecture or policy decision.
+
+## Documentation maintenance
+Keep docs accurate in the same change as code. Link changed workflows, record validation status, and preserve decision history. Do not delete incident, audit, or financial records outside approved retention workflows.
