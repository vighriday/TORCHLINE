# ADR 0031: Versioned missions in the same Ark

Date: October 30, 2026. Status: implemented and merged into main in v0.1.0-preview.2 behind a default-off flag; not live-accepted.

LIVEWIRE lets the captain keep playing an ordinary game while chat selects a small, declared consequence for the persistent Ark. Game results are **streamer-attested**, never detected or verified by TORCHLINE. It uses the existing engine package, database, signed chat ingress and scoped read-only overlay.

## Rules and compatibility

`livewire-v0` is an explicit optional engine extension on `ark-v3`, recorded on each extension event. Neither historical reducer is edited. Unextended histories still use their original replay; mixed histories pass through the version-dispatching reducer and compare every stored event, including effect and evidence. Older `ark-v2` worlds cannot opt in.

Missions run only in `ready`, before chapters 1–5. Each of the five boundaries permits **one opening**, across all hosts and restarts. Opening irreversibly consumes its allowance and one supply. Success repairs at most three points of one eligible system; failure removes at most six, leaving at least one point. No supplies, passengers, power or new obligations are granted. Destroyed/sealed systems are unavailable. Thus a season can gain at most 15 repair points while spending up to five supplies. Cancellation, expiry, rehosting and transfer cannot renew an allowance. This deliberately narrower bridge changes existing resources, affordability and survival, without inventing new crisis content.

Selection lasts 45 seconds. The captain must explicitly lock **before** starting the attempt. Ballots choose navigation, hull or oxygen; ties follow that order. With zero ballots, an explicit solo choice is required and labeled solo. A lock freezes exact options, tallies, source class, target, author/channel, timestamp, base game version and policy. The captain has two hours to attest success/failure. Expiry grants nothing. No automatic lock, game detection or outcome inference occurs.

An unresolved mission blocks chapter commands, parking and handoff preparation. Existing raid evidence/recipient-consent rules remain unchanged. On restart, loss of chat authority, disconnect or offline notification, open selection pauses; explicit resume restores its saved remainder and rejects earlier messages. Locked attempts remain durable, cannot be changed, and expire without an effect. They cannot move between custodians.

## Integration and authority

Only the connected current custodian can mutate, using the normal same-origin server session. Requests require optimistic world revision and a request key; exact retries are harmless and conflicting key reuse fails. Public command endpoints cannot submit internal lock tallies/effects. SQL channel → world locking serializes chapter, mission and custody work. The Ark snapshot, domain event, SQL mission status and publish intent commit atomically.

Ballots use separate indexed SQL rows, pseudonymous per-world participant keys and compact three-count aggregates. Latest provider timestamp wins, with delivery-ID ordering for timestamp ties. Both provider and database receipt must precede the cutoff; resumed windows reject earlier input. Delivery IDs and underlying chat-message IDs deduplicate independently. Admission budgets and a 10,000-participant ceiling bound each mission. No participant map is added to canonical JSONB. Lock events retain replay inputs without exposing a voter roster.

`LIVEWIRE_ENABLED=false` is the default. Disabling it prevents openings/new ballots/locks/resumes; existing locked missions can still be resolved or cancelled, and expiry continues. Keep the extension-capable binary to read/replay worlds that have used it. **Disabling is the supported rollback; downgrading to a pre-extension binary is not safe for mixed histories.** The original release/worktree remains isolated and unmigrated by feature work.

## Component stress review

| Component | Decision and strongest failure check |
| --- | --- |
| C1 Identity | Reuse creator session; recheck connected custodian and mode under lock; overlay/viewer/other creator denied |
| C2 Twitch gateway | Existing exact signed subscription checks; no new scopes, sender, transport or fabricated native evidence |
| C3 Participation | Indexed unique ballot, latest-input ordering, deadline/receipt cutoff, finite cap and existing admission policy |
| C4 Engine | Optional pinned extension; finite allowance, bounds, no resurrection, full mixed replay and ending witnesses |
| C5 Episodes | Between chapters only; mutually exclusive unresolved mission; saved selection recovery and result expiry |
| C6 Custody | Unresolved mission blocks prepare; closed ledger and scars follow the actual world; no bot-role changes |
| C7 Storage/work | Additive migration; atomic state/event/status/outbox; rollback, concurrency and restart probes |
| C8 Projection | Compact aggregates plus ballot revision; no personal roster or credentials; reconnect reads saved state |
| C9 Captain | Small mission workspace; explicit zero-vote and attestation disclosures; stale actions refetch |
| C10 OBS | Existing grant, cookie and SSE; compact/auto layouts are presentation only, no new control permission |
| C11 History | Canonical causal result and ship marks; old histories unchanged, mixed events verified on replay |
| C12 Validation | Pure rules, real SQL, signed local provider fixtures and browser tests; native service proof tracked separately |
| C13 Operations | Feature off by default; separate branch/schema; existing backup/deploy path, no new service or purchase |

This table is a design review. Executed results and remaining acceptance belong in the implementation report; it is not proof of capacity, genuine chat effects or native raid transfer.
