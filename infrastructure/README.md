# Infrastructure workspace

The local database helper is `scripts/local-db.mjs`; it creates an isolated PostgreSQL 17 cluster under ignored `.local/`, bound to loopback with generated credentials. SQL migrations live in `packages/storage/migrations`. GitHub Actions verification uses a disposable PostgreSQL 17 service.

Production hosting remains one long-running application service and managed PostgreSQL, with separate live and simulation data. No hosting resources have been created. See [deployment operations](../docs/operations/deployment.md) for readiness and recovery requirements.
