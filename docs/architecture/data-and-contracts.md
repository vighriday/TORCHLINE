# Data model and interface contracts

Status: implementation design, 2026-10-26. These are proposed schemas and routes, not existing endpoints.

## Core records

Use PostgreSQL relational columns for identity, uniqueness and constraints; JSONB for versioned engine state, authored content references and event payloads. Twitch IDs are opaque text; world/intent/action IDs are application-generated opaque identifiers. Do not use mutable login names as keys.

| Record | Important fields | Constraint/purpose |
| --- | --- | --- |
| `creators` | twitch_user_id, current login/display name, receive_opt_in, connection status | Twitch ID unique; opting in is separate from OAuth |
| `oauth_grants` | creator/bot ID, scopes, encrypted access/refresh tokens, expiry, validated_at, key version | Server-only; serialize refresh per grant |
| `sessions` | hashed session ID, creator ID, expiry, revocation | Server-authorized creator operations |
| `worlds` | id, mode, custodian_id, lifecycle, chapter, rules_version, seed, state_json, version | One current custodian; resource/schema checks; monotonic version |
| `channel_slots` | channel_id, world_id | Channel primary key and world unique: one active world per channel, one active host per world |
| `phases` | world_id, decision_id, type, window_id, opens_at, closes_at, input_seq, closing_watermark, status, paused_remaining_ms | One open interaction per world; close drains accepted inputs through a persisted watermark |
| `participant_actions` | world/decision/window, actor hash, source message ID, action type/payload, accepted_seq | Accepted normalized actions in stable order; no raw chat bodies |
| `ballots` | world/decision/actor, option, latest accepted_seq | Unique ballot per participant; latest valid action wins |
| `challenge_state` | world/challenge, revealed_nodes, submissions, solved_by, result | Versioned puzzle state; reward awarded once |
| `consequences` | id, world, origin_event_ids, due_chapter, predicate/effect key, status | Apply or avoid once; multiple provenance links allowed |
| `domain_events` | world_id, sequence, type, schema_version, rules_version, actor/community, normalized payload, command ID | Unique `(world_id, sequence)` and accepted command ID |
| `handoff_intents` | world, source, destination, frozen_version, state, prepared_at, expires_at, proof_id | Partial unique pending intent per world/source; one proof per intent |
| `raid_proofs` | message ID, subscription ID, signed timestamp, received_at, source/dest IDs, viewers, intent_id | Message ID unique; consumed proof cannot attach elsewhere |
| `eventsub_inbox` | delivery ID, subscription/type/version, received_at, minimal payload, status/lease/retries | Durable ingress and delivery deduplication |
| `eventsub_subscriptions` | Twitch subscription ID, desired condition, status, last_reconciled_at | Canonical inbound raid subscription per opted-in destination |
| `outbox` / `jobs` | job ID, kind, world/channel, revision, deadline, lease, attempt/error | Atomic publish/timer intent with retryable processing |
| `overlay_grants` | channel ID, capability hash, expiry/revocation | Read-only, rotates independently of Twitch credentials |
| `idempotency_results` | actor ID, route/action key, request hash, outcome | Same key and body returns previous result; mismatched body rejected |

`custodian_id` preserves authorization over parked worlds. `channel_slots` represents active hosting; parking removes the slot but does not transfer custody. A creator may keep several parked worlds and one active world. Completed/wrecked worlds remain archived and can release their slot. Directory readiness is derived from current connection, opt-in, presence and slot state, not a second ownership source.

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
| `/auth/twitch`, `/auth/twitch/callback`, `/auth/logout` | One-time state, server token exchange, validated identity, session lifecycle |
| `POST /integrations/twitch/eventsub` | Signed raw-body verification; challenge/revocation/notification handling; no browser session requirement |
| `GET /api/me`, `/api/worlds`, `/api/worlds/:id` | Creator session; authorized private views |
| `POST /api/worlds` | Creator session; idempotent world creation |
| `POST /api/worlds/:id/commands` | Session, CSRF/origin, custody, mode, expected version, idempotency key |
| `POST /api/handoffs`, `/api/handoffs/:id/accept`, `/decline`, `/cancel` | Source/recipient identity by action; state-machine and transaction checks |
| `POST /api/creator/presence`, `/receive-opt-in` | Creator-controlled readiness, separate from actual raid proof |
| `POST /overlay/:channelId/session` | Fragment capability exchange into a scoped overlay session; credential never logged |
| `GET /overlay/:channelId/events` | Channel-scoped read-only SSE feed, including active assignment changes |
| `GET /api/live/events` | Authenticated dashboard SSE feed, sanitized updates |
| `GET /worlds/:id/history` | Public/community-level projection only when sharing is enabled |
| `/simulator/*` | Non-live deployment/mode only; visibly labeled test controls |
| `/health/live`, `/health/ready` | Process health versus database/migration readiness; no secret data |

Return consistent machine-readable errors: unauthorized, forbidden, stale version, invalid phase, unaffordable, target busy, raid proof missing, intent expired, rate limited, dependency unavailable. Never expose tokens or raw database errors.

## Event and live-feed envelopes

Persist event ID, world ID, sequence, schema version, rules version, mode, accepted timestamp, actor/community attribution, command ID, causation ID and payload. Relevant event types include world created, phase opened/paused/closed, clue revealed, challenge solved/failed, allocation committed, decision committed, consequence applied/avoided, chapter advanced, world parked/resumed/ended and custody transferred.

Presentation feeds include channel sequence, world ID/version, phase/window ID, server time, deadline, resources, sanitized choices, public clues/puzzle board, aggregate participation and current host. They exclude tokens, raw chat, individual ballots, internal proof secrets and private operational details. Client animations use event/revision IDs to avoid playing twice after reconnection.

## Data minimization and retention proposal

These are product defaults to implement and verify against applicable Twitch terms; they are not a claim of legal compliance.

- Raw chat bodies are parsed transiently and not retained. A verified notification's minimal normalized content is stored before acknowledgement; filter unrelated chat to a durable ignored/delivery marker without archiving its text.
- Keep failed minimal inbox payloads at most seven days for diagnosis; processed payloads at most 24 hours. Keep delivery-ID tombstones 24 hours, beyond the initial ten-minute freshness window.
- Use a per-world keyed pseudonymous participant ID for ballots/actions. Keep normalized actions for replay, with no login/display name needed. Community attribution uses creator IDs and display names only where authorized.
- Keep refresh credentials only while connected, rotate updated token pairs atomically, and remove them on disconnect. Retain non-secret revocation/audit records.
- Keep world history for the season and judging period; provide participant disconnection/deletion handling and creator-attribution anonymization without rewriting resource outcomes. Set post-judging archive retention before general release.
- Store backups encrypted and account for their retention during deletion. A source-note backup is a private local responsibility; ignoring a file is not encryption.
