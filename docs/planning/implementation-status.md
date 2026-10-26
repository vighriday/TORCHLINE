# Implementation and verification status

Updated 2026-10-26. Architecture approval was given before implementation. This is the current evidence record; earlier proposed documents remain the wider target architecture.

## Working locally

- Strict TypeScript workspace on Node 24.22.1, Fastify 5, React 19/Vite, Zod 4 and PostgreSQL 17 with `pg`/SQL migrations.
- Complete five-chapter `ark-v2` deterministic game, all three endings, exact choice previews, pauses and untimed host-controlled interaction windows.
- Viewer clue discovery, constrained route submission, cooperative repair prerequisites, globally bounded rewards and latest-account advisory votes.
- Real resource/system consequences: restored shields reduce later damage; repairs prevent leaks; route solutions unlock precision salvage; one viewer's repair can turn an otherwise fatal oxygen trajectory into survival.
- Persistent physical integrity, current condition, scar history, event provenance and read-model severity. These values survive chapter changes, PostgreSQL reload and custody transfer.
- PostgreSQL snapshots/events, replay validation, idempotent commands, active-slot constraints, park/resume, world library and transactional custody.
- Explicitly labeled simulator with multiple creators, source preparation, isolated synthetic proof, receiver acceptance, duplicate-proof/accept handling, expiry and competing-recipient protection.
- Functional reference browser UI, versioned presentation models, scoped read-only channel overlays, SSE reconnect and desktop/mobile viewport checks. Claude Design owns the final visuals.
- Twitch code paths for separate bot/creator OAuth, one-use state, encrypted tokens, startup/hourly validation, serialized refresh, revocation handling, manual subscription reconciliation, raw-byte HMAC, durable normalized chat ingress and transfer-readiness checks.

## Executed evidence

- `pnpm build`: type-check and production browser build pass.
- `pnpm test`: **25 tests across five files pass**, covering domain, balance, replay, real PostgreSQL races/constraints, HTTP authorization, OAuth/webhook fixtures, token lifecycle and worker mode isolation.
- `pnpm test:browser`: **two journeys pass** in headless Chromium, including shared contribution → repair → sacrifice → reload → read-only overlay → simulated two-creator transfer. A 390px viewport has no horizontal overflow.
- `pnpm audit:legacy`: original tree has 32 paths, 28 colonies, four partial endings, zero wrecks.
- `pnpm audit:balance`: 2,398 terminal branches; 964 colonies, 1,304 partial survivors, 130 wrecks (86 hull, 44 oxygen). Equivalent clue ordering/routes collapsed; no allocation/timer coverage is implied.
- Seven [Claude Design fixtures](../design/README.md) are generated from actual engine commands.

Browser evidence is Chromium, **not actual OBS**. Contract OAuth/webhook tests use an isolated database and local provider fixtures, **not a genuine Twitch account or raid**. Numerical reachability does not establish enjoyable difficulty or creator adoption.

## External verification still required

The owner has not yet created the Twitch application/bot. Follow [account setup](../operations/twitch-setup.md). Then verify actual identities/scopes, local OAuth, public HTTPS challenge, genuine chat, actual OBS behavior and two consenting broadcasters performing a native raid. The live transfer route checks current grants, enabled subscriptions and stream status before preparation/acceptance; it is implemented but has not been exercised against Twitch.

No hosting has been provisioned, no production deployment or public submission exists, and no GitHub Actions run or push is claimed.

## Deliberate first-slice limits and next work

- Interaction windows are explicitly host-controlled. Automatic deadlines, full timer recovery, per-account cooldown/rate-limit policies and resource allocation remain pending.
- Chat currently supports `!scan`, `!route`, `!patch`, `!vote`. Bot output for `!status`/`!history` and announcement throttling is pending.
- Early ingress binds a window under the world lock. Close/pause refuses while accepted input is pending. Per-phase/ballot tables and finer write partitioning are needed before claiming the planned large-chat throughput.
- The worker is single-instance with bounded polling. Worker leases, cross-instance fan-out, durable retry/dead-letter diagnostics and scheduled retention cleanup require further production hardening.
- Reconciliation is manually triggered and currently inspects the first 100 Twitch subscriptions. Pagination, automatic desired-state reconciliation and unused-subscription cleanup are required before a broader creator network.
- Current event replay reconstructs the game from accepted commands under immutable rules and checks stored effects. Hosting/custody revisions have their own transaction/audit records; they do not mutate game sequence numbers.
- Load/soak targets, backup restore, deployment rollback, actual OBS frame time, final accessibility/usability playtesting, public history navigation and final Claude Design integration remain unverified or unfinished.
- The HTTP server binds loopback by default. This is a local functional slice, not a claim of production readiness.

The next priority is early real Twitch verification alongside timer/input hardening and design integration. Authentic raid custody remains the defining technical milestone; a simulator does not satisfy it.
