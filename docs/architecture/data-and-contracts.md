# Data model and interface contracts

Status: target design with an implemented first slice, 2026-10-26. Actual schemas are the SQL migrations; actual routes are in `apps/server`. See [implementation status](../planning/implementation-status.md) for which parts of this wider contract are complete. Status as of 1 November 2026: migrations 001–014 are implemented; the records below are marked implemented or target, and every route listed below exists in `apps/server`. Live evidence covers real broadcaster and bot consent, signed EventSub callbacks and, on 30 October 2026, three genuine viewer chat messages saved as `scan` gameplay events on a live Ark; native raid custody remains unverified.

The implemented world row uses an application `revision` for gameplay, hosting and custody writes; the engine state's `version` sequences gameplay events only. `WorldPresentation.worldVersion` is the concurrency revision; `gameVersion` is the replay sequence. Custody and hosting do not silently insert game actions or reset physical state. Gameplay replay verifies recorded accepted commands and their derived event effects under immutable rules; custody has a separate atomic audit trail.

Physical system state, scars, challenge reward event IDs and future cause links are canonical. The presentation contract supplies stable system IDs and derived severity for the renderer. See [frontend contracts](frontend-contracts.md).

## Core records

Use PostgreSQL relational columns for identity, uniqueness and constraints; JSONB for versioned engine state, authored content references and event payloads. Twitch IDs are opaque text; world/intent/action IDs are application-generated opaque identifiers. Do not use mutable login names as keys.

Implemented tables show the migration that created them. *Target* rows are planned designs with no table yet; each names the implemented storage that covers it today.

| Record | Important fields | Constraint/purpose |
| --- | --- | --- |
| `creators` (001) | id (Twitch user ID, or a `sim-*` practice ID), label, mode, receive_opt_in, connected, assignment_revision | Twitch ID is the primary key; opting in is separate from OAuth |
| `oauth_grants` (001) | id (Twitch user ID), role (creator or bot), scopes, AES-256-GCM-encrypted token record, validated_at | Server-only; serialize refresh per grant |
| `sessions` (001) | hashed session ID, channel_id (creator), expires_at | Server-authorized creator operations; deleting the row revokes the session |
| `worlds` (001) | id, mode, custodian_id, revision, versioned state JSONB (rules version, chapter, phase, resources, systems, obligations, challenge), frozen_by | One current custodian; resource range checks; monotonic revision |
| `channel_slots` (001) | channel_id, world_id | Channel primary key and world unique: one active world per channel, one active host per world |
| `phases` *(target)* | world_id, decision_id, type, window_id, opens_at, closes_at, input_seq, closing_watermark, status, paused_remaining_ms | One open interaction per world; close drains accepted inputs through a persisted watermark. Today the phase and input window live in `worlds.state`, with timing in `episode_clocks` |
| `episode_clocks` (007) | world_id, policy_version, durations, input_window, phase, deadline_at, remaining_ms, recovery_reason | Persisted deadlines and pause remainder, kept outside the engine |
| `participant_actions` *(target)* | world/decision/window, actor hash, source message ID, action type/payload, accepted_seq | Accepted normalized actions in stable order; no raw chat bodies. Today accepted actions are `world_events` with pseudonymous actor IDs |
| `ballots` *(target)* | world/decision/actor, option, latest accepted_seq | Unique ballot per participant; latest valid action wins. Today Ark votes are kept per pseudonymous actor in `worlds.state` |
| `livewire_stakes`, `livewire_ballots` (009) | one stake per world and chapter boundary: status, deadline, aggregate counts, ballot revision; one pseudonymous ballot per participant | One mission per boundary; ballots never enter canonical JSONB |
| `challenge_state` *(target)* | world/challenge, revealed_nodes, submissions, solved_by, result | Versioned puzzle state; reward awarded once. Today this is the challenge object in `worlds.state` |
| `consequences` *(target)* | id, world, origin_event_ids, due_chapter, predicate/effect key, status | Apply or avoid once; multiple provenance links allowed. Today obligations live in `worlds.state`, each with one originating event |
| `domain_events` *(target)* | world_id, sequence, type, schema_version, rules_version, actor/community, normalized payload, command ID | Planned columnar form of `world_events` |
| `world_events` (001) | world_id, sequence, event JSONB (rules version, actor/community, command, command ID, summary, resource delta, causes) | Unique `(world_id, sequence)`; the canonical replay log |
| `handoff_intents` *(target)* | world, source, destination, frozen_version, state, prepared_at, expires_at, proof_id | Planned form of `handoffs` |
| `handoffs` (001) | world, source, target, mode, status, frozen_revision, prepared_at, expires_at, proof_id | Partial unique pending handoff per world and per source; one proof per handoff |
| `raid_proofs` (001) | message ID, mode, source/target IDs, subscription ID, notification_at, received_at, consumed_by | Message ID unique; consumed proof cannot attach elsewhere |
| `custody_events` (001) | world, source, target, proof_id, mode, created_at, state_version (013) | Separate atomic custody audit trail; one custody change per proof |
| `eventsub_inbox` (001) | delivery message ID, type, minimal payload, received_at, processed_at, error, attempts, next_attempt_at | Durable ingress and delivery deduplication |
| `subscriptions` (001, 004) | Twitch subscription ID, type, channel, status, version, condition, callback, verified_at, confirmed_at | Reconciled inbound subscriptions, including the canonical raid subscription per opted-in destination |
| `outbox` (001) | id, world_id, revision, delivered_at | Atomic publish intent with retryable delivery |
| `jobs` *(target)* | job ID, kind, world/channel, revision, deadline, lease, attempt/error | Generic timer/work queue. Today deadlines live in `episode_clocks` and `livewire_stakes`, and retries in `eventsub_inbox` |
| `overlay_grants` (001) | capability hash, channel ID, created_at, expires_at | Read-only, rotates independently of Twitch credentials |
| `world_shares` (014) | token hash, world_id, created_by | Revocable read-only public Chronicle link; at most one per creator per world |
| `idempotency_results` *(target)* | actor ID, route/action key, request hash, outcome | Same key and body returns previous result; mismatched body rejected. Today `world_commands` keeps only the request hash |
| `world_commands` (001) | world_id, actor_id, command_id, request_hash | A repeated command ID with the same request is a no-op; different input is rejected |

