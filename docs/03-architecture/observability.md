# Observability

## Purpose
This specification is the source of truth for **Observability** in HelpKoro's Bangladesh-first fundraising platform. The Phase 0 foundation implements the logging, tracing, correlation, and health baseline described here, per [ADR-005](../12-decisions/adr-005-stack-and-tooling.md) and [ADR-006](../12-decisions/adr-006-api-and-scaffolding-conventions.md).

## Logging
Structured JSON logs via pino. Every log line carries the request/job correlation id (`x-request-id`). Sensitive fields — authorization headers, cookies, tokens, one-time codes, and identity/payment evidence — are redacted at the logger. No secrets appear in logs, URLs, analytics, or support exports.

## Tracing and metrics
OpenTelemetry provides distributed tracing; the OTLP exporter is enabled only when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured, otherwise the service runs with a no-op exporter so local boot never fails. As money, files, and queues come online (Phase 2+) the platform emits queue age, payment success, payout aging, report volume, scan failures, and ledger variance.

## Health
`GET /health` reports process liveness. `GET /health/ready` reports readiness by checking PostgreSQL and Redis, returning 200 when healthy and 503 when a dependency is down. Each module exposes health, structured logs, and a feature-flag boundary.

## Alerting
Alert on reconciliation failures, webhook signature errors, payout spikes, unauthorized admin attempts, dead-letter growth, backup failures, and elevated error rates. Every alert links to an owner and a runbook.

## Cross-references
Read CLAUDE.md, 12-decisions/adr-005-stack-and-tooling.md, 12-decisions/adr-006-api-and-scaffolding-conventions.md, 13-build-blueprint/async-files-observability.md, and 09-operations/incident-runbook.md.
