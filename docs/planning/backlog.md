# Implementation backlog

Current status (1 November 2026): genuine viewer chat → saved gameplay change was observed on 30 October (B07); the final design and LIVEWIRE, with three presets, are on main; native OBS rendering is verified in saved practice; the native raid (B12) and hosting (B26) remain open. [Implementation status](implementation-status.md).

Earlier status, as of 2026-10-26 (with notes added up to the 30 October design integration): implementation underway. B01–B05, B09–B11, B13/B14/B16/B17 have substantial local implementation/evidence; completion is limited to the behaviors in [the status report](implementation-status.md). B06 has real app/broadcaster/bot authorization and named conversion plus tested role/refresh/disconnect contracts. B07 has three genuine signed challenges and enabled current chat/stream subscriptions; actual chat effects and visible bot output remain unverified. B12 authentic raid is not complete. The final Figma v2 design is integrated on the isolated replacement lane through canonical contracts; see the current status for fresh acceptance. B15 cooperation, persisted timers/recovery, full historical/custody views and consent-scoped previews are implemented locally. Production hardening, owner visual review and actual OBS remain open. Roles express responsibility only.

## Foundation and integration

| ID | Work item | Depends on | Definition of done | Role |
| --- | --- | --- | --- | --- |
| B01 | Initialize the TypeScript workspace, runtime pin, lint/type/build scripts and CI | G0 | Clean install/build succeeds; package boundaries and secret exclusions checked | Platform |
| B02 | Define versioned content, commands, events and state schemas | B01 | Boundary validation and incompatible-version behavior documented/tested | Architecture |
| B03 | Build the pure engine and reference scenario | B02 | Deterministic branch/terminal/replay checks; no Twitch imports or network | Game/backend |
| B04 | Create SQL migrations, snapshot/event writes and active slots | B02 | Fresh DB setup, constraints and atomic commit integration tests pass | Backend |
| B05 | Build isolated simulation and handoff fixtures | B03, B04 | Test-mode UI/commands cannot mutate live worlds; captured events labeled | Backend/tooling |
| B06 | Register app and implement broadcaster/bot consent flows | B01; owner account access | Correct client/user/scopes, state/CSRF/session/refresh/disconnect verified | Integrations/security |
| B07 | Signed webhook gateway and subscription reconciler | B04, B06; TLS endpoint | Genuine challenge/chat, tamper/duplicate/revocation and retry behavior | Integrations |
| B08 | Participation, windows and close watermark | B03, B04, B07 | Latest-vote semantics, pre-close queued inputs, pause/reopen and rate limits verified | Backend |
| B09 | Channel projection and deployed SSE/OBS spike | B01, B04 | Fresh/current snapshot, reconnect, scoped read session and proxy buffering check | Frontend/platform |

## Complete product loop

| ID | Work item | Depends on | Definition of done | Role |
| --- | --- | --- | --- | --- |
| B10 | Creator controls, onboarding and read-only overlay | B03, B06, B09 | New creator can start, participate, pause and commit without exposing controls | Frontend/design |
| B11 | Custody coordinator and transaction protocol | B04, B05 | Correct intent/verification/accept/expiry; recipient/source lock and crash matrix | Backend |
| B12 | Genuine two-channel integration session | B07, B10, B11; broadcasters | Native raid proof matches intent; receiver inherits state; duplicate-safe evidence | Integrations/creator liaison |
| B13 | All five chapters and alternate branches | B03 | Affordable choices, colony/partial/wreck endings and reference journey | Game design |
| B14 | Cooperative repair and salvage-route puzzle template | B02, B03, B08, B10 | Solvable graphs, clue discovery, candidate constraints, one reward and solo path | Game/frontend |
| B15 | Bounded allocation and meaningful investigation | B08, B13 | Normalized preferences, explicit budget, no-vote behavior and visible effects | Game/backend |
| B16 | Consequence provenance and lineage | B03, B04, B13 | Applied/avoided effects link to real earlier decisions and reproduce on replay | Backend/frontend |
| B17 | Park/resume, world library and independent worlds | B04, B10 | Custodian retains parked access, active slot isolation, no offline drain | Backend/frontend |
| B18 | Recipient readiness, preview, accept/decline and arrival recap | B06, B09, B11 | Exact preview, no pre-proof acceptance, busy/offline/opt-out handled | Frontend/product |
| B19 | Original ship systems, puzzle visuals and accessible polish | B10, B14, B16 | 720p readability, reduced motion, keyboard access, actual OBS frame-time check | Design/frontend |
| B20 | Durable jobs, restart recovery, operations health | B04, B07, B08, B11 | Crash boundary tests, queue-age observability, stale work, pause/recovery | Platform |

## Expansion and release

| ID | Work item | Depends on | Definition of done | Role |
| --- | --- | --- | --- | --- |
| B21 | Opt-in recipient directory and collaboration readiness | B17, B18 | Only consenting available creators shown; no implicit custody grant | Product/frontend |
| B22 | Seeded mission variants and richer puzzle constraints | B13–B15 | Guaranteed solvability, deterministic variation, balanced reward comparison | Game design |
| B23 | Wreck salvage chapter and visual replay | B16, B17 | Preserves lineage, explicit recovery cost, no history rewrite or reward farming | Game/frontend |
| B24 | Application-level helper roles | B06, B20 | Explicit delegation, narrow permissions, audit, revoked-access tests | Security/backend |
| B25 | Load/security/reliability validation and creator playtest | Incremental; release after B12–B20 | Results recorded, blocker defects resolved, remaining limitations disclosed | Quality/product |
| B26 | Judge setup, deployment, backups and asset/license register | B01 onward | Clean-machine run, database restore, complete assets and access instructions | Platform/owner |
| B27 | Genuine demo, Codex evidence, description and submission | Working candidate | Public video under 3 min, accessible repository, real session ID, entry Submitted | Owner/product |

Runtime AI narration, unrelated seasons, paid influence and native apps are later product investments. They are not prerequisites for any of these items. Expand the backlog if observed progress supports it; do not promise unfinished features in submission materials.