Other implemented operational tables: `oauth_states` (001), `chat_message_dedup` (003), `integration_deliveries` (004), `bot_replies`, `bot_channel_limits`, `bot_send_limits` (005), `bot_setup_confirmations` (006), `input_limits`, `input_rejections` (008) and `retention_totals` (012).

`custodian_id` preserves authorization over parked worlds. `channel_slots` represents active hosting; parking removes the slot but does not transfer custody. A creator may keep several parked worlds and one active world. Completed/wrecked worlds remain archived and can release their slot. Directory readiness is derived from current connection, opt-in, grant/subscription health and slot state, not a second ownership source.

## Transaction invariants

1. Every live world has one current custodian, and at most one active channel slot.
2. An active slot's channel equals its world's current custodian; enforce through transactional writes and integrity checks in addition to FK/unique constraints.
3. One pending handoff per source/world. Completion consumes exactly one eligible proof and leaves no source slot behind.
4. Every state change increments version and appends its corresponding events in the same transaction.
5. A decision resolves once; chapter advancement and reward application cannot repeat.
6. Resource spends never underflow; bounded gains follow content rules. Terminal worlds reject active-play commands.
7. Participation has one current contribution per actor per interaction; accepted order is recorded explicitly.
8. Mode boundaries are checked on every command, proof, assignment and read subscription.

Use SQL constraints/partial unique indexes plus fixed-order row locks. For absent target slots, lock the persistent creator/channel row before testing occupancy so concurrent inserts serialize. Do not rely on locking a row that does not exist. The [PostgreSQL locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html) supports the mechanism; the specific lock protocol is our application design.

