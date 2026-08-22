# Architecture and Stack

## Decision

Build a TypeScript modular monolith first: Next.js for public and operations web apps; NestJS-on-Fastify API (see ADR-005); PostgreSQL; Redis/BullMQ; S3-compatible storage; OpenTelemetry; Docker Compose; managed CI/CD. Split services only for a measured isolation, scale, or ownership need.

## Modules

The API owns identity, campaigns, donations, ledger, payments, payouts, reviews, files, notifications, support, and admin modules. Modules expose internal contracts; only the gateway exposes HTTP. Provider adapters never own financial state.

## Requirements

Local development starts all dependencies with one command. Each module has migrations, tests, structured logs, health checks, and a feature flag boundary. No client accesses database or provider credentials directly. Hosting, SMS, email, storage, and payment vendors must be contractually and operationally validated before production.
