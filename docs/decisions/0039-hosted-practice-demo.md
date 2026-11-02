# ADR 0039 — Hosted practice demo with a private loopback database

Date: 2026-11-02. Status: Accepted 2 November 2026. The image is built and played in CI on every push; the hosted copy's status is recorded in the [deployment runbook](../operations/deployment.md#public-judge-instance).

## Context

Judges could already run the practice game with `docker compose up --build`, but that needs Docker and a few minutes. A link they can open is a lower bar. The [deployment runbook](../operations/deployment.md) proposed a second simulation-mode service with its own managed database. On 2 November the owner asked for free hosting only. Hugging Face answered a Docker Space request with "requires a PRO subscription", Koyeb's pricing FAQ says it may ask for a card, the owner's Railway trial had expired and their existing Render workspace's free allowance was in use. A new Render workspace runs a free Docker web service without a card; free services sleep when idle. A separate managed database would add an account and must present a certificate chain the production rule `sslmode=verify-full` accepts.

## Decision

1. **One container, one origin.** `deploy/demo/Dockerfile` adds PostgreSQL 17 to the production image. `deploy/demo/start.sh` starts it on loopback only, creates a fresh database, generates fresh session, token and bot-setup secrets, migrates and starts the unchanged server.
2. **Production rules, simulation world.** The server runs with `NODE_ENV=production`, `WORLD_MODE=simulation` and `LIVEWIRE_ENABLED=true` behind the host's HTTPS. A loopback database is allowed without TLS by the existing runtime rule; nothing about that rule changes.
3. **Disposable by design.** Data lives under `/tmp` and disappears on every restart or redeploy. No Twitch credentials, live worlds or backups exist in the demo.
4. **Render as the first host.** `render.yaml` is a one-click Blueprint for a free Docker web service built from the demo Dockerfile with a `/health/ready` check. The start script takes the public origin from `PUBLIC_BASE_URL`, or from `RENDER_EXTERNAL_URL` on Render. PostgreSQL runs with small buffers to fit the free instance.
5. **Checked in CI.** The verify workflow builds the demo image, runs it in production mode and plays practice sign-in, Ark creation and the LIVEWIRE-enabled state against it.

## Alternatives considered

- **Managed PostgreSQL with trusted TLS (for example Neon).** Durable, but a second account and nothing a disposable demo needs.
- **Relaxing `sslmode=verify-full` for the host's database.** Rejected: it weakens a production safety rule for convenience.
- **Running the demo in development mode, as the compose preview does.** Rejected for a public host: production mode keeps secure cookies and strict origin checks.

## Consequences

- Judges get a link with no install. Every visitor shares one disposable database. A free service sleeps after idle time, so the first visit can take about a minute and every wake starts a fresh database.
- The live Twitch service is unchanged and still runs from the owner's machine through a tunnel. Permanent live hosting stays open.
- Because each container owns its database, overlapping deploys never contend for the worker lease. A hosted live service sharing one database still needs the lease to wait rather than fail when an old instance holds it.
