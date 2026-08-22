# Data and Money Contract

## Tables

Use UUID primary keys for users, sessions, roles, profiles, organizations, campaigns, campaign_updates, beneficiaries, evidence_files, review_cases, review_decisions, donations, payment_attempts, payment_events, ledger_accounts, ledger_transactions, ledger_postings, payouts, payout_attempts, refunds, reports, notifications, audit_events, feature_flags, and outbox_events.

Every mutable business table includes created_at, updated_at, status, and version where concurrency matters. Financial rows include provider references, idempotency key, currency, integer minor-unit amount, immutable timestamps, and actor/correlation data. Enforce foreign keys, provider-event uniqueness, state constraints, and queue indexes.

## Ledger

Financial balances derive only from append-only, balanced postings. Accounts include platform clearing, campaign payable, fees, refund/chargeback liabilities, and payout clearing. Settlement creates donation postings; refunds, disputes, fees, and payouts create compensating postings. No campaign has an authoritative mutable balance.

## Controls and tests

Only the ledger module writes postings. Manual adjustments require maker-checker approval and audit trail. Test duplicate/out-of-order webhooks, ambiguous provider result, failed payout, refund, chargeback, retry, and daily reconciliation variance. Every transaction must balance by currency.
