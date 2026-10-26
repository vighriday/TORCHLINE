# Deployment and operational runbook

Status: cloud deployment remains proposed. The local app and isolated PostgreSQL development cluster are running/verified as described in the README; no cloud hosting has been provisioned or purchased. Final hosting depends on account, price, region, backup and streaming checks.

## Recommended topology

One always-on Render web service serves the Fastify API and static browser build. Use managed PostgreSQL 17 in the same region where supported. Bind the app to the provider's `PORT` on `0.0.0.0`; terminate public HTTPS at the provider edge. Keep all authoritative data and work in PostgreSQL. The web service filesystem holds only immutable build assets.

Render supports long-running web services and managed TLS URLs. Its free service has idle spin-down behavior, so use an appropriate always-on plan for live demonstration and judging. This recommendation is about service properties, not a price quote. [Web service documentation](https://render.com/docs/web-services), [free-tier limitations](https://render.com/docs/free)

Railway, Fly or a managed VM can substitute if they provide the same contract: public HTTPS callback, unbuffered streaming or WebSocket fallback, durable process, secrets, database connectivity, logs, rollback and backup recovery. Do not rewrite the game for a provider-specific database or edge runtime without revisiting the component review.

## Pre-deployment gate

- Confirm approved hosting budget and region, current service limits, supported PostgreSQL baseline and backup retention.
- Build from a pinned commit/lockfile; include immutable content versions and original/licensed assets.
- Provision separate live and simulator environments/databases. Restrict simulator routes to simulation mode.
- Store configuration in server secrets. Register the exact OAuth callback and EventSub HTTPS callback.
- Run ordered SQL migrations once as a release step; fail readiness on incompatible schema. Use additive migrations before breaking changes.
- Validate public callback challenge, genuine chat, and subscription health.
- Test deployed SSE from actual OBS: prompt flush, heartbeat, session establishment, scene refresh, idle/reconnect and multiple sources/tabs. If this gate fails, use WebSocket over the same read-model interface.
- Reproduce clean setup, restore a backup, and execute the live acceptance script before release claims.

## Health and observability

`/health/live` indicates that the process is responding; `/health/ready` checks database access and migration compatibility. Expose Twitch health separately: an expired grant can affect one creator without marking every world unavailable.

Structured logs include request/command ID, world ID, channel ID, mode, version, subscription/delivery ID, job attempt and error classification. Redact authorization headers, OAuth codes/tokens, cookies, overlay capabilities, encryption keys and raw chat text. Avoid logging full URLs with fragments/query secrets or raw signed request bodies.

Monitor ingress acknowledgement latency, inbox age/failures, outbox age, accepted/rejected commands by reason, phase close lag, handoff outcome/reason, database lock waits/pool utilization, event-loop lag, active feeds, dropped slow clients and token/subscription health. Establish alerts from measured baselines; do not invent production SLO achievement.

## Recovery procedures to implement and rehearse

| Incident | Response |
| --- | --- |
| Database unavailable | Fail mutations/ingress durably with retryable response; show disconnected state; do not announce successful custody change |
| App restart or deploy | Reclaim expired leases, reconcile subscriptions, pause interrupted timed interactions, drain accepted work, publish current snapshots |
| Missing/expired raid proof | Preserve source custody, expire/cancel intent, explain retry after cooldown; no operator fabrication of native proof |
| Token revoked | End associated sessions and chat actions, remove/reconcile subscriptions, ask creator to reconnect through product flow |
| Recipient busy/opted out | Reject commit, preserve both worlds, cancel/expire safely |
| Feed stalled | Reconnect and refetch current snapshot; missed visuals do not repeat outcomes |
| Poison inbox item | Mark failed after bounded retries, expose diagnostic metadata, preserve unrelated work |
| Exposed overlay capability | Revoke grant and sessions, regenerate channel link, retain independent Twitch connection |
| Exposed OAuth credential | Revoke/rotate, update server secret/grant, validate reconnect and affected subscriptions |
| Bad release | Roll back application to a schema-compatible image; do not blindly roll back destructive data changes |

## Backups and judge availability

Use provider backups with verified restore instructions, encrypted access, and a tested export/restore path. Keep a sanitized demo seed separately from real world data. Verify retention and recovery point/recovery time from actual provider features before launch; no recovery guarantee is assumed here.

Keep the submitted candidate available across the full conservative judging window in [the submission plan](../planning/hackathon.md). Confirm expiry dates on hosting, database, OAuth grants and shared judge access. Record the submitted commit so future changes do not silently replace the judged artifact.

## Scale-out gate

Start with one application replica. Before adding replicas, implement cross-instance feed fan-out, shared session/rate-limit storage, worker lease ownership, subscription reconciliation ownership and consistent shutdown. PostgreSQL uniqueness preserves custody correctness across processes, but a single-consumer outbox does not broadcast to every replica. Load evidence should drive this work; no platform-wide capacity is claimed.
