# ADR 0009: Durable bot output and explicit account roles

Status: implemented and fixture-tested, 2026-10-26. Genuine bot delivery remains an external acceptance gate. Refines D6, D7, D8, D10, D11 and D17 without changing the approved stack.

## Context and decision

Gameplay commands must remain responsive when Twitch message delivery is slow or ambiguous. Reply to `!status`/`!history` through a PostgreSQL outbox and a separate bounded worker using the native Send Chat Message API. No additional broker, IRC connection or browser token is needed. Use current bot/creator grants, the exact confirmed chat subscription, source-only output and authored public state summaries. Persist no raw query text or viewer identity in the reply queue.

Coalesce queries for ten seconds per channel and pace the bot globally at one send per two seconds. Apply a thirty-second backoff after provider rate limiting. A provider `is_sent=false` is failed delivery; a lost response after sending is uncertain. Do not automatically retry uncertain sends. On restart quarantine in-flight sends as uncertain. These choices trade occasional missing informational replies for avoiding duplicate/spam output; they do not discard accepted gameplay actions. Proactive announcements are not implemented.

Bot setup requires the separate operator key and fresh bot OAuth consent. Both OAuth roles serialize under the same role lock and account lock. A current bot cannot connect as a creator. [ADR 0010](0010-explicit-empty-account-bot-conversion.md) replaces mandatory manual disconnection for accidental empty creator registrations with an explicit named conversion that ends creator authority atomically. World/handoff/custody history still prohibits conversion. Ordinary creator disconnection revokes local sessions, overlays, queued gameplay authority and pending offers while preserving worlds/history. Provider token revocation is best effort after ordinary local disconnect.

Private diagnostics are creator-scoped, including subscriptions, signed delivery counters, applied actions and bot reply outcomes. Anonymous users receive configuration booleans only; scoped overlays receive read models without integration details. Overlay rotation uses a channel-locked transaction, ensuring concurrent rotations leave one current capability.

## Alternatives and consequences

Sending in the webhook path would couple acknowledgment and gameplay latency to external delivery. Reusing the input worker would block accepted game actions during network calls. A generic queue service adds operational/state consistency work before measured need. Retrying all requests cannot guarantee exactly-once chat delivery because Twitch sending is an external side effect. Database state is authoritative for intent/outcome, with uncertainty recorded honestly.

Retaining separate creator/bot roles gives clearer authority than allowing an account to act as both. Safe empty-account recovery addresses observed onboarding confusion without deleting historical creator identity. The setup form is accessible while signed in but still requires the operator key; UI visibility conveys no authority.

## Validation, dependencies and revisit

Provider fixtures test coalescing, deduplication, echoes/mirrors, source-only parameters, pacing, drops, revoked grants, uncertain sends, restart and slow-network isolation. PostgreSQL tests cover stale-token validation and concurrent overlay rotation. A browser journey covers accidental creator sign-in, wrong setup key, explicit disconnect and bot authorization. These are not real Twitch delivery evidence.

Real acceptance requires bot consent, signed HTTPS challenge, real chat effects and visible bot output. The authentic two-creator raid/OBS milestones remain separate. The [component review](../architecture/decision-stress-review.md) checks integration with every existing component. Before multiple worker replicas, introduce leases, fair scheduling and shared delivery limits with crash/load evidence; do not infer those guarantees from the current single-instance worker.
