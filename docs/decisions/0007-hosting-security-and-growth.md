# ADR 0007: Always-on hosting, scoped access and measured growth

Status: proposed, 2026-10-26; approved 2026-10-26 (see [index](README.md)). Coverage: D13, D17.

## Context and decision

Use one always-on application service and managed PostgreSQL, with Render as the recommended initial provider subject to price/region/streaming checks. Keep secrets server-side, creator actions behind sessions/CSRF and current custody checks, and overlays behind revocable read-only capabilities. Separate live and simulation deployments/data. Keep the submitted candidate available through the conservative judging window.

Status as of 1 November 2026: not provisioned; judges use the Docker Compose practice preview; live features need the owner's development tunnel.

## Alternatives and consequences

Railway/Fly/managed VMs can meet the same service contract. Serverless request handlers can ingest events but need additional durable scheduling/fan-out infrastructure. Sleeping instances undermine live callback readiness. Shared admin overlay URLs or browser Twitch tokens would reduce setup work while exposing inappropriate authority. One replica simplifies feed delivery; database invariants are still required, and additional replicas need explicit cross-instance fan-out.

## Validation and revisit

Price and provision only after review; test TLS, actual OBS, secret redaction, revocation, restore and restart. Measure queue and event-loop health before scaling. Broader collaboration can extend explicit roles and policies without bypassing native-raid acceptance. See [deployment operations](../operations/deployment.md).
