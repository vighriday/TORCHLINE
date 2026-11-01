# Deployment and operational runbook

Current source requires migration **014_world_shares.sql** before startup and readiness. Migrations 011–014 are additive: durable channel-assignment epochs (stale-response protection), bounded operational retention, custody arrival attribution and public Chronicle link hashes. Historical Ark state and events are unchanged. Run the migration command before switching the application, and keep an extension-capable binary for LIVEWIRE histories.

Status: cloud deployment remains proposed. The local app and isolated PostgreSQL development cluster run as described in the [development guide](development.md); no cloud hosting has been provisioned or purchased. Final hosting depends on account, price, region, backup and streaming checks. No permanent hosting or public judge instance exists. Live Twitch tests used a temporary development tunnel on the owner's PC. Judges can run `docker compose up --build` (verified in CI).

## Recommended topology

### Candidate image and release order

`Dockerfile` pins Node/pnpm, typechecks/builds the browser in a separate stage and runs only production dependencies as a non-root user. `.dockerignore` allowlists source inputs; no credentials/private concept/local tools enter the image. Linux CI builds the image and runs smoke-container and smoke-compose on every push: `node scripts/smoke-container.mjs torchline:check` against a disposable schema, then the [`compose.yaml`](../../compose.yaml) practice preview checked by `scripts/smoke-compose.mjs`.

1. Review a green commit and build `docker build --build-arg SOURCE_REVISION=COMMIT -t torchline:COMMIT .`. Record the resulting image digest. Scan it with the chosen hosting/registry scanner before release; version tags alone do not freeze base-image bytes.
2. Provision approved PostgreSQL/HTTPS service and runtime secrets. Use `NODE_ENV=production`, `WORLD_MODE=live`, `HOST=0.0.0.0`, provider `PORT`, HTTPS `PUBLIC_BASE_URL`, exact `TWITCH_REDIRECT_URI`, `DATABASE_URL` with trusted remote TLS, independent session/token/operator/EventSub secrets and the registered Twitch credentials. Retain the existing token key when migrating saved grants. Keep the backup key in the operator secret store.
3. Create and drill an encrypted pre-release backup. Run **one** migration job from this image: `node scripts/migrate.ts` with the target `DATABASE_URL`. Do not run migrations concurrently in every replica.
4. Start **one replica** with the same configuration. No local volume holds authoritative state. Give graceful shutdown at least 15 seconds and disable proxy buffering for SSE. `/health/ready` must pass before traffic. Container smoke exercises a read-only filesystem, dropped Linux capabilities and no-new-privileges; configure equivalent host restrictions where supported.
5. Register the exact new OAuth callback in the Twitch developer console; verify callback delivery/subscriptions, actual chat/replies, private OBS source/reconnect and consented native raid using the live checklist. A healthy container cannot prove these external integrations.
6. Keep the prior compatible image digest for rollback. Additive migrations (008 onward) are retained during code rollback; do not reverse data or reset delivery deduplication. After recovery explicitly resume paused episodes and inspect uncertain outbound sends.

The image contains a migration CLI but no pg_dump/restore utilities or backup key. Run backup operations from a trusted operator checkout/tooling environment as documented in [backup and restore](backup-and-restore.md). No public restore/admin endpoint is added.

One always-on Render web service serves the Fastify API and static browser build. Use managed PostgreSQL 17 in the same region where supported. Bind the app to the provider's `PORT` on `0.0.0.0`; terminate public HTTPS at the provider edge. Keep all authoritative data and work in PostgreSQL. The web service filesystem holds only immutable build assets.

