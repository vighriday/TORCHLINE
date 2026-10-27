# 0013 — Versioned cooperation and bounded repair allocation

Accepted 2026-10-27. `ark-v2` stays immutable. New `ark-v3` rules add optional investigation, declared repair reserves, normalized latest-account preferences and frozen advisory votes. Storage adoption and episode deadlines are a separate integration step.

Investigation selects a real shared clue: engine reveals the required relay, life the unsafe relay, cargo a general relay; chapter three maps to work orders B/C/A. Plurality ties use engine, cargo, life order. No participants means no free clue. Every clue remains independently discoverable afterwards.

The captain declares 0–10 power before allocation, initially zero. Each account assigns 1–5 preference points between hull and oxygen. Latest input replaces that account's input. Largest-remainder apportionment distributes the fixed reserve; equal remainders favor hull. Account count cannot increase the budget. One power repairs one hull or recovers two oxygen. The reserve constrains choice affordability, but only useful, cap-bounded benefits consume power at commitment. Oxygen recovery does not repair leaking machinery. Choice damage and allocation combine before terminal evaluation, preserving signed critical damage until evaluation; lethal overkill cannot become a repaired one-point wreck. Reserves reset each chapter. A closed allocation cannot be edited during voting.

Closing voting freezes advice in `awaiting-commit`; only the captain commits. Committed history records whether the captain followed, overrode or received tied/no advice. No timer chooses a narrative outcome. The game remains playable on a single channel, without raids, puzzles or allocation participation.

Alternative: replacing v2 in place would invalidate historical replay. A mutable rules plug-in framework adds abstraction before a second season exists. A small immutable version fork keeps authored effects explicit and testable; shared infrastructure dispatches by stored version. Deduplicating those files is forbidden if it changes historical output. Historical `createWorld` defaults stay stable; authoritative storage explicitly selects current rules when integration is ready.

## Component stress review (design analysis)

| Component | Constraint / consequence |
| --- | --- |
| C1 Identity | Captain-only configuration/closing; authenticated account identity remains server-derived. |
| C2 Twitch | Additional bounded commands need no new scopes or provider API. Parser rollout is separate. |
| C3 Participation | Latest preferences, fixed reserve, deterministic ties; account multiplicity can influence direction, never mint resources. This is not a claim of Sybil prevention. |
| C4 Engine | No I/O, time reads or randomness. Clues and repairs alter canonical future state. |
| C5 Episodes | Additional participation phases can close independently; awaiting-commit never auto-commits. |
| C6 Custody | Ready-boundary transfers retain scars/events; no active reserve crosses a committed chapter. |
| C7 Storage | Existing atomic event/snapshot/outbox boundary applies unchanged. No new authority from JSON preferences. |
| C8 Projection | Only aggregate priorities/plan/counts, never actor maps, reach public renderers. |
| C9 Dashboard | Declare budget before allocation; forecasts must include the frozen plan and reserve costs. |
| C10 OBS | Read-only phase instructions/countdown; same canonical plan and scars as dashboard. |
| C11 Replay | Immutable v2 module; dispatch and genesis version explicit; v3 events include allocation provenance. |
| C12 Validation | Exhaustive integer normalization, lethal overkill, caps, latest-account replacement, replay and all-ending reachability. |
| C13 Operations | New worlds adopt v3 explicitly; existing worlds never migrate silently. Timing remains outside rules. |

## Executed evidence

`tests/cooperation.test.ts`: eight regressions, including 112,211 aggregate-weight/budget combinations, replay, combined forecasts, all three endings without allocation, private actor-independent aggregates, frozen advice, and no machinery repair through oxygen recovery. Existing eight engine regressions retain the complete 2,398-path v2 balance audit. These are deterministic tests, not live Twitch or OBS acceptance. Storage, parser and visual integration are not established by this commit.
