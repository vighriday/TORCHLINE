# Delivery roadmap

Plan date: 2026-10-26. Architecture review is complete and implementation is underway. [Current evidence](implementation-status.md) records G1 gameplay progress, G2 adapter/UI work, and G3a independent custody checks. G2 live/OBS and G3b authentic raid remain unsatisfied external gates. No team size, daily capacity, or broadcaster availability is assumed.

## Outcome and ordering

Deliver an engaging persistent community game, then demonstrate its signature authentic Twitch raid transfer. Solo gameplay and collaboration foundations progress independently of the external live-raid dependency. Once the core loop is stable, keep expanding the complete five-chapter season, audience problem solving, visual quality, creator tools and reliability.

| Gate | Deliverable | Required evidence | Dependency |
| --- | --- | --- | --- |
| G0: Review | Requirements, architecture, stack, risk register, repository | Approved 2026-10-26; gameplay refinements and Claude Design boundary incorporated | Complete |
| G1: Domain foundation | Deterministic world, chapter lifecycle, representative consequence, puzzle template, simulator | Save/reload, solo progression, route-solution check, reference replay, terminal path | G0 |
| G2: Hosted live play | Twitch login/grants, chat adapter, deployed ingress, private controls, OBS feed | Genuine chat affects a hosted episode; actual OBS/SSE smoke and reconnect; missing consent handled | G0; can be developed alongside G1 |
| G3a: Custody correctness | Intent/proof/accept state machine, database constraints, isolated handoff harness | Duplicate, target-busy, expired, simultaneous accept and crash cases pass on real PostgreSQL | G1; Twitch fixtures available independently |
| G3b: Authentic handoff | Two consenting broadcasters, native raid, receiver accept | Captured genuine notification and exactly one custody change with identical inherited state | G2 + G3a + external broadcaster access |
| G4: Complete season | All five branching chapters, clue discovery, cooperative repair, bounded allocation, endings, park/resume | Complete solo season and multi-community continuation; meaningful non-voting participation | G1 + G2; do not block on G3b |
| G5: Product depth | World library, lineage, onboarding, recipient readiness, richer graphics, independent active worlds | Usability, cause attribution, world isolation and broadcast readability | G4; handoff UI consumes G3a |
| G6: Reliability and release candidate | Security, mixed-load, restart, failure recovery, clean setup, monitoring | Validation matrix completed with results and known limits; reproducible build | Continuous from G1, release gate after G3b/G4 |
| G7: Submission | Real gameplay/raid footage, Codex evidence, runnable repository, public video and description | Submitted entry and working judge access before internal cutoff | G6; capture evidence as soon as available |

Do not interpret G6 as permission to postpone reliability: every earlier gate includes its own correctness checks. Likewise, do not wait for a five-chapter polished season before trying the first real raid.

## Calendar checkpoints

These are target checkpoints, not promises about unknown capacity. Dates are in Asia/Calcutta. Move work earlier whenever gates pass; revise feature order based on measured progress.

| Date | Target evidence/review |
| --- | --- |
| Oct 26 | Finish planning/review. Identify app registration, bot authorization and broadcaster-access owners. |
| Oct 27 | Engine/reference path and first puzzle in the simulator; deployed OAuth/webhook/OBS streaming spike. |
| Oct 28 | Single-channel playable episode with real chat; transactional handoff harness including competing recipient claims. |
| Oct 29 | Earliest target for genuine two-channel raid demonstration, subject to access; complete core continuity. Continue season depth if access is pending. |
| Oct 30 | Complete five-chapter season, non-voting challenge, branching history, library/park/resume and recipient flow. |
| Oct 31 | Multi-world isolation, visual polish, failure/load/security evidence and creator playtest; choose additional features only from a working candidate. |
| Nov 1 | Feature freeze for the candidate; clean setup and OBS rehearsal; record real Twitch/Codex footage and prepare submission materials. |
| Nov 2 | Verify access and video, final smoke, submit by **23:59 IST** as the internal cutoff. Avoid starting an architectural rewrite. |

The official pages' timing discrepancy and the expected November 3 IST deadline are recorded in [the hackathon plan](hackathon.md). Do not use this internal schedule as an organizer deadline.

## Expansion after each stable gate

The backlog has explicit dependencies rather than a hard feature ceiling. High-value additions are seeded crisis variants, richer puzzle constraints, multi-hop cause visualization, opt-in recipient discovery, scheduled relay readiness, original ship animations, a salvage chapter for wrecks, delegated pause controls, and visual historical replay. Choose the next addition by demonstrated entertainment value, integration risk and time remaining, not by an assumed team-size limit.

Preserve completed gates as new work lands. Keep a working release candidate available. If a feature threatens the accepted custody/security or replay contract, isolate or disable that feature while preserving the validated experience.

## External dependency handling

Without broadcaster access, continue engine, full season, simulator, handoff races, UI and hosted single-channel work. Mark the authentic-transfer claim unverified and keep arranging access through the user. If no real raid test is possible before recording, the submission must disclose that limitation; a simulator does not satisfy the defining native-transfer acceptance criterion.

No claim of a full creator network is needed for a complete first season. Later collaboration capabilities can reuse the same custody/episode boundaries. A non-raid transfer policy, if later desired, requires its own named mode and ADR; it must not blur evidence for the signature raid path.

## Product horizons beyond the first season

| Horizon | Capability | Evidence before broadening |
| --- | --- | --- |
| Persistent community game | Repeatable seasons, rich audience roles, libraries and accessible solo hosting | Creators voluntarily repeat sessions; viewers understand and enjoy non-voting actions |
| Creator collaboration network | Opt-in directory, scheduled relay readiness, shared planning, explicit cohosts and multi-hop world histories | Real creator demand and reliable consent/permission boundaries |
| Season platform | Additional authored formats, content validation tools, versioned scenario packages and recovery expeditions | A second distinct season reuses the engine without embedding its rules in Twitch adapters |
| Sustainable ecosystem | Creator event tooling, moderation operations, scalable hosting and optional commercial models | Measured usage, acceptable operating cost, permissions/asset review and clear creator value |

These horizons describe the full direction without inventing launch dates or claiming network adoption. Reuse the validated game/episode/custody architecture; expand interfaces only when a concrete season or collaboration scenario requires them.