Render supports long-running web services and managed TLS URLs. Its free service has idle spin-down behavior, so use an appropriate always-on plan for live demonstration and judging. This recommendation is about service properties, not a price quote. [Web service documentation](https://render.com/docs/web-services), [free-tier limitations](https://render.com/docs/free)

Railway, Fly or a managed VM can substitute if they provide the same contract: public HTTPS callback, unbuffered streaming or WebSocket fallback, durable process, secrets, database connectivity, logs, rollback and backup recovery. Do not rewrite the game for a provider-specific database or edge runtime without revisiting the component review.

### Public judge instance

Proposed; not deployed or tested. No public judge instance exists. Judges can run the same practice locally with `docker compose up --build` ([development guide](development.md#one-command-with-docker)), which CI starts on every push.

A live-mode deployment refuses practice identities and simulated raid evidence by design, so judges cannot run the Judge Arena relay rehearsal there. A hosted judge instance would run a **second** service from the same image:

- Set `WORLD_MODE=simulation` and `LIVEWIRE_ENABLED=true`.
- Give it its **own** PostgreSQL database and independent secrets. Never share the live database or keys.
- Give it its own HTTPS origin, for example a `demo` subdomain, and set `PUBLIC_BASE_URL` to it. No Twitch credentials are needed.
- Behind the provider's load balancer, set `TRUST_PROXY_HOPS=1` (on the live service too). Otherwise every visitor shares the proxy's address and one per-client request budget, and several judges running the rehearsal at once could be throttled.

Judges would open **Command OS → Judge Arena → Autoplay to the handoff**. The live service keeps genuine Twitch worlds. Public Chronicle links from the live service can show a real world's lineage without granting any control.

## Pre-deployment gate

Runtime configuration now rejects ambiguous mode, non-HTTPS public/production origin, mismatched live redirect, reused secrets, invalid limits and remote production PostgreSQL without `sslmode=verify-full`. Install the provider's trusted certificate through its documented mechanism when the system trust store is insufficient. Do not bypass certificate verification. Local loopback HTTP remains permitted outside production so a tunnel can start. Default bind remains `127.0.0.1`; a hosted service must explicitly set `HOST=0.0.0.0`.

Authenticated live feeds default to eight per channel / 256 per process with `FEED_MAX_PER_CHANNEL` / `FEED_MAX_TOTAL` overrides. These are guardrails, not platform capacity. Close unused OBS/browser views when 429 is returned. Keep edge request/connection controls in the deployment review, especially for unsigned ingress and durable rejection growth.

- Confirm approved hosting budget and region, current service limits, supported PostgreSQL baseline and backup retention.
- Build from a pinned commit/lockfile; include immutable content versions and original/licensed assets.
- Provision separate live and simulator environments/databases. Restrict simulator routes to simulation mode.
- Store configuration in server secrets. Register the exact OAuth callback and EventSub HTTPS callback.
- Run ordered SQL migrations once as a release step; fail readiness on incompatible schema. Use additive migrations before breaking changes.
- Validate public callback challenge, genuine chat, and subscription health.
- Test deployed SSE from actual OBS: prompt flush, heartbeat, session establishment, scene refresh, idle/reconnect and multiple sources/tabs. If this gate fails, use WebSocket over the same read-model interface.
- Reproduce clean setup, restore a backup, and execute the live acceptance script before release claims.

## Health and observability

Database work is now bounded at PostgreSQL: `DB_STATEMENT_TIMEOUT_MS=10000`, `DB_LOCK_TIMEOUT_MS=2000`, `DB_IDLE_TRANSACTION_TIMEOUT_MS=15000`. Statement/idle overrides allow 1–60000 ms, lock overrides 1–10000 ms; lock must remain shorter than statement. Connection acquisition remains five seconds, pool size ten. Migration and trusted backup/restore operations have separate bounded allowances; do not disable runtime timeouts to perform maintenance. See [ADR 0029](../decisions/0029-independent-replies-and-database-budgets.md). These are guardrails, not a completed load test.

`BOT_REPLIES_ENABLED=false` pauses automatic outgoing replies independently of chat ingestion and gameplay. Restart normally to apply it. Keep the bot grant/subscriptions and channel protections intact. An already in-progress send cannot be recalled; old queued replies expire under the normal freshness check if replies are later re-enabled. The current native visibility issue is investigated separately from preflight health.

`/health/live` indicates that the process is responding; `/health/ready` checks database access and migration compatibility. Expose Twitch health separately: an expired grant can affect one creator without marking every world unavailable.

Fastify request logs carry a request ID, method, path and status. World, channel, delivery and job identifiers are not yet attached to log lines; add them before relying on logs for incident tracing. Redact authorization headers, OAuth codes/tokens, cookies, overlay capabilities, encryption keys and raw chat text. Avoid logging full URLs with fragments/query secrets or raw signed request bodies.

Monitor ingress acknowledgement latency, inbox age/failures, outbox age, accepted/rejected commands by reason, phase close lag, handoff outcome/reason, database lock waits/pool utilization, event-loop lag, active feeds, dropped slow clients and token/subscription health. Establish alerts from measured baselines; do not invent production SLO achievement.

## Recovery procedures to implement and rehearse

| Incident                   | Response                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Database unavailable       | Fail mutations/ingress durably with retryable response; show disconnected state; do not announce successful custody change            |
| App restart or deploy      | Reclaim expired leases, reconcile subscriptions, pause interrupted timed interactions, drain accepted work, publish current snapshots |
| Missing/expired raid proof | Preserve source custody, expire/cancel intent, explain retry after cooldown; no operator fabrication of native proof                  |
| Token revoked              | End associated sessions and chat actions, remove/reconcile subscriptions, ask creator to reconnect through product flow               |
| Recipient busy/opted out   | Reject commit, preserve both worlds, cancel/expire safely                                                                             |
| Feed stalled               | Reconnect and refetch current snapshot; missed visuals do not repeat outcomes                                                         |
| Poison inbox item          | Mark failed after bounded retries, expose diagnostic metadata, preserve unrelated work                                                |
| Exposed overlay capability | Revoke grant and sessions, regenerate channel link, retain independent Twitch connection                                              |
| Exposed OAuth credential   | Revoke/rotate, update server secret/grant, validate reconnect and affected subscriptions                                              |
| Bad release                | Roll back application to a schema-compatible image; do not blindly roll back destructive data changes                                 |

## Backups and judge availability

The [implemented encrypted backup/restore helper](backup-and-restore.md) now verifies native snapshot restoration, row fingerprints and world replay into an isolated database. The actual local live database scratch drills succeeded on October 28 and 29; remote backup scheduling and provider recovery remain unverified.

Use provider backups with verified restore instructions, encrypted access, and a tested export/restore path. Keep a sanitized demo seed separately from real world data. Verify retention and recovery point/recovery time from actual provider features before launch; no recovery guarantee is assumed here.

Keep the submitted candidate available across the full conservative judging window in [the submission plan](../planning/hackathon.md). Confirm expiry dates on hosting, database, OAuth grants and shared judge access. Record the submitted commit so future changes do not silently replace the judged artifact.

## Scale-out gate

Start with one application replica. Before adding replicas, implement cross-instance feed fan-out, shared session/rate-limit storage, worker lease ownership, subscription reconciliation ownership and consistent shutdown. PostgreSQL uniqueness preserves custody correctness across processes, but a single-consumer outbox does not broadcast to every replica. Load evidence should drive this work; no platform-wide capacity is claimed.
