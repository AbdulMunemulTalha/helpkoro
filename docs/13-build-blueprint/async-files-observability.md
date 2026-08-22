# Jobs, Files, Notifications, and Observability

Use queues for image scanning, delivery, provider callbacks, reconciliation import, payout submission, retries, search indexing, retention, and aggregation. Each job carries correlation ID and idempotency key, has bounded exponential retries, and appears in a dead-letter dashboard. Retrying a job must not duplicate financial effects.

Upload only through short-lived scoped URLs. Scan type and content, create public derivatives only after approval, and separate public media from private evidence storage. Use encryption, signed short-lived download URLs, access logs, retention labels, and deletion/legal-hold workflows.

Emit structured logs, metrics, traces, correlation IDs, queue age, payment success, payout aging, report volume, scan failures, and ledger variance. Alert on reconciliation failures, webhook signature errors, payout spikes, unauthorized admin attempts, dead letters, backup failures, and elevated errors. Every alert links to an owner and runbook.
