# 0027 — Recover participation and read-only overlays

Accepted and implemented 2026-10-29 to address audit A02, A03 and A05. Keep the approved engine/episode/custody boundaries, existing PostgreSQL inbox and overlay capabilities.

## Decision

When a signed chat revocation arrives, freeze the active audience phase's persisted deadline and enqueue a distinct internal interruption. A supervisor also detects lost grants or a previously confirmed subscription becoming unavailable. It does not pretend an initially unconfigured channel has suffered a provider outage. Channel then world locks serialize this with ingress and commands. Already admitted chat drains; new chat and closing controls cannot pass the cutoff. Waiting for admitted work does not consume the interruption's dependency-failure budget. The worker records one replayable pause and retains the captured time. Repaired subscriptions do not resume play automatically; an explicit creator resume requires current chat readiness.

Internal work is `torchline.episode.interruption`, not a Twitch notification or delivery record. It cannot create raid proof or transfer custody. No engine content change, new service, migration or dependency is needed.

For overlays, distinguish authorization ending from a temporary projection failure. A new read-only `GET /overlay/:channel/state` uses the same path-scoped, hashed, expiring cookie and channel checks as the feed. The client rechecks this read before each feed connection, retries temporary failures with bounded exponential backoff, retains its last snapshot during a temporary outage and stops/clears it on actual denial. Capability exchange remains the only retryable POST and grants reads only. Gameplay and custody writes are never retried.

After bot conversion, creator-feed closure must not overwrite a successful anonymous/bot setup state with an obsolete creator connection error. The account-flow browser test uses reduced motion; separate tests retain real WebGL animation coverage.

## Alternatives and limits

Directly pausing inside webhook handling could discard accepted chat or delay acknowledgement. A new queue/service would add a second durable boundary without solving that ordering. Merely changing subscription status leaves clocks running. Treating every feed failure as revocation makes transient outages permanent; blindly reconnecting revoked feeds obscures actual denial. These alternatives fail the reproduced cases.

This supervises known subscription/grant failure, not undetectable upstream silence while Twitch still reports enabled. There is no reliable per-message heartbeat from a quiet chat. Retry exhaustion caused by a real persistent database failure remains an operator recovery condition. Fresh initial live setup, actual OBS CEF and genuine Twitch outage behavior need their own acceptance evidence.

## Component stress review

| Component | Consequence / boundary |
| --- | --- |
| C1 Identity | Current session/custody still authorizes public writes; internal pause cannot grant identity; resume requires current Twitch grants |
| C2 Gateway | Signed revocation requests internal work; no fabricated native delivery or relaxed HMAC |
| C3 Participation | Persisted cutoff rejects new input while preserving admitted work and actor deduplication |
| C4 Engine | Existing pure pause/resume transitions and immutable rules; pause remains replayable |
| C5 Episodes | Deadline/time remainder frozen before drain; repaired connection needs deliberate resume |
| C6 Custody | No proof or acceptance change; frozen offers excluded from interruption |
| C7 Database/work | Existing inbox/outbox transactions, channel→world locks and idempotent window key; no migration |
| C8 Projection | Machine-readable pending interruption disables host capabilities; transient feed errors are retryable |
| C9 Dashboard | Pending cutoff cannot race a phase close; successful bot conversion survives old feed closure |
| C10 OBS | Same read-only capability for state and SSE; recovery never gains creator permissions |
| C11 History | Canonical pause event preserves replay; transport reconnect cannot duplicate consequences |
| C12 Validation | Isolated real PostgreSQL/provider fixtures and browser fault injection; native evidence separate |
| C13 Operations | Restart retains interruption/time; revoked overlay stops polling; permanent hosting/soak still required |

## Executed evidence

`tests/chat-interruption.test.ts` covers signed revocation, accepted input, persisted time, repeated ticks/restart, grant/subscription loss, replay and repair-before-resume. `tests/browser/overlay-recovery.spec.ts` covers initial 503s, mid-feed dependency failure, restored snapshots, mutation denial and terminal grant revocation. The complete twelve-journey browser suite passes locally, including existing gameplay, physical-state layouts and actual WebGL loading/encounter tests. Provider events in these tests are fixtures, not genuine Twitch evidence. Final suite/source results are recorded in the follow-up report.

Revisit if measured supervisor query cost, more than one worker deployment, or upstream silence requires a stronger operational health policy. Do not infer a reliable Twitch outage detector from these local tests.
