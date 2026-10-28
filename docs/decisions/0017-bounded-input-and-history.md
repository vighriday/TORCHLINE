# 0017 — Persisted input admission and bounded history

Accepted and implemented 2026-10-28. Retains the approved stack and all game rules.

## Decision

Enforce per-viewer and per-world token budgets and a pending-work ceiling inside the existing channel → world transaction locks. PostgreSQL receipt time refills persisted allowances, so callback retries, processes and restarts share one policy. Only eligible current-window commands spend allowance. Duplicate delivery/message IDs never spend twice. Denials retain idempotency records and aggregate reasons without raw viewer IDs or chat text.

Defaults are operational safeguards: viewer burst 6/refill 1 per second, world burst 60/refill 30 per second, maximum 128 pending actions per world. The five `INPUT_*` overrides in `.env.example` are validated at startup. These values are not advertised audience capacity or game rewards. Sustained ingress still consumes signed-request validation and durable rejection storage; reverse-proxy limits, retention design and a deployed soak remain release work.

Schedule pending work round-robin across channels within a batch, with raids prioritized. Preserve receipt order between chat and stream-offline notifications in a channel: pausing must drain previously accepted input. Keep existing explicit retries/quarantine and worker fencing.

Read bounded public event tails on Twitch actions and dashboard/overlay projections. Partial indexes omit individual ballots, allocation preferences and inspection actions; complete authorized history/replay remains available through its existing paths. Add nullable overlay expiry so temporary verification capabilities can expire without changing ordinary OBS link lifetimes.

## Alternatives and consequences

An in-memory limiter loses state across restart and does not coordinate callbacks. Redis adds a second consistency boundary without eliminating the database lock. An unbounded inbox preserves every action but allows one channel to starve others. Persisted admission is the smallest compatible change; tuning requires measured callback latency, rejection counts and queue age. It deliberately drops excess input rather than promising every spam command will execute. Never retry a rejected command as a new authenticated input automatically.

## Component review

| Component | Constraint and evidence |
| --- | --- |
| C1 Identity | Existing signed ingress/session/custody authority retained; hashed viewer subjects only |
| C2 Gateway | Ack follows durable admission/dedup; duplicates consume no allowance; HMAC precedes parsing |
| C3 Participation | Shared persisted budgets, refill, backlog ceiling and isolated worlds tested with concurrent stores |
| C4 Engine | No rule/content changes, clock or I/O added; existing replay/balance suites retained |
| C5 Episodes | New windows reset allowance; stale/unsupported input does not spend; offline ordering regression tested |
| C6 Custody | Existing lock order retained; no input or rate record creates raid proof |
| C7 Database/work | Additive migration 008, indexed pending lookup, fair batches, durable rejection metadata |
| C8 Projection | Bounded tails avoid reading all ballots for every Twitch action; no raw input records exposed |
| C9 Dashboard | Existing commands/recovery preserved; no new public mutation route |
| C10 OBS | Temporary expiry checked at exchange/feed; ordinary links unchanged; no creator privileges |
| C11 History | Full immutable events retained; indexed public pages omit private individual actions |
| C12 Validation | Real PostgreSQL concurrent/flood/fairness/refill tests and synthetic 50,000-ballot query fixture |
| C13 Operations | Validated overrides and schema readiness; no claimed multi-channel capacity or live OBS proof |

## Executed evidence and revisit trigger

85 automated tests across 15 files pass, including six admission cases, a 50,000-ballot query-plan regression and temporary overlay expiry/authority checks. The query fixture verifies the partial index and bounded results; synthetic rows are explicitly not a replay attestation or a deployment capacity benchmark. Browser verification is recorded in the release report. Native Twitch input, visible replies and OBS remain separate gates.

Revisit when measured queue age or denials harm cooperative play, callback latency grows, or event history exceeds the indexed query envelope. Do not remove deduplication records as an inferred cleanup.