Use one checked-out `pg` client for all statements in a transaction. [node-postgres requires that client affinity](https://node-postgres.com/features/transactions). All SQL parameters are bound values. Migrations are ordered, checked-in SQL with a schema-version ledger; never perform automatic destructive synchronization.

## Deterministic transition and replay contract

Conceptual interface: `transition(previousState, validatedCommand, immutableRules) -> nextState + domainEvents`. Time, generated IDs and seed are explicit inputs supplied outside the engine and recorded. No engine call reads the wall clock, calls Twitch, chooses unseeded randomness, mutates external objects or invokes an LLM.

Two replay levels have different purposes:

- **State replay:** fold canonical domain events, using their schema and rules versions, to reconstruct the saved world exactly. Compare canonical serialized hashes and resources.
- **Interaction verification:** replay normalized participation actions and challenge submissions in accepted sequence; reproduce tallies, puzzle success and the resolution summary. Cross-check against the domain event that committed the outcome.

Keep rules/content immutable once a world starts. New balancing creates a new version for new worlds. Old worlds require their old content to replay; unsupported versions fail visibly rather than silently using new rules. Snapshots accelerate reads and are checked against event replay, not trusted as the only history.

## HTTP surface

| Route family | Authorization and behavior |
| --- | --- |
| `GET /auth/twitch`, `GET /auth/twitch/callback`, `POST /auth/logout` | One-time state, server token exchange, validated identity, session lifecycle |
| `POST /integrations/twitch/eventsub` | Signed raw-body verification; challenge/revocation/notification handling; no browser session requirement |
| `GET /api/state`, `GET /api/worlds/:id/view` | Creator session: current creator, world library, handoffs and integration health (a signed-out request receives only the mode and setup booleans); the current custodian's private world view |
| `POST /api/worlds` | Creator session; one world per free channel (a finished voyage is released first); a repeat while a world is active fails closed with `CHANNEL_BUSY` |
| `POST /api/worlds/:id/share` | Current custodian; publishes or rotates that creator's read-only public Chronicle link (hash stored) |
| `POST /api/chronicle` | Public; token in body; read-only presentation and paginated history for a shared world, 404 when unknown or withdrawn |
| `GET /api/worlds/:id/alternatives?event=` | Current custodian; one-step, read-only replay of every option of a saved decision or attested mission result, with a recomputation check; 409 for other events ([ADR 0038](../decisions/0038-one-step-decision-alternatives.md)) |
| `POST /api/chronicle/alternatives` | Public; token and event in body; the same alternatives for a shared world, 404 when unknown, withdrawn or in the other mode |
| `GET /api/worlds/:id/verify`, `POST /api/chronicle/verify` | Custodian session, or a public link token in the body; replays the whole saved log and compares SHA-256 digests of the replayed and saved state. Not a signed attestation: a consistent rewrite of both log and state would not be detected, and it does not prove that inputs were genuine Twitch input |
| `POST /api/worlds/:id/commands` | Session, CSRF/origin, custody, mode, expected version, idempotency key |
| `POST /api/worlds/:id/livewire`, `/hosting`, `/timing` | Current custodian session; LIVEWIRE mission actions (only cancel and resolve while `LIVEWIRE_ENABLED` is off), park/resume, and phase durations at a ready boundary |
| `POST /api/handoffs`, `/api/handoffs/:id/accept`, `/decline`, `/cancel`; `GET /api/handoffs/:id/preview` | Source/recipient identity by action; state-machine and transaction checks; frozen preview for the two parties. `/api/handoffs/:id/simulate-raid` exists only in simulation mode and is refused in live mode |
| `POST /api/receive-opt-in` | Creator-controlled readiness, separate from actual raid proof |
| `POST /api/overlay-grant` | Creator session; creates or rotates the channel's private read-only overlay link (only a hash is stored) |
| `POST /overlay/:channel/session` | Fragment capability exchange into a scoped overlay session; credential never logged |
| `GET /overlay/:channel/state`, `GET /overlay/:channel/events` | Channel-scoped read-only snapshot and SSE feed, including active assignment changes |
| `GET /api/live/events` | Authenticated dashboard SSE feed, sanitized updates |
| `GET /api/worlds/:id/history` | Current custodian session; paginated events, causes and custody records. Public readers use a Chronicle link through `POST /api/chronicle` |
| `POST /api/simulator/login`, `POST /api/simulator/commands` | Simulation mode only, refused in live mode; visibly labeled practice identities and chat input |
| `/api/operator/bot-*`, `/api/twitch/*` | Operator key or one-use bot-setup cookie for the named bot setup; creator session for subscription status/reconcile, disconnect and live input retry |
| `/health/live`, `/health/ready` | Process health versus database/migration readiness; no secret data |

Return consistent machine-readable errors: unauthorized, forbidden, stale version, invalid phase, unaffordable, target busy, raid proof missing, intent expired, rate limited, dependency unavailable. Never expose tokens or raw database errors.

## Event and live-feed envelopes

Target envelope: persist event ID, world ID, sequence, schema version, rules version, mode, accepted timestamp, actor/community attribution, command ID, causation ID and payload. Implemented `world_events` entries carry these except a per-event schema version and mode (the world row carries the mode); causation is a list of cause event IDs. Relevant event types include world created, phase opened/paused/closed, clue revealed, challenge solved/failed, allocation committed, decision committed, consequence applied/avoided, chapter advanced, world parked/resumed/ended and custody transferred.

Presentation feeds include channel sequence, world ID/version, phase/window ID, server time, deadline, resources, sanitized choices, public clues/puzzle board, aggregate participation and current host. They exclude tokens, raw chat, individual ballots, internal proof secrets and private operational details. Client animations use event/revision IDs to avoid playing twice after reconnection.

## Data minimization and retention

TORCHLINE uses a registered Twitch application (registration requires accepting the Twitch Developer Agreement) and documented Helix/EventSub APIs with broadcaster and bot consent. No legal opinion is claimed. Implemented as of 1 November 2026 (`012_retention.sql`): terminal inbox and chat-dedup rows are pruned after 14 days, delivered outbox rows after 7, expired sessions after 24 hours, and lifetime diagnostics are folded into totals first. The tighter windows below are the target, not current behavior.

- Raw chat bodies are parsed transiently and not retained. A verified notification's minimal normalized content is stored before acknowledgement; filter unrelated chat to a durable ignored/delivery marker without archiving its text.
- Keep failed minimal inbox payloads at most seven days for diagnosis; processed payloads at most 24 hours. Keep delivery-ID tombstones 24 hours, beyond the initial ten-minute freshness window.
- Use a per-world keyed pseudonymous participant ID for ballots/actions. Keep normalized actions for replay, with no login/display name needed. Community attribution uses creator IDs and display names only where authorized.
- Keep refresh credentials only while connected, rotate updated token pairs atomically, and remove them on disconnect. Retain non-secret revocation/audit records.
- Keep world history for the season and judging period; provide participant disconnection/deletion handling and creator-attribution anonymization without rewriting resource outcomes. Set post-judging archive retention before general release.
- Store backups encrypted and account for their retention during deletion. A source-note backup is a private local responsibility; ignoring a file is not encryption.
