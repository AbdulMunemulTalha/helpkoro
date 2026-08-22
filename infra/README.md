# infra

Local development infrastructure and (later) deployment manifests.

## Local services

`docker-compose.yml` starts everything the app needs for local development:

| Service  | Purpose                         | Local address           |
| -------- | ------------------------------- | ----------------------- |
| Postgres | Primary database + money ledger | `localhost:5432`        |
| Redis    | Queues (BullMQ), rate limits    | `localhost:6379`        |
| MinIO    | S3-compatible object storage    | `localhost:9000` (API)  |
| MinIO UI | Bucket console                  | `localhost:9001`        |

```bash
pnpm services:up      # start all
pnpm services:logs    # tail logs
pnpm services:down    # stop all
```

Requires **Docker Desktop**. Credentials in the compose file are development-only.
Production hosting, storage, and backups are a **Validate** item pending vendor
selection and Bangladesh data-governance review (see `docs/07-legal-compliance`).
