# 0014 — Durable episode timing, worker fencing and input recovery

Accepted 2026-10-27. New authoritative worlds use ark-v3. Migration 007 adds hosted episode clocks and durable inbox retry metadata. Existing ark-v2 worlds remain manual, replayable and playable.

## Policy and recovery

Policy `episode-2026-10-27.1` defaults to 30 seconds investigation, 90 challenge, 45 allocation and 60 advisory voting. These are explicit pacing rules, not assumed project capacity. At a ready boundary the current connected custodian can select manual timing or configure each duration to 15–1800 seconds through the authenticated API. The reference interface exposes the standard preset and manual mode. Custody acceptance clears the old hosted clock/pacing in its transaction; the receiver inherits game rules and scars, then chooses their own episode pacing. Arrival remains atomic; phases without enabled interactions are skipped. A deadline closes the current phase only. Voting closes into awaiting-commit. The captain always chooses the story outcome.

Every transition writes engine state, event, clock and publish intent in one transaction under channel/world locks. PostgreSQL supplies the transition timestamp. Timers carry the expected window and revision and recheck the stored deadline under locks. Competing timer/manual requests cannot close twice. Pause saves remaining duration; explicit resume opens a fresh input window. Parking a running episode first records a pause. Rehosting leaves it paused. Disconnect ends queued authority and records a pause without changing resources/scars. Signed stream.offline delivery queues an advisory pause, bound to the observed world/window; stream.online never resumes automatically. A handoff remains a ready-boundary operation and never depends on a timer firing.

On startup a fenced worker captures the existing timed worlds, drains already accepted input, and records recovery pauses with remaining duration from the last healthy observation. New worlds are excluded from that startup set. Downtime does not silently consume resources or select an outcome. A dedicated PostgreSQL session advisory lock scopes worker ownership to database/schema/mode. A second worker fails startup; losing that connection closes the service. This permits one active process, not multi-instance SSE fan-out. Keep one deployment replica.

The input policy requires both the signed notification timestamp and durable receipt to precede the deadline. This deliberately rejects a callback first received after closure even if Twitch sent it earlier. Pre-cutoff accepted inputs retain their window and drain before close/pause/commit. This is a receipt watermark, not a claim that network-delayed Twitch events can be completely recovered. Exact provider-time/DB-time skew near an opening remains an operational NTP concern. Tests use the database clock where that boundary matters.

Transient inbox failures use persisted exponential backoff (1–60 seconds); the eighth failed attempt quarantines the row with an audit error. This releases blocked windows without pretending the action applied. Private diagnostics expose counts and oldest pending time. Only the authenticated live custodian can retry quarantined chat still belonging to their currently active window. Old-window, other-channel, successful input, native raid proof and uncertain bot sends cannot be replayed through that route. Successful retries clear the error. Automated deadline closure may make a quarantine ineligible for retry; the audit remains available operationally.

## Component stress review (design analysis)

| Component | Constraint / consequence |
| --- | --- |
| C1 Identity | Creator/session/current custody authorize settings/retry. Disconnect pauses and revokes input/overlay authority. No viewer/admin promotion. |
| C2 Twitch | Existing scopes only; signed current subscriptions precede input/offline handling. At-least-once delivery remains deduplicated. |
| C3 Participation | inspect/allocate grammar bounded to 160 chars and five points. Both cutoff clocks checked; accepted work drains. Per-account flood limits remain future hardening. |
| C4 Engine | Timers stay outside immutable rules. Same explicit close/pause commands replay deterministically. |
| C5 Episodes | Persisted deadlines, pause/park/manual/restart semantics; never automatic story commitment or offline resource drain. |
| C6 Custody | Ready-boundary freeze/receiver consent/native proof unchanged. Timers cannot authorize transfer. |
| C7 Database/work | Additive migration, transactional clocks, guarded deadlines, mode-scoped lease, bounded retry/quarantine. Retention and backup restore still open. |
| C8 Projection | Clock is display metadata, not authority. Aggregate cooperation only; histories omit individual preferences, inspections and votes. |
| C9 Dashboard | Explicit reserve, timing preset/manual, phase closers, recovery reason and private input diagnostics. Distinct React sibling keys prevent stale Ark duplication. |
| C10 OBS | Same phase instructions/clock/aggregate plan, no controls. Chromium coverage is distinct from installed OBS acceptance. |
| C11 Replay | Existing v2 module unchanged; new v3 genesis explicit. Pauses/closures/allocations recorded with event sequence and causes. |
| C12 Validation | SQL concurrency, cutoff, reconnect, lease/restart, signed fixture offline/chat, retries, mobile and overlay journeys. |
| C13 Operations | Migration required for readiness/startup; one replica; restore public HTTPS independently. The development automation helper (not part of TORCHLINE) failed to start; that is not an OBS pass. |

## Evidence scope

See `tests/episodes.test.ts`, `tests/twitch-recovery.test.ts` and `tests/browser/cooperation.spec.ts`. Tests exercise real PostgreSQL and HTTP with signed local provider fixtures; they do not send Twitch chat or perform a native raid. The development automation helper (not part of TORCHLINE) failed to start (`failed to write kernel assets: The system cannot find the path specified`), so no native OBS automation ran and actual CEF, cookie reload and frame-time acceptance remain unverified. HTTPS remains blocked by the deferred missing ngrok credential. The source register records current primary-document checks for stream.offline and webhook acknowledgement/deduplication.
